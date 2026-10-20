import { describe, expect, it } from 'vitest'
import { POSTER, posterFacts, posterLayout } from '../src/lib/shareImage'

describe('posterLayout', () => {
  const L = posterLayout()

  it('fits the whole quilt inside the poster, with room for the numbers under it', () => {
    const last = L.cell(11, 30)
    expect(last.x + last.w).toBeLessThanOrEqual(POSTER.width - L.pad + 0.001)
    expect(last.y + last.h).toBeCloseTo(L.quiltBottom)
    expect(L.quiltBottom + 250).toBeLessThan(POSTER.height)
  })

  it('has 31 columns and 12 rows, none of them touching', () => {
    for (let row = 0; row < 12; row++) {
      for (let col = 0; col < 30; col++) {
        const a = L.cell(row, col)
        const next = L.cell(row, col + 1)
        expect(next.x - (a.x + a.w)).toBeCloseTo(L.gap)
      }
    }
    for (let row = 0; row < 11; row++) {
      const a = L.cell(row, 0)
      const below = L.cell(row + 1, 0)
      expect(below.y - (a.y + a.h)).toBeCloseTo(L.gap)
    }
  })

  it('leaves room for the month names on the left', () => {
    expect(L.cell(0, 0).x).toBeGreaterThanOrEqual(L.pad + L.labelW)
    expect(L.label(0).x).toBe(L.pad)
  })

  it('makes a square taller than it is wide, like a little flag', () => {
    expect(L.cellH).toBeGreaterThan(L.cellW)
  })

  it('works for another size', () => {
    const small = posterLayout({ width: 540, height: 675 })
    expect(small.cell(0, 30).x + small.cellW).toBeLessThanOrEqual(540)
  })
})

describe('posterFacts', () => {
  const stats = {
    topColor: { name: 'Yellow' },
    topFeeling: { id: 'peaceful' },
    topTopic: { id: 'rain' },
    longestStreak: 20,
    rainyDays: 1,
  }
  const labels = { feelingLabel: (id) => id.toUpperCase(), topicLabel: (id) => `topic ${id}` }

  it('lists what there is to say, in order', () => {
    expect(posterFacts(stats, labels)).toEqual([
      ['Most common color', 'Yellow'],
      ['Felt most often', 'PEACEFUL'],
      ['Wrote about most', 'topic rain'],
      ['Longest streak', '20 days'],
      ['Rainy days', '1'],
    ])
  })

  it('leaves out what is not known, and says "1 day" for one', () => {
    expect(
      posterFacts(
        { ...stats, topColor: null, topFeeling: null, topTopic: null, longestStreak: 1 },
        labels,
      ),
    ).toEqual([
      ['Longest streak', '1 day'],
      ['Rainy days', '1'],
    ])
  })

  it('needs no label functions', () => {
    expect(posterFacts(stats).map((f) => f[0])).toEqual([
      'Most common color',
      'Longest streak',
      'Rainy days',
    ])
  })
})
