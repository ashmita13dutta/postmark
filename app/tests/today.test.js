import { describe, expect, it } from 'vitest'
import { readNote } from '../src/engine/readNote'
import { currentStreak, longestStreak } from '../src/lib/streak'

describe('currentStreak', () => {
  it('counts back from today', () => {
    expect(currentStreak(['2026-10-03', '2026-10-04', '2026-10-05'], '2026-10-05')).toBe(3)
  })
  it('is not broken until a full day is missed', () => {
    expect(currentStreak(['2026-10-03', '2026-10-04'], '2026-10-05')).toBe(2)
    expect(currentStreak(['2026-10-03'], '2026-10-05')).toBe(0)
  })
  it('stops at a gap', () => {
    expect(currentStreak(['2026-10-01', '2026-10-04', '2026-10-05'], '2026-10-05')).toBe(2)
  })
  it('works across a month and a year boundary', () => {
    expect(currentStreak(['2025-12-30', '2025-12-31', '2026-01-01'], '2026-01-01')).toBe(3)
  })
  it('is 0 with no stamps', () => {
    expect(currentStreak([], '2026-10-05')).toBe(0)
  })
})

describe('longestStreak', () => {
  it('finds the longest run', () => {
    expect(
      longestStreak(['2026-10-01', '2026-10-02', '2026-10-05', '2026-10-06', '2026-10-07']),
    ).toBe(3)
  })
  it('ignores duplicates and order', () => {
    expect(longestStreak(['2026-10-02', '2026-10-01', '2026-10-02'])).toBe(2)
  })
  it('is 0 with no stamps', () => {
    expect(longestStreak([])).toBe(0)
  })
})

describe('readNote', () => {
  const base = { day: '2026-10-05', hour: 15, month: 10 }

  it('reads the note and builds five colors', () => {
    const r = readNote({ ...base, text: 'So happy today, shopping with Riya!' })
    expect(r.feeling).toBe(r.mood.feeling)
    expect(r.built.colors).toHaveLength(5)
    expect(r.corrected).toEqual({ feeling: false, topic: false })
  })

  it('a correction wins over the guess and rebuilds the palette', () => {
    const text = 'Cried harder than she did when she got in!'
    const auto = readNote({ ...base, text })
    const other = auto.feeling === 'grateful' ? 'joyful' : 'grateful'
    const fixed = readNote({ ...base, text, override: { feeling: other } })
    expect(fixed.feeling).toBe(other)
    expect(fixed.mood.feeling).toBe(auto.mood.feeling) // the engine's own reading is kept
    expect(fixed.corrected.feeling).toBe(true)
    expect(fixed.built.colors.map((c) => c.hex)).not.toEqual(auto.built.colors.map((c) => c.hex))
  })

  it('a topic correction is applied too', () => {
    const r = readNote({ ...base, text: 'A day.', override: { topic: 'rain' } })
    expect(r.topic).toBe('rain')
    expect(r.corrected.topic).toBe(true)
  })

  it('ignores a correction that is not a real feeling or topic', () => {
    const r = readNote({
      ...base,
      text: 'So happy today!',
      override: { feeling: 'nope', topic: '' },
    })
    expect(r.feeling).toBe(r.mood.feeling)
    expect(r.corrected).toEqual({ feeling: false, topic: false })
  })

  it('is stable: the same note on the same day makes the same stamp', () => {
    const a = readNote({ ...base, text: 'Rainy day, chai and a book.' })
    const b = readNote({ ...base, text: 'Rainy day, chai and a book.' })
    expect(a.built.colors).toEqual(b.built.colors)
  })
})
