import { describe, expect, it } from 'vitest'
import { cleanName, ordinal, profileStats, shouldOnboard, sinceLabel } from '../src/lib/profile'

const m = (day, extra = {}) => ({ id: day, day, ...extra })

describe('profileStats', () => {
  const today = '2026-10-21'

  it('counts your stamps, streaks and first day', () => {
    const stats = profileStats(
      [m('2026-10-19'), m('2026-10-20'), m('2026-10-21'), m('2026-03-01'), m('2026-03-02')],
      today,
    )
    expect(stats).toEqual({
      stamps: 5,
      longestStreak: 3,
      currentStreak: 3,
      memberSince: '2026-03-01',
      cities: 0,
    })
  })

  it('never counts demo postcards', () => {
    const stats = profileStats(
      [m('2026-10-20'), m('2026-01-01', { demo: true }), m('2026-01-02', { demo: true })],
      today,
    )
    expect(stats.stamps).toBe(1)
    expect(stats.memberSince).toBe('2026-10-20')
    expect(stats.longestStreak).toBe(1)
  })

  it('has nothing to say yet with no stamps', () => {
    expect(profileStats([], today)).toEqual({
      stamps: 0,
      longestStreak: 0,
      currentStreak: 0,
      memberSince: null,
      cities: 0,
    })
  })

  it('does not break a streak until a full day is missed', () => {
    expect(profileStats([m('2026-10-19'), m('2026-10-20')], today).currentStreak).toBe(2)
    expect(profileStats([m('2026-10-18')], today).currentStreak).toBe(0)
  })

  it('counts different places once, ignoring case and blanks', () => {
    const stats = profileStats(
      [
        m('2026-10-01', { city: 'Kolkata' }),
        m('2026-10-02', { city: ' kolkata ' }),
        m('2026-10-03', { city: 'Pune' }),
        m('2026-10-04', { city: '' }),
        m('2026-10-05', { city: null }),
      ],
      today,
    )
    expect(stats.cities).toBe(2)
  })
})

describe('sinceLabel', () => {
  it('writes the month and year', () => {
    expect(sinceLabel('2026-10-09')).toBe('Oct 2026')
  })
})

describe('shouldOnboard', () => {
  it('shows the welcome on a brand-new install', () => {
    expect(shouldOnboard({ onboarded: false, realStamps: 0 })).toBe(true)
  })
  it('never shows it to someone who already has stamps', () => {
    expect(shouldOnboard({ onboarded: false, realStamps: 12 })).toBe(false)
  })
  it('does not show it twice', () => {
    expect(shouldOnboard({ onboarded: true, realStamps: 0 })).toBe(false)
  })
  it('waits until both are known, so it never flashes', () => {
    expect(shouldOnboard({ onboarded: undefined, realStamps: 0 })).toBe(false)
    expect(shouldOnboard({ onboarded: false, realStamps: undefined })).toBe(false)
  })
})

describe('cleanName', () => {
  it('tidies spaces and limits the length', () => {
    expect(cleanName('  Ashmita   Dutta ')).toBe('Ashmita Dutta')
    expect(cleanName('x'.repeat(50))).toHaveLength(30)
    expect(cleanName(undefined)).toBe('')
  })
})

describe('ordinal', () => {
  it('writes days the way people say them', () => {
    expect([1, 2, 3, 4, 10, 11, 12, 13, 14, 21, 22, 23, 24, 28].map(ordinal)).toEqual([
      '1st',
      '2nd',
      '3rd',
      '4th',
      '10th',
      '11th',
      '12th',
      '13th',
      '14th',
      '21st',
      '22nd',
      '23rd',
      '24th',
      '28th',
    ])
  })
})
