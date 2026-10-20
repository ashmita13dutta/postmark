/**
 * The Album's logic, pure so it can be tested: the year as a quilt of days, month sheets, volumes
 * (one per calendar year), "this day across years", and the "year so far" numbers (spec 6.9).
 *
 * A "moment" is a stamp as stored; only its `day`, `palette`, `feeling` and `topic` are read here.
 * `today` is a 'YYYY-MM-DD' from lib/clock.js, so time travel and tests work.
 */
import { monthDays, monthLayout } from './calendar'
import { chroma, hexToOklab, hue } from './color'
import { daysInMonth, parseDay } from './dates'
import { currentStreak, longestStreak } from './streak'

const pad = (n) => String(n).padStart(2, '0')

/** 1 -> "I", 4 -> "IV", 12 -> "XII": the number on a volume's spine. */
export function roman(n) {
  const table = [
    [1000, 'M'],
    [900, 'CM'],
    [500, 'D'],
    [400, 'CD'],
    [100, 'C'],
    [90, 'XC'],
    [50, 'L'],
    [40, 'XL'],
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ]
  let out = ''
  for (const [value, symbol] of table)
    while (n >= value) {
      out += symbol
      n -= value
    }
  return out
}

/**
 * The volumes, oldest first: one per calendar year that has a stamp, plus this year even when it has
 * none yet. [{ year, number, stamps }], number 1 = "Volume I".
 */
export function volumes(moments, today) {
  const thisYear = parseDay(today).y
  const counts = new Map([[thisYear, 0]])
  for (const m of moments) {
    const y = Number(m.day.slice(0, 4))
    counts.set(y, (counts.get(y) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([year, stamps], i) => ({ year, number: i + 1, stamps }))
}

/**
 * The year as twelve rows of days, for the quilt. Each cell is { day, moment, status } with status
 * 'stamped', 'blank' (a past day with no stamp), 'today' (not stamped yet) or 'future'.
 */
export function quiltRows(year, moments, today) {
  const byDay = new Map(moments.map((m) => [m.day, m]))
  return Array.from({ length: 12 }, (_, i) => {
    const key = `${year}-${pad(i + 1)}`
    return {
      key,
      month: i + 1,
      cells: monthDays(key).map((day) => cell(day, byDay, today)),
    }
  })
}

function cell(day, byDay, today) {
  const moment = byDay.get(day) ?? null
  const status = moment ? 'stamped' : day === today ? 'today' : day < today ? 'blank' : 'future'
  return { day, moment, status }
}

/** One month as a Monday-first sheet: { key, offset, cells, stamps }. */
export function monthSheet(key, moments, today) {
  const byDay = new Map(moments.map((m) => [m.day, m]))
  const cells = monthDays(key).map((day) => cell(day, byDay, today))
  return {
    key,
    offset: monthLayout(key).offset,
    cells,
    stamps: cells.filter((c) => c.moment).length,
  }
}

/**
 * The same day in other years, once there are two or more volumes: [{ year, moment }] oldest first,
 * only for years that have a stamp that day. 29 February only matches leap years.
 */
export function sameDayAcrossYears(moments, today) {
  const { m, d } = parseDay(today)
  const suffix = `-${pad(m)}-${pad(d)}`
  return moments
    .filter((x) => x.day.endsWith(suffix))
    .map((x) => ({ year: Number(x.day.slice(0, 4)), moment: x }))
    .sort((a, b) => a.year - b.year)
}

// ---- colors ----

/** A swatch to show for each family. */
const FAMILY_HEX = {
  Red: '#C8402F',
  Orange: '#E58A2B',
  Brown: '#8A5A3C',
  Yellow: '#E7C64B',
  Green: '#4E9A5B',
  Teal: '#2F9C95',
  Blue: '#3F6FCB',
  Purple: '#7B5BC0',
  Pink: '#E27CA3',
  Cream: '#F1E8D4',
  Grey: '#9A978F',
  Charcoal: '#3B3835',
}
/** Cream, grey and charcoal are the paper and ink of a stamp, not its color. */
const NEUTRALS = new Set(['Cream', 'Grey', 'Charcoal'])

/**
 * The family a color belongs to, by its hue in OKLab: "Blue", "Pink", "Brown"... Colors with hardly
 * any chroma are Cream, Grey or Charcoal by lightness.
 */
export function colorFamily(hex) {
  const lab = hexToOklab(hex)
  const L = lab.L
  if (chroma(lab) < 0.035) return L > 0.85 ? 'Cream' : L < 0.35 ? 'Charcoal' : 'Grey'
  const h = hue(lab)
  // pinks sit at about 350 to 10 degrees (hot pink is 358), reds start at about 20 (Puja red is 35);
  // a pale salmon is a pink too
  if (h >= 340 || h < 12) return L >= 0.55 ? 'Pink' : 'Red'
  if (h < 45) return L >= 0.82 ? 'Pink' : 'Red'
  if (h < 75) return L < 0.58 ? 'Brown' : 'Orange'
  if (h < 115) return L < 0.55 ? 'Brown' : 'Yellow'
  if (h < 175) return 'Green'
  if (h < 225) return 'Teal'
  if (h < 275) return 'Blue'
  return 'Purple'
}

export const familyHex = (name) => FAMILY_HEX[name]

// ---- the year so far ----

const top = (counts) => {
  let best = null
  for (const [id, n] of counts) if (!best || n > best.count) best = { id, count: n }
  return best
}

/**
 * Numbers for the "year so far" card. `moments` may span several years; only `year` is counted,
 * including the longest streak (a run that crosses New Year counts in each year only for its days in
 * that year). The streak "right now" is about today, so it runs across New Year.
 */
export function yearStats(year, moments, today) {
  const mine = moments.filter((m) => m.day.startsWith(`${year}-`))
  const allDays = moments.map((m) => m.day)
  const lastDay = today < `${year}-12-31` ? today : `${year}-12-31`
  const daysSoFar =
    lastDay < `${year}-01-01`
      ? 0
      : Math.round((Date.UTC(...ymd(lastDay)) - Date.UTC(year, 0, 1)) / 86_400_000) + 1

  // the most common color: every color of every stamp, by family, leaving out paper and ink
  const families = new Map()
  const stampsWith = new Map()
  for (const m of mine) {
    const seen = new Set()
    for (const c of m.palette) {
      const f = colorFamily(c.hex)
      if (NEUTRALS.has(f)) continue
      families.set(f, (families.get(f) ?? 0) + 1)
      seen.add(f)
    }
    for (const f of seen) stampsWith.set(f, (stampsWith.get(f) ?? 0) + 1)
  }
  const bestFamily = top(families)

  const feelings = new Map()
  const topics = new Map()
  for (const m of mine) {
    if (m.feeling) feelings.set(m.feeling, (feelings.get(m.feeling) ?? 0) + 1)
    if (m.topic) topics.set(m.topic, (topics.get(m.topic) ?? 0) + 1)
  }

  // a month is complete when it is over and every one of its days has a stamp
  const have = new Set(mine.map((m) => m.day))
  let completeMonths = 0
  for (let month = 1; month <= 12; month++) {
    const end = `${year}-${pad(month)}-${pad(daysInMonth(year, month))}`
    if (end >= today) break
    if (monthDays(`${year}-${pad(month)}`).every((d) => have.has(d))) completeMonths++
  }

  return {
    stamps: mine.length,
    daysSoFar,
    blanks: Math.max(0, daysSoFar - mine.length),
    rainyDays: mine.filter((m) => m.topic === 'rain').length,
    topColor: bestFamily && {
      name: bestFamily.id,
      hex: FAMILY_HEX[bestFamily.id],
      stamps: stampsWith.get(bestFamily.id),
    },
    topFeeling: top(feelings),
    topTopic: top(topics),
    longestStreak: longestStreak(mine.map((m) => m.day)),
    currentStreak: currentStreak(allDays, today),
    completeMonths,
  }
}

function ymd(day) {
  const { y, m, d } = parseDay(day)
  return [y, m - 1, d]
}
