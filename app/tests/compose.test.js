import { describe, expect, it } from 'vitest'
import { defaultFeeling, feelings } from '../src/data/feelings.json'
import palettes from '../src/data/palettes.json'
import { topics } from '../src/data/topics.json'
import { composePalette, pickPalette } from '../src/engine/palette'

const seeds = Array.from({ length: 40 }, (_, i) => `2026-09-${String(i + 1).padStart(2, '0')}`)

describe('pickPalette', () => {
  it('is deterministic', () => {
    expect(pickPalette('joyful', 'shopping', 'a')).toEqual(pickPalette('joyful', 'shopping', 'a'))
  })

  it('prefers a palette made for the topic when the feeling has one', () => {
    for (const seed of seeds) {
      expect(pickPalette('excited', 'party', seed).palette.topics).toContain('party')
      expect(pickPalette('loving', 'dating', seed).palette.topics).toContain('dating')
      expect(pickPalette('content', 'autumn', seed).palette.topics).toContain('autumn')
      expect(pickPalette('peaceful', 'winter', seed).palette.topics).toContain('winter')
    }
  })

  it('never uses a palette made for a different topic on an unrelated day', () => {
    for (const seed of seeds) {
      const { palette, tagged } = pickPalette('excited', 'shopping', seed)
      expect(tagged).toBe(false)
      expect(palette.topics ?? []).toEqual([])
    }
  })

  it('falls back to the default feeling for an unknown feeling', () => {
    const { palette } = pickPalette('nonsense', null, 'x')
    expect(palettes[defaultFeeling]).toContainEqual(palette)
  })

  it('every feeling can always produce a palette, with or without a topic', () => {
    for (const f of Object.keys(feelings)) {
      for (const topic of [null, 'shopping', 'party', 'food', 'autumn']) {
        expect(pickPalette(f, topic, 'x').palette.colors).toHaveLength(5)
      }
    }
  })
})

describe('composePalette', () => {
  it('uses the topic palette as-is when it is made for the topic', () => {
    const r = composePalette({ feeling: 'loving', topic: 'dating', seed: 'a' })
    expect(r.tagged).toBe(true)
    expect(r.mixed).toBe(false)
    expect(r.colors).toEqual(r.palette.colors)
  })

  it('mixes in topic accents when the palette is general', () => {
    const r = composePalette({ feeling: 'joyful', topic: 'shopping', seed: 'a' })
    expect(r.tagged).toBe(false)
    expect(r.mixed).toBe(true)
    expect(r.colors).not.toEqual(r.palette.colors)
  })

  it('works with no topic at all', () => {
    const r = composePalette({ feeling: 'sad', seed: 'a' })
    expect(r.mixed).toBe(false)
    expect(r.colors).toEqual(r.palette.colors)
  })

  it('good food and bad food look different', () => {
    const good = composePalette({ feeling: 'joyful', topic: 'food', seed: 'a' })
    const bad = composePalette({ feeling: 'disappointed', topic: 'food', seed: 'a' })
    expect(bad.palette.id).toMatch(/^badfood-/)
    expect(good.palette.id).not.toMatch(/^badfood-/)
  })
})

describe('palette topic tags', () => {
  it('only reference real topics', () => {
    for (const list of Object.values(palettes)) {
      for (const p of list) {
        for (const t of p.topics ?? []) expect(Object.keys(topics), `${p.id}: ${t}`).toContain(t)
      }
    }
  })

  it('there are themed sets for party, dating, friends, food, travel, autumn and winter', () => {
    const tagged = new Map()
    for (const list of Object.values(palettes)) {
      for (const p of list) for (const t of p.topics ?? []) tagged.set(t, (tagged.get(t) ?? 0) + 1)
    }
    const need = { party: 5, dating: 5, friends: 5, food: 8, travel: 4, autumn: 8, winter: 8 }
    for (const [t, n] of Object.entries(need)) {
      expect(tagged.get(t) ?? 0, t).toBeGreaterThanOrEqual(n)
    }
  })
})
