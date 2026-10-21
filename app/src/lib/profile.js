/**
 * The numbers on the You screen's postmaster card, and the rule for when to show the welcome.
 * Pure. "Real" stamps are the ones you made; demo postcards from the testing tools never count.
 */
import { parseDay } from './dates'
import { currentStreak, longestStreak } from './streak'

/**
 * @returns {{ stamps: number, longestStreak: number, currentStreak: number, memberSince: string | null,
 *             cities: number }}
 *  memberSince is the day of the first stamp; cities counts the different places stamps were made.
 */
export function profileStats(moments, today) {
  const real = moments.filter((m) => m.demo !== true)
  const days = real.map((m) => m.day).sort()
  const cities = new Set(real.map((m) => m.city?.trim().toLowerCase()).filter(Boolean))
  return {
    stamps: real.length,
    longestStreak: longestStreak(days),
    currentStreak: currentStreak(days, today),
    memberSince: days[0] ?? null,
    cities: cities.size,
  }
}

/** "Oct 2026", for a postal-ID style "member since". */
export function sinceLabel(day) {
  const { y, m, d } = parseDay(day)
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
}

/**
 * Show the welcome on a brand-new install only: it has not been completed AND there are no real
 * stamps. Someone who already has stamps never sees it, even if the setting was never written.
 * `onboarded` and `realStamps` are undefined while they load.
 */
export function shouldOnboard({ onboarded, realStamps }) {
  if (onboarded === undefined || realStamps === undefined) return false
  return onboarded === false && realStamps === 0
}

/** A name you typed, tidied: spaces collapsed, at most 30 letters. */
export function cleanName(name) {
  return String(name ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 30)
}

/** 1 -> "1st", 2 -> "2nd", 3 -> "3rd", 11 -> "11th", 22 -> "22nd". */
export function ordinal(n) {
  const teen = n % 100 >= 11 && n % 100 <= 13
  const suffix = teen ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] ?? 'th')
  return `${n}${suffix}`
}
