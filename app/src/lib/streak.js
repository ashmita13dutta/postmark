import { addDays } from './dates'

/**
 * Consecutive local days with a stamp, ending today or yesterday: a streak is not broken until a
 * full day is missed. `days` is any list of 'YYYY-MM-DD'; `today` is 'YYYY-MM-DD'.
 */
export function currentStreak(days, today) {
  const have = new Set(days)
  let day = have.has(today) ? today : addDays(today, -1)
  let count = 0
  while (have.has(day)) {
    count++
    day = addDays(day, -1)
  }
  return count
}

/** The longest run of consecutive days anywhere in the list. */
export function longestStreak(days) {
  const sorted = [...new Set(days)].sort()
  let best = 0
  let run = 0
  let prev = null
  for (const day of sorted) {
    run = prev && addDays(prev, 1) === day ? run + 1 : 1
    best = Math.max(best, run)
    prev = day
  }
  return best
}
