// Guards the editable content files in src/data. If you edit them and break a rule,
// `npm test` says exactly what is wrong.
import { describe, expect, it } from 'vitest'
import colorNames from '../src/data/colornames.json'
import moods from '../src/data/moods.json'
import palettes from '../src/data/palettes.json'

const HEX = /^#[0-9A-Fa-f]{6}$/
const families = Object.keys(moods.families)

describe('moods.json', () => {
  it('has 12 families', () => {
    expect(families).toHaveLength(12)
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

  it('fallback covers every month with a real family', () => {
    for (let month = 1; month <= 12; month++) {
      expect(families).toContain(moods.fallback.monthFamily[month])
    }
    expect(families).toContain(moods.fallback.defaultFamily)
  })
})

describe('palettes.json', () => {
  it('has 3 or 4 palettes for every mood family, and nothing for unknown families', () => {
    expect(Object.keys(palettes).sort()).toEqual([...families].sort())
    for (const f of families) {
      expect(palettes[f].length, f).toBeGreaterThanOrEqual(3)
      expect(palettes[f].length, f).toBeLessThanOrEqual(4)
    }
  })

  it('every palette has a unique id, a name, and 5 distinct valid hex colors', () => {
    const ids = new Set()
    for (const f of families) {
      for (const p of palettes[f]) {
        expect(ids.has(p.id), `duplicate id ${p.id}`).toBe(false)
        ids.add(p.id)
        expect(p.name, p.id).toBeTruthy()
        expect(p.colors, p.id).toHaveLength(5)
        for (const h of p.colors) expect(h, `${p.id}: ${h}`).toMatch(HEX)
        expect(new Set(p.colors.map((h) => h.toUpperCase())).size, `${p.id} repeats a color`).toBe(5)
      }
    }
  })
})

describe('colornames.json', () => {
  it('has at least 180 names', () => {
    expect(colorNames.length).toBeGreaterThanOrEqual(180)
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
    for (const n of ['Late Tram Grey', 'Jhalmuri Orange', 'Wet Alley Blue', 'Kadam Yellow', 'Puja Red']) {
      expect(names).toContain(n)
    }
  })
})
