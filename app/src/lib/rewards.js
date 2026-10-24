/**
 * Rewards (spec 6.7), pure so they can be tested: a golden stamp for a streak of 20 days, a sticker
 * for 7, a badge for a month with no blank days, and a named sticker pack for each delivered month.
 * They come from the stamps alone, so they can be worked out again at any time; what the app keeps
 * is only when each was first earned (queries.syncRewards).
 *
 * `moments` are stamps as stored (day, feeling, topic); `today` is a 'YYYY-MM-DD' from lib/clock.js.
 */
import rewardData from '../data/rewards.json'
import { daysInMonth, monthKey, parseDay } from './dates'
import { longestStreak } from './streak'

export const GOLDEN_STREAK = 20
export const STICKER_STREAK = 7

/** The most common value in a list (ties go to the one that comes first alphabetically). */
function mostCommon(values) {
  const counts = new Map()
  for (const v of values) if (v) counts.set(v, (counts.get(v) ?? 0) + 1)
  let best = null
  for (const [v, n] of [...counts].sort(([a], [b]) => (a < b ? -1 : 1)))
    if (!best || n > best.n) best = { v, n }
  return best
}

/**
 * The name and the sticker pack for a month's stamps: the most common topic if it appears often
 * enough, else the most common feeling, else the fallback. Returns { name, packId, because }.
 */
export function monthKeepsake(monthMoments, data = rewardData) {
  const topic = mostCommon(monthMoments.map((m) => m.topic))
  if (topic && topic.n >= data.minTopicCount && data.topics[topic.v]) {
    const { name, pack } = data.topics[topic.v]
    return { name, packId: pack, because: { kind: 'topic', id: topic.v } }
  }
  const feeling = mostCommon(monthMoments.map((m) => m.feeling))
  if (feeling && data.feelings[feeling.v]) {
    const { name, pack } = data.feelings[feeling.v]
    return { name, packId: pack, because: { kind: 'feeling', id: feeling.v } }
  }
  return { name: data.fallback.name, packId: data.fallback.pack, because: null }
}

/** Past months that have stamps: [{ key, stamps, blanks, moments }], oldest first. */
export function pastMonths(moments, today) {
  const thisMonth = monthKey(today)
  const groups = new Map()
  for (const m of moments) {
    const key = monthKey(m.day)
    if (key >= thisMonth) continue
    if (!groups.has(key)) groups.set(key, new Map())
    groups.get(key).set(m.day, m) // one stamp a day
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([key, byDay]) => {
      const { y, m } = parseDay(`${key}-01`)
      return {
        key,
        stamps: byDay.size,
        blanks: daysInMonth(y, m) - byDay.size,
        moments: [...byDay.values()],
      }
    })
}

/**
 * Everything earned so far, as [{ id, kind, monthKey?, packId?, name }]: 'golden-stamp',
 * 'streak-sticker', 'complete-month' and 'month-pack'. Ids are the same every time, so a reward is
 * never counted twice.
 */
export function earnedRewards(moments, today, data = rewardData) {
  const best = longestStreak(moments.map((m) => m.day))
  const out = []
  if (best >= STICKER_STREAK)
    out.push({ id: 'streak-sticker', kind: 'streak-sticker', name: `${STICKER_STREAK}-day streak` })
  if (best >= GOLDEN_STREAK)
    out.push({ id: 'golden-stamp', kind: 'golden-stamp', name: 'Golden stamp' })
  for (const month of pastMonths(moments, today)) {
    if (month.blanks === 0)
      out.push({
        id: `complete-month:${month.key}`,
        kind: 'complete-month',
        monthKey: month.key,
        name: 'Complete month',
      })
    if (month.stamps >= data.minStamps) {
      const { name, packId } = monthKeepsake(month.moments, data)
      out.push({
        id: `month-pack:${month.key}`,
        kind: 'month-pack',
        monthKey: month.key,
        packId,
        name,
      })
    }
  }
  return out
}
