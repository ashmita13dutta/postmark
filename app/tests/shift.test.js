import { describe, expect, it } from 'vitest'
import { feelings } from '../src/data/feelings.json'
import palettes from '../src/data/palettes.json'
import shifts from '../src/data/shifts.json'
import { fallback, topics } from '../src/data/topics.json'
import {
  buildPalette,
  renameSwatch,
  seasonOf,
  setSwatch,
  shiftPalette,
  timeOfDay,
} from '../src/engine/palette'
import { chroma, hexDistance, hexToOklab } from '../src/lib/color'
import { LIMITS } from '../src/lib/contentRules'

const rainy = palettes.sad.find((p) => p.id === 'rain-wet-alley')
const joyful = palettes.joyful.find((p) => p.id === 'joyful-candy-shop-window')
const meanL = (cs) => cs.reduce((s, c) => s + hexToOklab(c).L, 0) / cs.length
const meanC = (cs) => cs.reduce((s, c) => s + chroma(hexToOklab(c)), 0) / cs.length
const day = (n) => `2026-10-${String(n).padStart(2, '0')}`

describe('shifts.json', () => {
  it('every hour of the day belongs to exactly one time-of-day bucket', () => {
    for (let h = 0; h < 24; h++) {
      const owners = Object.entries(shifts.times).filter(([, t]) => t.hours.includes(h))
      expect(owners.length, `hour ${h}`).toBe(1)
    }
  })

  it('has a season table of 12 months for every fallback profile, using seasons that exist', () => {
    expect(Object.keys(shifts.profiles).sort()).toEqual(Object.keys(fallback.profiles).sort())
    for (const [name, table] of Object.entries(shifts.profiles)) {
      for (let m = 1; m <= 12; m++) {
        expect(Object.keys(shifts.seasons), `${name} month ${m}`).toContain(table[m])
      }
    }
  })

  it('shifts are gentle (a nudge, not a repaint)', () => {
    for (const e of [...Object.values(shifts.times), ...Object.values(shifts.seasons)]) {
      expect(Math.abs(e.dL)).toBeLessThanOrEqual(0.06)
      expect(Math.abs(e.dC)).toBeLessThanOrEqual(0.15)
      expect(Math.abs(e.warmth)).toBeLessThanOrEqual(1)
      expect(Math.abs(e.hue)).toBeLessThanOrEqual(15)
    }
  })
})

describe('timeOfDay / seasonOf', () => {
  it('buckets hours and months', () => {
    expect(timeOfDay(2)).toBe('night')
    expect(timeOfDay(6)).toBe('dawn')
    expect(timeOfDay(9)).toBe('morning')
    expect(timeOfDay(13)).toBe('midday')
    expect(timeOfDay(17)).toBe('golden')
    expect(timeOfDay(20)).toBe('evening')
  })

  it('Kolkata has a monsoon, the generic profile has a summer', () => {
    expect(seasonOf(7, 'kolkata')).toBe('monsoon')
    expect(seasonOf(7, 'generic')).toBe('summer')
    expect(seasonOf(7, 'nowhere')).toBe(seasonOf(7, fallback.activeProfile)) // unknown profile
  })
})

describe('shiftPalette', () => {
  const ctx = { hour: 13, month: 4, seed: '2026-04-10' }

  it('returns 5 colors and is deterministic', () => {
    const a = shiftPalette(rainy.colors, ctx)
    expect(a.colors).toHaveLength(5)
    expect(a).toEqual(shiftPalette(rainy.colors, ctx))
  })

  it('two rainy days never look identical', () => {
    const seen = new Set()
    for (let d = 1; d <= 20; d++)
      seen.add(shiftPalette(rainy.colors, { ...ctx, seed: day(d) }).colors.join())
    expect(seen.size).toBeGreaterThan(15)
  })

  it('the same palette looks different at night, in the morning, and at golden hour', () => {
    const at = (hour) => shiftPalette(joyful.colors, { hour, month: 4, seed: 'x' }).colors
    expect(at(2).join()).not.toBe(at(9).join())
    expect(at(9).join()).not.toBe(at(17).join())
  })

  it('night is darker than midday, on average', () => {
    const night = shiftPalette(joyful.colors, { hour: 1, month: 4, seed: 'x' }).colors
    const noon = shiftPalette(joyful.colors, { hour: 13, month: 4, seed: 'x' }).colors
    expect(meanL(night)).toBeLessThan(meanL(noon))
  })

  it('winter is less colorful than summer, on average', () => {
    const winter = shiftPalette(joyful.colors, { hour: 13, month: 1, seed: 'x' }).colors
    const summer = shiftPalette(joyful.colors, { hour: 13, month: 7, seed: 'x' }).colors
    expect(meanC(winter)).toBeLessThan(meanC(summer))
  })

  it('stays close to the original: a nudge, not a repaint', () => {
    for (const hour of [1, 6, 9, 13, 17, 20]) {
      for (const month of [1, 4, 7, 10]) {
        const { colors } = shiftPalette(joyful.colors, { hour, month, seed: 'x', energy: 'vivid' })
        colors.forEach((c, i) => expect(hexDistance(c, joyful.colors[i])).toBeLessThan(0.1))
      }
    }
  })

  it('can be turned down: strength 0 changes nothing', () => {
    const r = shiftPalette(rainy.colors, { ...ctx, strength: 0 })
    expect(r.colors.map((c) => c.toUpperCase())).toEqual(rainy.colors.map((c) => c.toUpperCase()))
  })

  it('never spoils any palette: always 5 distinct colors within the strength limit', () => {
    // every palette, at every time-of-day bucket, in every season, on several days
    const bad = []
    const hours = [1, 6, 9, 13, 17, 20]
    for (const list of Object.values(palettes)) {
      for (const p of list) {
        const cap = p.energy === 'vivid' ? LIMITS.maxChromaVivid : LIMITS.maxChromaSoft
        for (const hour of hours) {
          for (const month of [1, 4, 7, 10]) {
            for (const seed of ['a', 'b']) {
              const { colors } = shiftPalette(p.colors, { hour, month, seed, energy: p.energy })
              if (colors.length !== 5) bad.push(`${p.id}: ${colors.length} colors`)
              for (let i = 0; i < 5; i++) {
                if (chroma(hexToOklab(colors[i])) > cap + 1e-6)
                  bad.push(`${p.id} h${hour} m${month}: too strong`)
                for (let j = i + 1; j < 5; j++) {
                  if (hexDistance(colors[i], colors[j]) < LIMITS.minPair) {
                    bad.push(`${p.id} h${hour} m${month}: ${colors[i]}/${colors[j]} alike`)
                  }
                }
              }
            }
          }
        }
      }
    }
    expect(bad).toEqual([])
  }, 60_000)
})

describe('buildPalette (the whole pipeline)', () => {
  const input = {
    feeling: 'joyful',
    topic: 'shopping',
    energy: 'vivid',
    seed: '2026-10-05',
    hour: 15,
    month: 10,
  }

  it('gives 5 named colors with a source, and says how it was made', () => {
    const r = buildPalette(input)
    expect(r.colors).toHaveLength(5)
    for (const c of r.colors) {
      expect(c.hex).toMatch(/^#[0-9A-F]{6}$/)
      expect(c.name).toBeTruthy()
    }
    expect(r.paletteSource).toBe('moment')
    expect(r.time).toBe('midday')
    expect(r.season).toBe('autumn')
  })

  it('never repeats a color name on one stamp', () => {
    for (const feeling of Object.keys(feelings)) {
      for (const topic of ['shopping', 'exams', 'party', 'autumn', 'food']) {
        const names = buildPalette({ ...input, feeling, topic, energy: undefined }).colors.map(
          (c) => c.name,
        )
        expect(new Set(names).size, `${feeling}/${topic}: ${names}`).toBe(5)
      }
    }
  })

  it('is deterministic for a day, and a different day looks a little different', () => {
    expect(buildPalette(input)).toEqual(buildPalette(input))
    expect(buildPalette({ ...input, seed: '2026-10-06' }).colors.map((c) => c.hex)).not.toEqual(
      buildPalette(input).colors.map((c) => c.hex),
    )
  })

  it('works for every feeling and topic', () => {
    for (const feeling of Object.keys(feelings)) {
      for (const topic of Object.keys(topics)) {
        expect(buildPalette({ ...input, feeling, topic }).colors).toHaveLength(5)
      }
    }
  }, 60_000)

  it('the Kolkata monsoon season changes July compared with the generic profile', () => {
    const generic = buildPalette({ ...input, month: 7, profile: 'generic' })
    const kolkata = buildPalette({ ...input, month: 7, profile: 'kolkata' })
    expect(kolkata.season).toBe('monsoon')
    expect(generic.season).toBe('summer')
    expect(kolkata.colors.map((c) => c.hex)).not.toEqual(generic.colors.map((c) => c.hex))
  })
})

describe('editing a swatch', () => {
  const start = buildPalette({
    feeling: 'sad',
    topic: 'rain',
    seed: 'x',
    hour: 12,
    month: 3,
  }).colors

  it('changing a color renames it to match, and the source becomes manual', () => {
    const r = setSwatch(start, 2, '#b14126')
    expect(r.palette[2]).toEqual({ hex: '#B14126', name: 'Puja Red' })
    expect(r.paletteSource).toBe('manual')
    expect(r.palette.filter((_, i) => i !== 2)).toEqual(start.filter((_, i) => i !== 2))
  })

  it('keeps names unique even when the new color matches a name already on the stamp', () => {
    const used = start[0].name
    const nameHex = start[0].hex
    const r = setSwatch(start, 3, nameHex)
    expect(r.palette[3].name).not.toBe(used)
  })

  it('a hand-typed name wins, and you can rename without changing the color', () => {
    expect(setSwatch(start, 1, '#336699', '  My Blue  ').palette[1].name).toBe('My Blue')
    const r = renameSwatch(start, 4, 'Ananya Special')
    expect(r.palette[4]).toEqual({ hex: start[4].hex, name: 'Ananya Special' })
    expect(r.paletteSource).toBe('manual')
  })

  it('rejects bad input and does not change the original', () => {
    const snapshot = JSON.stringify(start)
    expect(() => setSwatch(start, 0, 'blue')).toThrow('Invalid hex')
    expect(() => setSwatch(start, 9, '#336699')).toThrow('No swatch')
    expect(() => renameSwatch(start, 0, '   ')).toThrow('needs a name')
    expect(JSON.stringify(start)).toBe(snapshot)
  })
})
