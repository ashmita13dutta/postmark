import { describe, expect, it } from 'vitest'
import { feelings } from '../src/data/feelings.json'
import palettes from '../src/data/palettes.json'
import { topics } from '../src/data/topics.json'
import { mixPalette } from '../src/engine/palette'
import { chroma, hexDistance, hexToOklab } from '../src/lib/color'
import { LIMITS } from '../src/lib/contentRules'

const joyful = palettes.joyful.find((p) => p.id === 'joyful-candy-shop-window')
const tired = palettes.tired[0]
const shopping = topics.shopping.accents

const strength = (colors) => Math.max(...colors.map((c) => chroma(hexToOklab(c))))

describe('mixPalette', () => {
  it('returns 5 colors, and is deterministic for the same seed', () => {
    const a = mixPalette(joyful.colors, shopping, '2026-09-24', 'vivid')
    const b = mixPalette(joyful.colors, shopping, '2026-09-24', 'vivid')
    expect(a.colors).toHaveLength(5)
    expect(a).toEqual(b)
  })

  it('different days can give different mixes', () => {
    const seen = new Set()
    for (let d = 1; d <= 20; d++) {
      seen.add(
        mixPalette(
          joyful.colors,
          shopping,
          `2026-09-${String(d).padStart(2, '0')}`,
          'vivid',
        ).colors.join(),
      )
    }
    expect(seen.size).toBeGreaterThan(1)
  })

  it('keeps the darkest and lightest colors of the base as anchors', () => {
    const { colors } = mixPalette(joyful.colors, shopping, 'x', 'vivid')
    const L = (hex) => hexToOklab(hex).L
    const baseSorted = [...joyful.colors].sort((a, b) => L(a) - L(b))
    expect(colors).toContain(baseSorted[0])
    expect(colors).toContain(baseSorted[4])
  })

  it('actually brings in topic accents (changes 2 bands)', () => {
    const r = mixPalette(joyful.colors, shopping, 'x', 'vivid')
    expect(r.mixed).toBe(true)
    expect(r.accentsUsed).toHaveLength(2)
    const changed = r.colors.filter((c, i) => c !== joyful.colors[i])
    expect(changed).toHaveLength(2)
  })

  it('the same topic is muted on a tired day and bright on a joyful day', () => {
    const calm = mixPalette(tired.colors, shopping, 'x', 'soft')
    const happy = mixPalette(joyful.colors, shopping, 'x', 'vivid')
    expect(strength(calm.colors)).toBeLessThanOrEqual(LIMITS.maxChromaSoft)
    expect(strength(happy.colors)).toBeGreaterThan(strength(calm.colors))
  })

  it('never produces two colors that look alike, for every feeling x topic combination', () => {
    // collect failures and assert once: this loop runs ~7,800 mixes, so keep it cheap
    const bad = []
    for (const f of Object.keys(feelings)) {
      for (const base of palettes[f]) {
        for (const t of Object.keys(topics)) {
          const { colors } = mixPalette(base.colors, topics[t].accents, `${f}:${t}`, base.energy)
          if (colors.length !== 5) bad.push(`${base.id} + ${t}: ${colors.length} colors`)
          for (let i = 0; i < 5; i++) {
            for (let j = i + 1; j < 5; j++) {
              if (hexDistance(colors[i], colors[j]) < LIMITS.minPair) {
                bad.push(`${base.id} + ${t}: ${colors[i]} / ${colors[j]} look alike`)
              }
            }
          }
        }
      }
    }
    expect(bad).toEqual([])
  }, 30_000)

  it('returns the base unchanged with no accents, and rejects a bad palette', () => {
    expect(mixPalette(joyful.colors, [], 'x')).toEqual({
      colors: joyful.colors,
      mixed: false,
      accentsUsed: [],
    })
    expect(() => mixPalette(['#000000'], shopping, 'x')).toThrow('5 colors')
  })
})
