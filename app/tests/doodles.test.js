import { Resvg } from '@resvg/resvg-js'
import { describe, expect, it } from 'vitest'
import {
  DOODLES,
  DOODLE_SIZE,
  doodleLayout,
  doodleMarkup,
  doodleProblem,
  findDoodle,
} from '../src/data/doodles'
import {
  PACKS,
  canOutline,
  canTone,
  findSticker,
  isInk,
  searchStickers,
} from '../src/data/stickers'
import { isSlot, slotsIn } from '../src/lib/slots'

const palette = [
  { hex: '#AA0000', name: 'a' },
  { hex: '#00BB00', name: 'b' },
  { hex: '#0000CC', name: 'c' },
  { hex: '#DDDD00', name: 'd' },
  { hex: '#EE00EE', name: 'e' },
]

// the shapes are what is checked here, so skip loading every font on the machine for each drawing
const NO_FONTS = { font: { loadSystemFonts: false } }

const svgOf = (doodle) => {
  const { width, height } = doodleLayout(doodle)
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${doodleMarkup(doodle, palette)}</svg>`
}

describe('doodles.json (yours to edit)', () => {
  it('gives every doodle a unique simple id, a name and a drawing', () => {
    expect(new Set(DOODLES.map((d) => d.id)).size).toBe(DOODLES.length)
    for (const d of DOODLES) {
      expect(d.id, 'id').toMatch(/^[a-z0-9-]+$/)
      expect(d.label, `label of ${d.id}`).toBeTruthy()
      expect(d.svg?.trim(), `drawing of ${d.id}`).toBeTruthy()
      expect(Array.isArray(d.keywords ?? []), `keywords of ${d.id}`).toBe(true)
      if ('line' in d) expect(typeof d.line, `line of ${d.id}`).toBe('boolean')
    }
  })

  it('has sizes that are real numbers, not too big for the card', () => {
    for (const d of DOODLES) {
      const { width, height } = doodleLayout(d)
      expect(width, d.id).toBeGreaterThan(0)
      expect(height, d.id).toBeGreaterThan(0)
      expect(Math.max(width, height), d.id).toBeLessThanOrEqual(96)
    }
    expect(doodleLayout({})).toEqual(DOODLE_SIZE)
  })

  it('has real variety', () => {
    expect(DOODLES.length).toBeGreaterThanOrEqual(30)
    expect(DOODLES.filter((d) => /\{c\d\}/.test(d.svg)).length).toBeGreaterThanOrEqual(3)
  })

  it('keeps the eight doodles old postcards used, with the same ids', () => {
    for (const id of ['heart', 'star', 'sun', 'moon', 'flower', 'cloud', 'squiggle', 'arrow'])
      expect(findDoodle(id), id).toBeTruthy()
    expect(findDoodle('heart').label).toBe('Heart')
  })

  it('has no stray color slots', () => {
    for (const d of DOODLES)
      for (const slot of slotsIn(d.svg)) expect(isSlot(slot), d.id).toBe(true)
  })
})

describe('keeping a doodle a plain drawing', () => {
  it('accepts every doodle that ships', () => {
    for (const d of DOODLES) expect(doodleProblem(d), d.id).toBeNull()
  })

  it('refuses scripts, handlers, pictures and links to somewhere else', () => {
    const bad = (svg) => doodleProblem({ svg })
    expect(bad('<script>alert(1)</script>')).toMatch(/not a plain drawing/)
    expect(bad('<foreignObject><div/></foreignObject>')).toMatch(/not a plain drawing/)
    expect(bad("<image href='x.png'/>")).toMatch(/not a plain drawing/)
    expect(bad('<style>*{}</style>')).toMatch(/not a plain drawing/)
    expect(bad("<rect onclick='x()' width='1' height='1'/>")).toMatch(/event handler/)
    expect(bad("<use href='https://evil.example/x.svg#a'/>")).toMatch(/outside/)
    expect(bad("<rect fill='url(https://evil.example/x)'/>")).toMatch(/outside/)
  })

  it('allows a use or a gradient that points at something inside the same drawing', () => {
    expect(
      doodleProblem({ svg: "<defs><path id='a' d='M0 0'/></defs><use href='#a'/>" }),
    ).toBeNull()
    expect(doodleProblem({ svg: "<rect fill='url(#g)'/><linearGradient id='g'/>" })).toBeNull()
    expect(doodleProblem({ svg: "<animate/><path d='M0 0'/>" })).toBeNull() // "a" inside "animate" is not a link tag
  })

  it('gives every gradient and shape that others point at an id of its own', () => {
    const seen = new Map()
    for (const d of DOODLES) {
      for (const [, id] of d.svg.matchAll(/\bid='([^']+)'/g)) {
        expect(seen.has(id), `${d.id} reuses the id "${id}" from ${seen.get(id)}`).toBe(false)
        seen.set(id, d.id)
      }
    }
  })
})

describe('drawing a doodle', () => {
  it('draws every doodle as a valid SVG with something visible in it', () => {
    for (const d of DOODLES) {
      const out = new Resvg(svgOf(d), NO_FONTS).render()
      const painted = [...out.pixels].filter((_, i) => i % 4 === 3 && out.pixels[i] > 40).length
      expect(painted, `${d.id} looks empty`).toBeGreaterThan(60)
    }
  })

  it('wraps a line doodle in the hand-inked line, and leaves the others as drawn', () => {
    expect(doodleMarkup({ line: true, svg: '<path d="M0 0"/>' })).toMatch(
      /^<g fill="none" stroke="#3B2F2B"/,
    )
    expect(doodleMarkup({ svg: '<path d="M0 0"/>' })).toBe('<path d="M0 0"/>')
  })

  it('uses the day’s colors in a doodle that asks for them, and only there', () => {
    const today = findDoodle('bloom-today')
    for (const hex of palette.map((c) => c.hex)) expect(doodleMarkup(today, palette)).toContain(hex)
    expect(doodleMarkup(today, palette)).not.toMatch(/\{c\d\}/)
    const plain = findDoodle('cat')
    expect(doodleMarkup(plain, palette)).toBe(doodleMarkup(plain, [...palette].reverse()))
  })
})

describe('doodles in the sticker tray', () => {
  it('has a Doodles tab with every doodle, in the order of doodles.json', () => {
    const pack = PACKS.find((p) => p.id === 'doodles')
    expect(pack.items.map((i) => i.id)).toEqual(DOODLES.map((d) => `doodle:${d.id}`))
    expect(findSticker('doodle:heart').label).toBe('Heart')
  })

  it('finds the heart first when you search for heart, and the new ones by their words', () => {
    expect(searchStickers('heart')[0].id).toBe('doodle:heart')
    expect(searchStickers('coquette').map((s) => s.id)).toEqual(
      expect.arrayContaining(['doodle:bow', 'doodle:pearls']),
    )
    expect(searchStickers('cottagecore').map((s) => s.id)).toEqual(
      expect.arrayContaining(['doodle:mushroom', 'doodle:daisy']),
    )
  })

  it('lets a doodle take the white edge, but it is not ink and has no tone', () => {
    expect(canOutline('doodle:cat')).toBe(true)
    expect(canTone('doodle:cat')).toBe(false)
    expect(isInk('doodle:cat')).toBe(false)
  })
})
