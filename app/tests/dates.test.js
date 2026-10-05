import { afterEach, describe, expect, it } from 'vitest'
import { setNow } from '../src/lib/clock'
import {
  addDays,
  addMonths,
  clampDeliveryDay,
  dayKey,
  dayOfYear,
  dayStartMs,
  daysBetween,
  daysInMonth,
  daysUntil,
  isDelivered,
  isLeapYear,
  isSealed,
  monthKey,
  parseDay,
  sealedUntilFor,
  todayKey,
  yearAgoDays,
} from '../src/lib/dates'

const at = (iso) => new Date(iso).getTime() // no Z: local time

afterEach(() => setNow(null))

describe('parseDay', () => {
  it('accepts real dates', () => {
    expect(parseDay('2026-09-24')).toEqual({ y: 2026, m: 9, d: 24 })
    expect(parseDay('2028-02-29')).toEqual({ y: 2028, m: 2, d: 29 })
  })

  it('rejects malformed and impossible dates', () => {
    for (const bad of [
      '2026-9-24',
      '2026-02-30',
      '2027-02-29',
      '2026-13-01',
      '2026-00-10',
      'x',
      '',
    ]) {
      expect(() => parseDay(bad), bad).toThrow()
    }
  })
})

describe('calendar facts', () => {
  it('leap years', () => {
    expect([2024, 2028, 2000].every(isLeapYear)).toBe(true)
    expect([2026, 2027, 1900, 2100].some(isLeapYear)).toBe(false)
  })

  it('days in month', () => {
    expect(daysInMonth(2026, 9)).toBe(30)
    expect(daysInMonth(2026, 10)).toBe(31)
    expect(daysInMonth(2026, 2)).toBe(28)
    expect(daysInMonth(2028, 2)).toBe(29)
  })

  it('day of year', () => {
    expect(dayOfYear('2026-01-01')).toBe(1)
    expect(dayOfYear('2026-09-24')).toBe(267) // matches "Day 267" in the mockup
    expect(dayOfYear('2026-12-31')).toBe(365)
    expect(dayOfYear('2028-12-31')).toBe(366)
  })
})

describe('day arithmetic', () => {
  it('addDays crosses months and years', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29')
  })

  it('daysBetween is signed and whole', () => {
    expect(daysBetween('2026-09-24', '2026-10-01')).toBe(7)
    expect(daysBetween('2026-10-01', '2026-09-24')).toBe(-7)
    expect(daysBetween('2026-01-01', '2027-01-01')).toBe(365)
  })

  it('addMonths wraps years in both directions', () => {
    expect(addMonths('2026-12', 1)).toBe('2027-01')
    expect(addMonths('2026-01', -1)).toBe('2025-12')
    expect(addMonths('2026-09', 14)).toBe('2027-11')
  })

  it('monthKey', () => {
    expect(monthKey('2026-09-24')).toBe('2026-09')
  })
})

describe('local day <-> timestamp', () => {
  it('round-trips', () => {
    expect(dayKey(dayStartMs('2026-09-24'))).toBe('2026-09-24')
  })

  it('23:59 and 00:00 fall on different days', () => {
    expect(dayKey(at('2026-09-24T23:59:59'))).toBe('2026-09-24')
    expect(dayKey(at('2026-09-25T00:00:00'))).toBe('2026-09-25')
  })

  it('todayKey follows the app clock', () => {
    setNow(at('2026-10-01T09:00'))
    expect(todayKey()).toBe('2026-10-01')
  })
})

describe('sealing and delivery', () => {
  it('is 00:00 on the 1st of the next month by default', () => {
    expect(sealedUntilFor('2026-09-24')).toBe(at('2026-10-01T00:00'))
    expect(sealedUntilFor('2026-09-01')).toBe(at('2026-10-01T00:00'))
    expect(sealedUntilFor('2026-09-30')).toBe(at('2026-10-01T00:00'))
  })

  it('December rolls into January of the next year', () => {
    expect(sealedUntilFor('2026-12-31')).toBe(at('2027-01-01T00:00'))
  })

  it('respects a custom delivery day', () => {
    expect(sealedUntilFor('2026-09-24', 15)).toBe(at('2026-10-15T00:00'))
    expect(sealedUntilFor('2026-01-31', 28)).toBe(at('2026-02-28T00:00'))
  })

  it('clamps delivery day to 1..28', () => {
    expect(clampDeliveryDay(0)).toBe(1)
    expect(clampDeliveryDay(31)).toBe(28)
    expect(clampDeliveryDay('12')).toBe(12)
    expect(clampDeliveryDay(NaN)).toBe(1)
    expect(sealedUntilFor('2026-01-10', 31)).toBe(at('2026-02-28T00:00'))
  })

  it('sealed one millisecond before, delivered exactly at the boundary', () => {
    const moment = { sealedUntil: sealedUntilFor('2026-09-24') }
    const boundary = at('2026-10-01T00:00')
    expect(isSealed(moment, boundary - 1)).toBe(true)
    expect(isDelivered(moment, boundary - 1)).toBe(false)
    expect(isSealed(moment, boundary)).toBe(false)
    expect(isDelivered(moment, boundary)).toBe(true)
  })

  it('counts calendar days until delivery', () => {
    const target = at('2026-10-01T00:00')
    expect(daysUntil(target, at('2026-09-24T21:00'))).toBe(7)
    expect(daysUntil(target, at('2026-09-30T23:59'))).toBe(1)
    expect(daysUntil(target, at('2026-10-01T09:00'))).toBe(0)
    expect(daysUntil(target, at('2026-11-01T09:00'))).toBe(0) // never negative
  })
})

describe('yearAgoDays', () => {
  it('is the same date one year earlier', () => {
    expect(yearAgoDays('2026-09-24')).toEqual(['2025-09-24'])
  })

  it('Feb 29 looks at Feb 28 of the previous year', () => {
    expect(yearAgoDays('2028-02-29')).toEqual(['2027-02-28'])
  })

  it('Feb 28 after a leap year also returns last leap day', () => {
    expect(yearAgoDays('2029-02-28')).toEqual(['2028-02-28', '2028-02-29'])
  })

  it('Feb 28 in other years is a single day', () => {
    expect(yearAgoDays('2027-02-28')).toEqual(['2026-02-28'])
    expect(yearAgoDays('2028-02-28')).toEqual(['2027-02-28']) // leap year, so no extra
  })
})
