import { Resvg } from '@resvg/resvg-js'
import { describe, expect, it } from 'vitest'
import { PACKS, findSticker, searchStickers } from '../src/data/stickers'
import {
  EDGES,
  LAYER_TYPES,
  SIZES,
  TAPES,
  findTape,
  tapeLayout,
  tapeMarkup,
  tapePath,
} from '../src/data/tapes'
import { seededRng } from '../src/lib/rng'
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
const COLOR = /^(#[0-9A-F]{6}|\{c[0-4]\})$/i

/** A tape drawn alone, the way the browser would see it. */
const svgOf = (tape, uid = 't1') => {
  const { width, height } = tapeLayout(tape)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${tapeMarkup(tape, palette, uid)}</svg>`
}

describe('tapes.json (yours to edit)', () => {
  const designed = TAPES.filter((t) => !/^\d$/.test(t.id))

  it('gives every tape a unique simple id, a name and search words', () => {
    expect(new Set(TAPES.map((t) => t.id)).size).toBe(TAPES.length)
    for (const t of designed) expect(t.id, 'id').toMatch(/^[a-z0-9-]+$/)
    for (const t of TAPES) {
      expect(t.label, `label of ${t.id}`).toBeTruthy()
      expect(Array.isArray(t.keywords ?? []), `keywords of ${t.id}`).toBe(true)
    }
  })

  it('uses only sizes, ends and layer types that exist, with real colors', () => {
    for (const t of TAPES) {
      expect(Object.keys(SIZES), `size of ${t.id}`).toContain(t.size)
      expect(EDGES, `edge of ${t.id}`).toContain(t.edge)
      expect(t.base, `base of ${t.id}`).toMatch(COLOR)
      if ('opacity' in t) {
        expect(t.opacity).toBeGreaterThan(0.3)
        expect(t.opacity).toBeLessThanOrEqual(1)
      }
      for (const layer of t.layers ?? []) {
        expect(LAYER_TYPES, `a layer of ${t.id}`).toContain(layer.type)
        for (const ink of layer.ink ?? []) expect(ink, `ink of ${t.id}`).toMatch(COLOR)
        if ('scale' in layer) expect(layer.scale, `scale of ${t.id}`).toBeGreaterThan(0)
      }
    }
  })

  it('has no stray color slots', () => {
    // only the color values can hold a slot, so look at those and not at the JSON's own braces
    for (const t of TAPES) {
      const colors = [t.base, ...(t.layers ?? []).flatMap((l) => l.ink ?? [])]
      for (const slot of colors.flatMap(slotsIn)) expect(isSlot(slot), t.id).toBe(true)
    }
  })

  it('has real variety: many tapes, every size and every kind of cut end', () => {
    expect(designed.length).toBeGreaterThanOrEqual(25)
    expect(new Set(designed.map((t) => t.size))).toEqual(new Set(Object.keys(SIZES)))
    expect(new Set(designed.map((t) => t.edge))).toEqual(new Set(EDGES))
    const used = new Set(designed.flatMap((t) => (t.layers ?? []).map((l) => l.type)))
    expect(used.size).toBeGreaterThanOrEqual(15)
  })
})

describe('old postcards keep their tapes', () => {
  it('still has tape:0 to tape:4, drawn in the day’s colors', () => {
    for (let i = 0; i < 5; i++) {
      const tape = findTape(String(i))
      expect(tape, `tape ${i}`).toBeTruthy()
      expect(findSticker(`tape:${i}`)).toBeTruthy()
      expect(tapeMarkup(tape, palette, 'u')).toContain(palette[i].hex)
    }
  })

  it('keeps the tape pack as one Tape tab, found by searching washi', () => {
    const pack = PACKS.find((p) => p.id === 'tape')
    expect(pack.label).toBe('Tape')
    expect(pack.items).toHaveLength(TAPES.length)
    expect(searchStickers('washi').length).toBe(TAPES.length)
    expect(searchStickers('gingham').map((s) => s.id)).toContain('tape:gingham-blush')
  })
})

describe('the shape of a tape', () => {
  const numbers = (d) => [...d.matchAll(/-?\d+(?:\.\d+)?/g)].map((m) => Number(m[0]))

  it('has a cut end for every kind of edge, with sane numbers', () => {
    for (const edge of EDGES) {
      const d = tapePath(112, 30, edge, seededRng('x'))
      expect(d.startsWith('M0 0')).toBe(true)
      expect(d.endsWith('Z')).toBe(true)
      expect(d).not.toMatch(/NaN|undefined|Infinity/)
      // the ends only bite in a few pixels: nothing wanders far outside the strip
      for (const n of numbers(d)) {
        expect(n).toBeGreaterThanOrEqual(-6)
        expect(n).toBeLessThanOrEqual(112 + 6)
      }
    }
  })

  it('draws a straight rectangle for a plain cut', () => {
    expect(tapePath(112, 30, 'cut')).toBe('M0 0 H112 V30 H0Z')
  })

  it('tears the same way every time for one tape, and differently for another', () => {
    const a = tapePath(112, 30, 'torn', seededRng('tape:a'))
    expect(tapePath(112, 30, 'torn', seededRng('tape:a'))).toBe(a)
    expect(tapePath(112, 30, 'torn', seededRng('tape:b'))).not.toBe(a)
  })

  it('gives each size its own measurements, and a plain cut to anything it does not know', () => {
    expect(tapeLayout({ size: 'slim', edge: 'wavy' })).toEqual({ ...SIZES.slim, edge: 'wavy' })
    expect(tapeLayout({ size: 'huge', edge: 'frilly' })).toEqual({ ...SIZES.regular, edge: 'cut' })
  })
})

describe('drawing a tape', () => {
  it('draws every tape as a valid SVG that is not empty', () => {
    for (const t of TAPES) {
      const out = new Resvg(svgOf(t), NO_FONTS).render()
      const { width, height } = tapeLayout(t)
      expect(out.width, t.id).toBe(width)
      expect(out.height, t.id).toBe(height)
      // most of the strip is painted
      const painted = [...out.pixels].filter((_, i) => i % 4 === 3 && out.pixels[i] > 40).length
      expect(painted / (width * height), `${t.id} looks empty`).toBeGreaterThan(0.5)
    }
  }, 30000)

  it('leaves no color slot or broken number in the drawing', () => {
    for (const t of TAPES)
      expect(tapeMarkup(t, palette, 'u'), t.id).not.toMatch(/\{c\d\}|NaN|undefined/)
  })

  it('refers only to ids it defines, and defines each id once, so two tapes can share a page', () => {
    for (const t of TAPES) {
      const markup = tapeMarkup(t, palette, 'uid9')
      const ids = [...markup.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1])
      expect(new Set(ids).size, `${t.id} repeats an id`).toBe(ids.length)
      for (const [, ref] of markup.matchAll(/url\(#([^)]+)\)/g)) expect(ids, t.id).toContain(ref)
      for (const id of ids) expect(id.startsWith('uid9'), id).toBe(true)
    }
  })

  it('is the same drawing every time, and changes with the day’s colors only where it uses them', () => {
    const plain = findTape('gingham-blush')
    expect(tapeMarkup(plain, palette, 'u')).toBe(tapeMarkup(plain, palette, 'u'))
    const other = palette.map((c) => ({ ...c, hex: '#123456' }))
    expect(tapeMarkup(plain, other, 'u')).toBe(tapeMarkup(plain, palette, 'u'))
    const today = findTape('2')
    expect(tapeMarkup(today, other, 'u')).not.toBe(tapeMarkup(today, palette, 'u'))
  })

  it('writes the words on a text tape, in capitals unless it says not to', () => {
    expect(tapeMarkup(findTape('airmail'), palette, 'u')).toContain('PAR AVION')
    expect(tapeMarkup(findTape('xoxo-tape'), palette, 'u')).toContain('xoxo')
    expect(
      tapeMarkup(
        { ...findTape('airmail'), layers: [{ type: 'text', text: 'a<b&c' }] },
        palette,
        'u',
      ),
    ).toContain('A&lt;B&amp;C')
  })

  it('ignores a layer type it does not know instead of failing', () => {
    const odd = { ...findTape('gingham-blush'), layers: [{ type: 'unicorns' }] }
    expect(() => new Resvg(svgOf(odd), NO_FONTS).render()).not.toThrow()
  })
})
