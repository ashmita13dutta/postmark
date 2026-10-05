/**
 * Calendar-day helpers. A "day" is a local-calendar 'YYYY-MM-DD' string; timestamps are epoch ms.
 *
 * Day arithmetic goes through UTC so daylight-saving changes can never produce a 23- or
 * 25-hour "day". Anything that needs the real current time takes it from lib/clock.js.
 */
import { now } from './clock'

const pad = (n) => String(n).padStart(2, '0')
const fmt = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`
const utc = (y, m, d) => Date.UTC(y, m - 1, d)

export const MIN_DELIVERY_DAY = 1
export const MAX_DELIVERY_DAY = 28 // 29-31 do not exist in every month

export function isLeapYear(y) {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
}

export function daysInMonth(y, m) {
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

/** Parse and validate 'YYYY-MM-DD'. Throws on malformed or impossible dates (e.g. 2026-02-30). */
export function parseDay(day) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day)
  if (!match) throw new Error(`Invalid day: ${day}`)
  const [y, m, d] = match.slice(1).map(Number)
  if (m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) throw new Error(`Invalid day: ${day}`)
  return { y, m, d }
}

/** Local calendar day for a timestamp. */
export function dayKey(ms) {
  const d = new Date(ms)
  return fmt(d.getFullYear(), d.getMonth() + 1, d.getDate())
}

/** Today's local day, from the app clock (so time travel works). */
export function todayKey() {
  return dayKey(now())
}

/** Timestamp of 00:00 local time on a day. */
export function dayStartMs(day) {
  const { y, m, d } = parseDay(day)
  return new Date(y, m - 1, d).getTime()
}

export function addDays(day, n) {
  const { y, m, d } = parseDay(day)
  const t = new Date(utc(y, m, d + n))
  return fmt(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate())
}

/** Whole days from a to b (positive when b is later). */
export function daysBetween(a, b) {
  const pa = parseDay(a)
  const pb = parseDay(b)
  return Math.round((utc(pb.y, pb.m, pb.d) - utc(pa.y, pa.m, pa.d)) / 86_400_000)
}

/** 'YYYY-MM' for a day. */
export function monthKey(day) {
  parseDay(day)
  return day.slice(0, 7)
}

export function parseMonthKey(key) {
  const match = /^(\d{4})-(\d{2})$/.exec(key)
  if (!match || Number(match[2]) < 1 || Number(match[2]) > 12) {
    throw new Error(`Invalid month key: ${key}`)
  }
  return { y: Number(match[1]), m: Number(match[2]) }
}

export function addMonths(key, n) {
  const { y, m } = parseMonthKey(key)
  const index = y * 12 + (m - 1) + n
  return `${Math.floor(index / 12)}-${pad((index % 12) + 1)}`
}

/** 1 for 1 January. */
export function dayOfYear(day) {
  const { y } = parseDay(day)
  return daysBetween(`${y}-01-01`, day) + 1
}

export function clampDeliveryDay(n) {
  const v = Math.round(Number(n))
  if (!Number.isFinite(v)) return MIN_DELIVERY_DAY
  return Math.min(MAX_DELIVERY_DAY, Math.max(MIN_DELIVERY_DAY, v))
}

/**
 * When a postcard written on `day` is delivered: 00:00 local on `deliveryDay` of the NEXT month.
 * (A postcard written on 31 Dec with delivery day 1 arrives 1 Jan, in the new year.)
 */
export function sealedUntilFor(day, deliveryDay = 1) {
  const next = addMonths(monthKey(day), 1)
  return dayStartMs(`${next}-${pad(clampDeliveryDay(deliveryDay))}`)
}

export const isSealed = (moment, nowMs) => nowMs < moment.sealedUntil
export const isDelivered = (moment, nowMs) => nowMs >= moment.sealedUntil

/** Calendar days from today until a delivery time ("September's mail arrives in N days"). */
export function daysUntil(targetMs, nowMs) {
  return Math.max(0, daysBetween(dayKey(nowMs), dayKey(targetMs)))
}

/**
 * Days whose postcard counts as "exactly one year ago" for `day`.
 * Normally one day. Feb 29 handling (spec 6.4):
 *   - Today is Feb 29: last year had no Feb 29, so look at Feb 28 of last year.
 *   - Today is Feb 28 in a non-leap year after a leap year: also include last year's Feb 29,
 *     so a postcard written on a leap day still comes back every year.
 */
export function yearAgoDays(day) {
  const { y, m, d } = parseDay(day)
  const lastYear = y - 1
  if (m === 2 && d === 29) return [fmt(lastYear, 2, 28)]
  const days = [fmt(lastYear, m, d)]
  if (m === 2 && d === 28 && !isLeapYear(y) && isLeapYear(lastYear)) days.push(fmt(lastYear, 2, 29))
  return days
}
