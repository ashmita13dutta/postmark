import { describe, expect, it } from 'vitest'
import { TAUGHT_BOOST, mixSignals } from '../src/engine/reader/mix'
import { PERSONAL, personalBoost, similarity } from '../src/engine/reader/personal'

const ids = ['joyful', 'sad', 'angry']
// a unit vector that makes the given cosine with [1, 0, 0, 0]
const at = (cos) => [cos, Math.sqrt(1 - cos * cos), 0, 0]
const base = [1, 0, 0, 0]

describe('similarity', () => {
  it('is 1 for the same direction and 0 for unrelated ones', () => {
    expect(similarity(base, base)).toBe(1)
    expect(similarity(base, [0, 1, 0, 0])).toBe(0)
  })
})

describe('personalBoost', () => {
  const correction = (feeling, vector = base) => ({ feeling, vector })

  it('does nothing without corrections', () => {
    expect(personalBoost(base, [], ids)).toEqual([0, 0, 0])
  })

  it('gives the full weight to an identical note', () => {
    expect(personalBoost(base, [correction('sad')], ids)).toEqual([0, PERSONAL.weight, 0])
  })

  it('ignores notes at or below the floor (ordinary notes are untouched)', () => {
    expect(personalBoost(at(PERSONAL.floor), [correction('sad')], ids)).toEqual([0, 0, 0])
    expect(personalBoost(at(0.85), [correction('sad')], ids)).toEqual([0, 0, 0])
  })

  it('grows smoothly between the floor and an identical note', () => {
    const low = personalBoost(at(0.94), [correction('sad')], ids)[1]
    const high = personalBoost(at(0.98), [correction('sad')], ids)[1]
    expect(low).toBeGreaterThan(0)
    expect(high).toBeGreaterThan(low)
    expect(high).toBeLessThan(PERSONAL.weight)
  })

  it('adds up several corrections for the same feeling', () => {
    const two = personalBoost(base, [correction('sad'), correction('sad')], ids)
    expect(two[1]).toBe(2 * PERSONAL.weight)
  })

  it('ignores a feeling it does not know and a vector of the wrong size', () => {
    expect(personalBoost(base, [correction('mystified')], ids)).toEqual([0, 0, 0])
    expect(personalBoost(base, [{ feeling: 'sad', vector: [1, 0] }], ids)).toEqual([0, 0, 0])
  })
})

describe('mixSignals', () => {
  const probs = [0.5, 0.3, 0.2]
  const mix = (extra = {}) => mixSignals({ probs, vector: base, ids, ...extra })

  it('is the reader alone when there is nothing else to add', () => {
    const m = mix()
    expect(m.ranked.map((r) => r.id)).toEqual(['joyful', 'sad', 'angry'])
    m.probs.forEach((p, i) => expect(p).toBeCloseTo(probs[i], 6))
  })

  it('returns probabilities that add up to one', () => {
    const m = mix({ taughtFeelings: ['angry'], corrections: [{ feeling: 'sad', vector: base }] })
    expect(m.probs.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10)
  })

  it('lets a taught word overrule an unsure reader', () => {
    expect(mix({ taughtFeelings: ['angry'] }).ranked[0].id).toBe('angry')
  })

  it('does not let a taught word overrule a very sure reader', () => {
    const sure = mixSignals({
      probs: [0.98, 0.01, 0.01],
      vector: base,
      ids,
      taughtFeelings: ['sad'],
    })
    // a taught word adds 3 to the score (about a 20 times shift); the reader was about 98 times sure
    expect(TAUGHT_BOOST).toBeLessThan(Math.log(0.98 / 0.01))
    expect(sure.ranked[0].id).toBe('joyful')
  })

  it('follows your correction for a near-identical note', () => {
    const m = mix({ corrections: [{ feeling: 'sad', vector: at(0.99) }] })
    expect(m.ranked[0].id).toBe('sad')
  })

  it('leaves a note about something else alone', () => {
    const m = mix({ corrections: [{ feeling: 'sad', vector: [0, 1, 0, 0] }] })
    expect(m.ranked[0].id).toBe('joyful')
  })

  it('ignores an unknown taught feeling', () => {
    expect(mix({ taughtFeelings: ['mystified'] }).ranked[0].id).toBe('joyful')
  })
})
