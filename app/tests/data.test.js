// Guards the editable content files in src/data. If you edit them and break a rule,
// `npm test` says exactly what is wrong. `npm run analyze` gives the fuller quality report.
import { describe, expect, it } from 'vitest'
import colorNames from '../src/data/colornames.json'
import { feelings, defaultFeeling } from '../src/data/feelings.json'
import palettes from '../src/data/palettes.json'
import { topics, fallback } from '../src/data/topics.json'
import { chroma, hexDistance, hexToOklab } from '../src/lib/color'
import { LIMITS } from '../src/lib/contentRules'

const HEX = /^#[0-9A-Fa-f]{6}$/
const feelingIds = Object.keys(feelings)
const topicIds = Object.keys(topics)

describe('feelings.json', () => {
  it('has 12 or more feelings and a valid default', () => {
    expect(feelingIds.length).toBeGreaterThanOrEqual(12)
    expect(feelingIds).toContain(defaultFeeling)
  })

  it.each(feelingIds)('%s: has a label, a blurb and 20+ lowercase single-word keywords', (id) => {
    const { label, blurb, keywords } = feelings[id]
    expect(label).toBeTruthy()
    expect(blurb).toBeTruthy()
    expect(keywords.length).toBeGreaterThanOrEqual(20)
    for (const k of keywords) expect(k, `${id}: "${k}"`).toMatch(/^[a-z]+$/)
    expect(new Set(keywords).size, `${id} repeats a keyword`).toBe(keywords.length)
  })
})

describe('topics.json', () => {
  it('has 50 or more topics', () => {
    expect(topicIds.length).toBeGreaterThanOrEqual(50)
  })

  it.each(topicIds)('%s: label, group, 3 accents, and 8+ lowercase single-word keywords', (id) => {
    const t = topics[id]
    expect(t.label).toBeTruthy()
    expect(t.group).toBeTruthy()
    expect(t.accents, `${id} accents`).toHaveLength(3)
    for (const a of t.accents) expect(a, `${id}: ${a}`).toMatch(HEX)
    expect(t.keywords.length).toBeGreaterThanOrEqual(8)
    for (const k of t.keywords) expect(k, `${id}: "${k}"`).toMatch(/^[a-z]+$/)
    expect(new Set(t.keywords).size, `${id} repeats a keyword`).toBe(t.keywords.length)
    for (const h of t.hours ?? []) expect(Number.isInteger(h) && h >= 0 && h <= 23).toBe(true)
  })

  it('accents within a topic are clearly different and not neon', () => {
    for (const id of topicIds) {
      const a = topics[id].accents
      for (let i = 0; i < 3; i++) {
        expect(chroma(hexToOklab(a[i])), `${id}: ${a[i]} too saturated`).toBeLessThanOrEqual(
          LIMITS.maxChromaVivid,
        )
        for (let j = i + 1; j < 3; j++) {
          expect(
            hexDistance(a[i], a[j]),
            `${id}: ${a[i]} and ${a[j]} look alike`,
          ).toBeGreaterThanOrEqual(LIMITS.minAccentPair)
        }
      }
    }
  })

  it('every fallback profile covers all 12 months with real topics', () => {
    expect(Object.keys(fallback.profiles)).toContain(fallback.activeProfile)
    for (const [name, profile] of Object.entries(fallback.profiles)) {
      for (let m = 1; m <= 12; m++)
        expect(topicIds, `${name} month ${m}`).toContain(profile.monthTopic[m])
    }
  })
})

describe('keywords across feelings and topics', () => {
  it('no word belongs to two entries (it would make the result ambiguous)', () => {
    const seen = new Map()
    const claim = (kind, id, words) => {
      for (const w of words) {
        expect(seen.has(w), `"${w}" is in both ${seen.get(w)} and ${kind}:${id}`).toBe(false)
        seen.set(w, `${kind}:${id}`)
      }
    }
    for (const id of feelingIds) claim('feeling', id, feelings[id].keywords)
    for (const id of topicIds) claim('topic', id, topics[id].keywords)
    expect(seen.size).toBeGreaterThan(1400)
  })
})

describe('palettes.json', () => {
  it('has palettes for every feeling, and nothing for unknown feelings', () => {
    expect(Object.keys(palettes).sort()).toEqual([...feelingIds].sort())
    for (const f of feelingIds) expect(palettes[f].length, f).toBeGreaterThanOrEqual(4)
  })

  const all = feelingIds.flatMap((f) => palettes[f].map((p) => ({ feeling: f, ...p })))

  it('every palette has a unique id, name, harmony note, energy, and 5 valid hex colors', () => {
    const ids = new Set()
    for (const p of all) {
      expect(ids.has(p.id), `duplicate id ${p.id}`).toBe(false)
      ids.add(p.id)
      expect(p.name, p.id).toBeTruthy()
      expect(p.harmony, p.id).toBeTruthy()
      expect(['soft', 'vivid'], p.id).toContain(p.energy)
      expect(p.colors, p.id).toHaveLength(5)
      for (const h of p.colors) expect(h, `${p.id}: ${h}`).toMatch(HEX)
    }
  })

  it('has a good supply of vivid, feel-good palettes for joyful days', () => {
    const joyfulVivid = palettes.joyful.filter((p) => p.energy === 'vivid')
    expect(joyfulVivid.length).toBeGreaterThanOrEqual(8)
  })

  it.each(all.map((p) => [p.id, p]))(
    '%s: five distinguishable colors with depth, within its energy limit',
    (_id, p) => {
      const labs = p.colors.map(hexToOklab)
      for (let i = 0; i < 5; i++) {
        for (let j = i + 1; j < 5; j++) {
          const d = hexDistance(p.colors[i], p.colors[j])
          expect(
            d,
            `${p.colors[i]} and ${p.colors[j]} look too alike (${d.toFixed(3)})`,
          ).toBeGreaterThanOrEqual(LIMITS.minPair)
        }
      }
      const range = Math.max(...labs.map((l) => l.L)) - Math.min(...labs.map((l) => l.L))
      expect(range, 'needs a darker or lighter color').toBeGreaterThanOrEqual(LIMITS.minRange)
      const top = Math.max(...labs.map(chroma))
      const cap = p.energy === 'vivid' ? LIMITS.maxChromaVivid : LIMITS.maxChromaSoft
      expect(top, `too saturated for ${p.energy}`).toBeLessThanOrEqual(cap)
      if (p.energy === 'vivid') {
        expect(top, 'tagged vivid but nothing is bright; call it soft').toBeGreaterThanOrEqual(
          LIMITS.minChromaVivid,
        )
      }
    },
  )
})

describe('colornames.json', () => {
  it('has at least 400 names', () => {
    expect(colorNames.length).toBeGreaterThanOrEqual(400)
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

  it('every palette color and topic accent has a close-matching name', () => {
    const hexes = [
      ...Object.values(palettes).flatMap((l) => l.flatMap((p) => p.colors)),
      ...topicIds.flatMap((id) => topics[id].accents),
    ]
    for (const hex of hexes) {
      const best = Math.min(...colorNames.map((c) => hexDistance(hex, c.hex)))
      expect(best, `${hex} needs a color name nearby`).toBeLessThanOrEqual(LIMITS.nameMatch)
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
    for (const [i, n] of buckets.entries()) {
      expect(n, `hue ${i * 45}-${i * 45 + 45}`).toBeGreaterThanOrEqual(15)
    }
  })
})
