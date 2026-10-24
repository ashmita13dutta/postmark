/**
 * Volumes (spec 6.10), pure so they can be tested: one per calendar year. When a year is over the
 * album closes in a small ceremony, once. This works out which years are due, what a volume's cover
 * is made of, and which stickers can go on it.
 *
 * `moments` are stamps as stored; `today` is a 'YYYY-MM-DD' from lib/clock.js.
 */
import { colorFamily } from './album'
import { seededRng } from './rng'
import { earnedRewards } from './rewards'

export const COVER_SLOTS = 6
/** The sticker pack always offered for a cover, even before any month has been delivered. */
export const BASE_COVER_PACK = 'post'

const NEUTRALS = new Set(['Cream', 'Grey', 'Charcoal'])
const PAPER = '#EDE5D2'

/** The years that are over, have at least one stamp, and have not had their ceremony yet. Oldest first. */
export function yearsToClose(moments, today, closedYears) {
  const thisYear = Number(today.slice(0, 4))
  const closed = new Set(closedYears)
  return [...new Set(moments.map((m) => Number(m.day.slice(0, 4))))]
    .filter((y) => y < thisYear && !closed.has(y))
    .sort((a, b) => a - b)
}

/**
 * Five colors for a volume's cover: the year's most used colors, one per family (so it is not five
 * blues), leaving out paper and ink. Short years are filled up with paper.
 */
export function coverColors(yearMoments) {
  const byFamily = new Map() // family -> Map(hex -> count)
  for (const m of yearMoments)
    for (const c of m.palette ?? []) {
      const family = colorFamily(c.hex)
      if (NEUTRALS.has(family)) continue
      const hexes = byFamily.get(family) ?? new Map()
      hexes.set(c.hex, (hexes.get(c.hex) ?? 0) + 1)
      byFamily.set(family, hexes)
    }
  const ranked = [...byFamily.entries()]
    .map(([family, hexes]) => {
      const total = [...hexes.values()].reduce((a, b) => a + b, 0)
      const [hex] = [...hexes.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0]
      return { family, hex, total }
    })
    .sort((a, b) => b.total - a.total || (a.family < b.family ? -1 : 1))
    .slice(0, 5)
    .map((r) => r.hex)
  while (ranked.length < 5) ranked.push(PAPER)
  return ranked
}

/** Where the six sticker slots sit on a cover, as fractions of its width and height, with a tilt. */
export function coverSlots(year) {
  const rnd = seededRng(`cover:${year}`)
  // below the label (it fills the top third) and clear of the spine; the seal may sit over the last two
  const spots = [
    [0.42, 0.46],
    [0.78, 0.5],
    [0.44, 0.64],
    [0.8, 0.68],
    [0.4, 0.82],
    [0.76, 0.84],
  ]
  return spots.map(([x, y], slot) => ({
    slot,
    x: x + (rnd() - 0.5) * 0.04,
    y: y + (rnd() - 0.5) * 0.03,
    rotate: Math.round((rnd() - 0.5) * 16),
  }))
}

/** Keep only well-formed cover stickers: one picture sticker per slot, in range. */
export function cleanCover(list) {
  const seen = new Set()
  const out = []
  for (const s of Array.isArray(list) ? list : []) {
    const slot = Number(s?.slot)
    if (!Number.isInteger(slot) || slot < 0 || slot >= COVER_SLOTS || seen.has(slot)) continue
    if (typeof s.stickerId !== 'string' || !s.stickerId.startsWith('img:')) continue
    seen.add(slot)
    out.push({ slot, stickerId: s.stickerId })
  }
  return out.sort((a, b) => a.slot - b.slot)
}

/**
 * The sticker packs a volume's cover can use: the pack each delivered month of that year was
 * given (see lib/rewards.js), plus one that is always there. Pack ids, no repeats.
 */
export function coverPackIds(yearMoments, today) {
  const packs = earnedRewards(yearMoments, today)
    .filter((r) => r.kind === 'month-pack')
    .map((r) => r.packId)
  return [...new Set([...packs, BASE_COVER_PACK])]
}
