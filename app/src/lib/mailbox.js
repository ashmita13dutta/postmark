import { daysBetween, monthKey, yearAgoDays } from './dates'
import { seededRng } from './rng'

/** A postcard has to be opened and at least this old to be "delayed in transit" (spec 6.5). */
export const DELAY_MIN_AGE_DAYS = 60

const byDay = (a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0)

/**
 * Group delivered postcards by month, newest month first, each month's cards in day order.
 * `total` is the full count for the month and `opened` how many have been opened (spec 6.3).
 */
export function groupByMonth(moments) {
  const months = new Map()
  for (const m of moments) {
    const key = monthKey(m.day)
    if (!months.has(key)) months.set(key, [])
    months.get(key).push(m)
  }
  return [...months.entries()]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([key, list]) => {
      const cards = [...list].sort(byDay)
      return {
        monthKey: key,
        moments: cards,
        total: cards.length,
        opened: cards.filter((m) => m.openedAt != null).length,
      }
    })
}

/** The headline month: the most recent one that still has something unopened, or null. */
export function headlineGroup(groups) {
  return groups.find((g) => g.opened < g.total) ?? null
}

/** The soonest delivery still to come (epoch ms), or null when nothing is waiting. */
export function nextDelivery(moments, nowMs) {
  let soonest = null
  for (const m of moments) {
    if (m.sealedUntil > nowMs && (soonest === null || m.sealedUntil < soonest)) {
      soonest = m.sealedUntil
    }
  }
  return soonest
}

/** The delivered postcard written exactly one year before `today`, if there is one (spec 6.4). */
export function yearAgoLetter(delivered, today) {
  const days = yearAgoDays(today)
  return delivered.filter((m) => days.includes(m.day)).sort(byDay)[0] ?? null
}

/** Opened postcards old enough to turn up "delayed in transit". */
export function eligibleForDelay(delivered, today) {
  return delivered
    .filter((m) => m.openedAt != null && daysBetween(m.day, today) > DELAY_MIN_AGE_DAYS)
    .sort(byDay)
}

/**
 * Decide this month's delayed-in-transit postcard: about half of all months have one. Seeded by
 * the month key, so asking again gives the same answer (the caller also stores it).
 */
export function pickDelayed(key, eligible) {
  const rnd = seededRng(`delay:${key}`)
  if (rnd() >= 0.5 || eligible.length === 0) return null
  return eligible[Math.floor(rnd() * eligible.length)]
}
