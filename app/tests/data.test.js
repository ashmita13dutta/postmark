// Guards the editable content files in src/data. If you edit them and break a rule,
// `npm test` says exactly what is wrong. `npm run analyze` gives the fuller quality report.
import { describe, expect, it } from 'vitest'
import colorNames from '../src/data/colornames.json'
import moods from '../src/data/moods.json'
import palettes from '../src/data/palettes.json'
import { chroma, hexDistance, hexToOklab } from '../src/lib/color'

const HEX = /^#[0-9A-Fa-f]{6}$/
const families = Object.keys(moods.families)

// Same thresholds as scripts/analyze-content.mjs (OKLab units)
const MIN_PAIR = 0.06 // bands closer than this look like one band
const MIN_RANGE = 0.3 // lightest minus darkest, so the stamp has depth
const MAX_CHROMA = 0.2 // above this starts to look neon
const NAME_MATCH = 0.035 // every palette color needs a name at least this close

describe('moods.json', () => {
  it('has 20 or more families', () => {
    expect(families.length).toBeGreaterThanOrEqual(20)
  })

  it.each(families)('%s: has a label and at least 20 lowercase single-word keywords', (f) => {
    const { label, keywords, hours } = moods.families[f]
    expect(label).toBeTruthy()
    expect(keywords.length).toBeGreaterThanOrEqual(20)
    for (const k of keywords) expect(k, `${f}: "${k}"`).toMatch(/^[a-z]+$/)
    expect(new Set(keywords).size, `${f} repeats a keyword`).toBe(keywords.length)
    for (const h of hours) expect(Number.isInteger(h) && h >= 0 && h <= 23).toBe(true)
  })

  it('no keyword belongs to two families (it would make the result ambiguous)', () => {
    const seen = new Map()
    for (const f of families) {
      for (const k of moods.families[f].keywords) {
        expect(seen.has(k), `"${k}" is in both ${seen.get(k)} and ${f}`).toBe(false)
        seen.set(k, f)
      }
    }
  })

  it('every fallback profile covers all 12 months with real families', () => {
    const { activeProfile, profiles } = moods.fallback
    expect(Object.keys(profiles)).toContain(activeProfile)
    for (const [name, profile] of Object.entries(profiles)) {
      for (let month = 1; month <= 12; month++) {
        expect(families, `${name} month ${month}`).toContain(profile.monthFamily[month])
      }
      expect(families, `${name} default`).toContain(profile.defaultFamily)
    }
  })
})

describe('palettes.json', () => {
  it('has 3 to 8 palettes for every mood family, and nothing for unknown families', () => {
    expect(Object.keys(palettes).sort()).toEqual([...families].sort())
    for (const f of families) {
      expect(palettes[f].length, f).toBeGreaterThanOrEqual(3)
      expect(palettes[f].length, f).toBeLessThanOrEqual(8)
    }
  })

  const all = families.flatMap((f) => palettes[f].map((p) => ({ family: f, ...p })))

  it('every palette has a unique id, a name, a harmony note, and 5 valid hex colors', () => {
    const ids = new Set()
    for (const p of all) {
      expect(ids.has(p.id), `duplicate id ${p.id}`).toBe(false)
      ids.add(p.id)
      expect(p.name, p.id).toBeTruthy()
      expect(p.harmony, p.id).toBeTruthy()
      expect(p.colors, p.id).toHaveLength(5)
      for (const h of p.colors) expect(h, `${p.id}: ${h}`).toMatch(HEX)
    }
  })

  it.each(all.map((p) => [p.id, p]))(
    '%s: five distinguishable, non-neon colors with depth',
    (_id, p) => {
      const labs = p.colors.map(hexToOklab)
      for (let i = 0; i < 5; i++) {
        for (let j = i + 1; j < 5; j++) {
          const d = hexDistance(p.colors[i], p.colors[j])
          expect(
            d,
            `${p.colors[i]} and ${p.colors[j]} look too alike (${d.toFixed(3)})`,
          ).toBeGreaterThanOrEqual(MIN_PAIR)
        }
      }
      const range = Math.max(...labs.map((l) => l.L)) - Math.min(...labs.map((l) => l.L))
      expect(range, 'needs a darker or lighter color').toBeGreaterThanOrEqual(MIN_RANGE)
      for (const [i, l] of labs.entries()) {
        expect(chroma(l), `${p.colors[i]} is too saturated`).toBeLessThanOrEqual(MAX_CHROMA)
      }
    },
  )
})

describe('colornames.json', () => {
  it('has at least 300 names', () => {
    expect(colorNames.length).toBeGreaterThanOrEqual(300)
  })

  it('every entry has a name and a valid hex, with no duplicates', () => {
    const names = new Set()
    const hexes = new Set()
    for (const c of colorNames) {
      expect(c.name, JSON.stringify(c)).toBeTruthy()
      expect(c.hex, c.name).toMatch(HEX)
      expect(names.has(c.name.toLowerCase()), `duplicate name ${c.name}`).toBe(false)
      expect(hexes.has(c.hex.toUpperCase()), `duplicate hex ${c.hex} (${c.name})`).toBe(false)
      names.add(c.name.toLowerCase())
      hexes.add(c.hex.toUpperCase())
    }
  })

  it('includes the sample names from the design', () => {
    const names = colorNames.map((c) => c.name)
    for (const n of [
      'Late Tram Grey',
      'Jhalmuri Orange',
      'Wet Alley Blue',
      'Kadam Yellow',
      'Puja Red',
    ]) {
      expect(names).toContain(n)
    }
  })

  it('every palette color has a close-matching name', () => {
    for (const list of Object.values(palettes)) {
      for (const p of list) {
        for (const hex of p.colors) {
          const best = Math.min(...colorNames.map((c) => hexDistance(hex, c.hex)))
          expect(best, `${p.id}: ${hex} needs a color name nearby`).toBeLessThanOrEqual(NAME_MATCH)
        }
      }
    }
  })

  it('covers the whole color wheel, not just reds and oranges', () => {
    const buckets = new Array(8).fill(0)
    for (const c of colorNames) {
      const lab = hexToOklab(c.hex)
      if (chroma(lab) < 0.03) continue
      const h = (Math.atan2(lab.b, lab.a) * 180) / Math.PI
      buckets[Math.floor(((h + 360) % 360) / 45)]++
    }
    for (const [i, n] of buckets.entries())
      expect(n, `hue ${i * 45}-${i * 45 + 45}`).toBeGreaterThanOrEqual(15)
  })
})
