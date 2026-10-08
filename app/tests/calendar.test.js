import { describe, expect, it } from 'vitest'
import { monthDays, monthLayout } from '../src/lib/calendar'

describe('monthLayout', () => {
  // reference dates from the spec: 1 Sept 2026 is a Tuesday, 1 Oct 2026 is a Thursday
  it('puts a Tuesday the 1st one cell in', () => {
    expect(monthLayout('2026-09')).toMatchObject({ offset: 1, count: 30 })
  })
  it('puts a Thursday the 1st three cells in', () => {
    expect(monthLayout('2026-10')).toMatchObject({ offset: 3, count: 31 })
  })
  it('has no offset when the 1st is a Monday', () => {
    // 1 June 2026 is a Monday
    expect(monthLayout('2026-06').offset).toBe(0)
  })
  it('puts a Sunday the 1st at the end of the row', () => {
    // 1 Feb 2026 is a Sunday
    expect(monthLayout('2026-02')).toMatchObject({ offset: 6, count: 28 })
  })
  it('knows leap Februaries', () => {
    expect(monthLayout('2028-02').count).toBe(29)
    expect(monthLayout('2100-02').count).toBe(28)
  })
  it('rejects a bad month key', () => {
    expect(() => monthLayout('2026-13')).toThrow()
  })
})

describe('monthDays', () => {
  it('lists every day in order', () => {
    const days = monthDays('2026-02')
    expect(days).toHaveLength(28)
    expect(days[0]).toBe('2026-02-01')
    expect(days[27]).toBe('2026-02-28')
  })
})
