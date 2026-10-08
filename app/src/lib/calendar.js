import { daysInMonth, parseMonthKey } from './dates'

const pad = (n) => String(n).padStart(2, '0')

/**
 * Layout of a month on a Monday-first grid. The leading offset comes from the real weekday of the
 * 1st (spec 6.8): 0 means the 1st is a Monday, 6 means it is a Sunday. Computed in UTC so the
 * answer never depends on the device's time zone.
 */
export function monthLayout(key) {
  const { y, m } = parseMonthKey(key)
  const sundayFirst = new Date(Date.UTC(y, m - 1, 1)).getUTCDay()
  return { y, m, offset: (sundayFirst + 6) % 7, count: daysInMonth(y, m) }
}

/** Every day of a month as 'YYYY-MM-DD', in order. */
export function monthDays(key) {
  const { y, m, count } = monthLayout(key)
  return Array.from({ length: count }, (_, i) => `${y}-${pad(m)}-${pad(i + 1)}`)
}
