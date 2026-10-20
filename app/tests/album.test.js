import { describe, expect, it } from 'vitest'
import {
  colorFamily,
  familyHex,
  monthSheet,
  quiltRows,
  roman,
  sameDayAcrossYears,
  volumes,
  yearStats,
} from '../src/lib/album'
import { addDays } from '../src/lib/dates'

const palette = (...hexes) => hexes.map((hex, i) => ({ hex, name: `c${i}` }))
const BLUES = palette('#2F7FD8', '#4B8FE8', '#9AD9F2', '#CDEBFA', '#FFF8EC')
const REDS = palette('#C8402F', '#E5503C', '#F0A090', '#7A1F26', '#F1E8D4')
let counter = 0
const m = (day, extra = {}) => ({
  id: `m${++counter}`,
  day,
  palette: BLUES,
  feeling: 'joyful',
  topic: 'food',
  ...extra,
})
/** Every day from `from` to `to` inclusive. */
const run = (from, to, extra) => {
  const out = []
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(m(d, extra))
  return out
}

describe('roman', () => {
  it('numbers the spines', () => {
    expect([1, 2, 3, 4, 5, 9, 10, 14, 40, 49, 1994].map(roman)).toEqual([
      'I',
      'II',
      'III',
      'IV',
      'V',
      'IX',
      'X',
      'XIV',
      'XL',
      'XLIX',
      'MCMXCIV',
    ])
  })
})

describe('volumes', () => {
  it('is one volume per year that has a stamp, oldest first', () => {
    const v = volumes(
      [m('2026-03-01'), m('2025-12-31'), m('2025-01-02'), m('2026-04-01')],
      '2026-10-15',
    )
    expect(v).toEqual([
      { year: 2025, number: 1, stamps: 2 },
      { year: 2026, number: 2, stamps: 2 },
    ])
  })

  it('always has this year, even with nothing yet', () => {
    expect(volumes([], '2026-10-15')).toEqual([{ year: 2026, number: 1, stamps: 0 }])
  })

  it('keeps a year with no stamps out of the middle', () => {
    const v = volumes([m('2024-05-05'), m('2026-05-05')], '2026-10-15')
    expect(v.map((x) => [x.year, x.number])).toEqual([
      [2024, 1],
      [2026, 2],
    ])
  })
})

describe('quiltRows', () => {
  const today = '2026-10-15'
  const rows = quiltRows(2026, [m('2026-01-01'), m('2026-10-15'), m('2026-10-10')], today)

  it('has twelve months with the right number of days', () => {
    expect(rows).toHaveLength(12)
    expect(rows.map((r) => r.cells.length)).toEqual([
      31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31,
    ])
    expect(rows[1].key).toBe('2026-02')
    expect(rows[11].cells[30].day).toBe('2026-12-31')
  })

  it('marks every day as stamped, blank, today or future', () => {
    const status = (day) => rows[Number(day.slice(5, 7)) - 1].cells[Number(day.slice(8)) - 1].status
    expect(status('2026-01-01')).toBe('stamped')
    expect(status('2026-01-02')).toBe('blank')
    expect(status('2026-10-10')).toBe('stamped')
    expect(status('2026-10-14')).toBe('blank')
    expect(status('2026-10-15')).toBe('stamped') // today, and stamped
    expect(status('2026-10-16')).toBe('future')
    expect(status('2026-12-31')).toBe('future')
  })

  it('calls today "today" until it has a stamp', () => {
    const r = quiltRows(2026, [], today)
    expect(r[9].cells[14].status).toBe('today')
  })

  it('treats a whole past year as past, and a coming year as future', () => {
    expect(
      quiltRows(2025, [], today).every((r) => r.cells.every((c) => c.status === 'blank')),
    ).toBe(true)
    expect(
      quiltRows(2027, [], today).every((r) => r.cells.every((c) => c.status === 'future')),
    ).toBe(true)
  })

  it('carries the stamp itself, so a tap can lift it', () => {
    const stamp = m('2026-05-05')
    expect(quiltRows(2026, [stamp], today)[4].cells[4].moment).toBe(stamp)
  })

  it('handles a leap year', () => {
    expect(quiltRows(2028, [], today)[1].cells).toHaveLength(29)
  })
})

describe('monthSheet', () => {
  it('lays a month on a Monday-first grid, from the real weekday of the 1st', () => {
    // 1 Sept 2026 is a Tuesday (spec 6.8): one blank before it
    const sheet = monthSheet('2026-09', [m('2026-09-03'), m('2026-09-24')], '2026-09-24')
    expect(sheet.offset).toBe(1)
    expect(sheet.cells).toHaveLength(30)
    expect(sheet.stamps).toBe(2)
    expect(monthSheet('2026-10', [], '2026-10-15').offset).toBe(3) // 1 Oct 2026 is a Thursday
    expect(monthSheet('2026-02', [], '2026-10-15').offset).toBe(6) // 1 Feb 2026 is a Sunday
    expect(monthSheet('2026-06', [], '2026-10-15').offset).toBe(0) // 1 Jun 2026 is a Monday
  })
})

describe('sameDayAcrossYears', () => {
  const all = [m('2024-10-15'), m('2025-10-15'), m('2026-10-15'), m('2025-10-14'), m('2025-03-15')]

  it('finds the same date in other years, oldest first', () => {
    expect(sameDayAcrossYears(all, '2026-10-15').map((x) => x.year)).toEqual([2024, 2025, 2026])
  })

  it('finds nothing when there is only one year', () => {
    expect(sameDayAcrossYears([m('2026-10-15')], '2026-10-15')).toHaveLength(1)
    expect(sameDayAcrossYears([], '2026-10-15')).toEqual([])
  })

  it('only matches 29 February in leap years', () => {
    const leap = [m('2024-02-29'), m('2028-02-29'), m('2025-02-28')]
    expect(sameDayAcrossYears(leap, '2028-02-29').map((x) => x.year)).toEqual([2024, 2028])
  })
})

describe('colorFamily', () => {
  it.each([
    ['#2F7FD8', 'Blue'],
    ['#1B6EC2', 'Blue'],
    ['#C8402F', 'Red'],
    ['#7A1F26', 'Red'],
    ['#E58A2B', 'Orange'],
    ['#E7C64B', 'Yellow'],
    ['#4E9A5B', 'Green'],
    ['#3F6B4A', 'Green'],
    ['#2F9C95', 'Teal'],
    ['#7B5BC0', 'Purple'],
    ['#F25C9A', 'Pink'],
    ['#FFB3C8', 'Pink'],
    ['#FF7AB6', 'Pink'],
    ['#E8458B', 'Pink'],
    ['#FFB3A7', 'Pink'],
    ['#B14126', 'Red'],
    ['#D62839', 'Red'],
    ['#8A5A3C', 'Brown'],
    ['#FFF8EC', 'Cream'],
    ['#FFFFFF', 'Cream'],
    ['#9A978F', 'Grey'],
    ['#3A3633', 'Charcoal'],
    ['#000000', 'Charcoal'],
  ])('%s is %s', (hex, family) => {
    expect(colorFamily(hex)).toBe(family)
  })

  it('gives every family a swatch to show', () => {
    for (const name of [
      'Red',
      'Orange',
      'Brown',
      'Yellow',
      'Green',
      'Teal',
      'Blue',
      'Purple',
      'Pink',
    ])
      expect(familyHex(name)).toMatch(/^#[0-9A-F]{6}$/i)
  })
})

describe('yearStats', () => {
  const today = '2026-10-15'

  it('counts stamps, blanks and the days so far', () => {
    const stats = yearStats(2026, run('2026-01-01', '2026-01-31'), today)
    expect(stats.stamps).toBe(31)
    expect(stats.daysSoFar).toBe(288) // 1 Jan to 15 Oct
    expect(stats.blanks).toBe(288 - 31)
  })

  it('counts a past year as a whole year, and a coming year as nothing', () => {
    expect(yearStats(2025, [], today).daysSoFar).toBe(365)
    expect(yearStats(2024, [], today).daysSoFar).toBe(366)
    expect(yearStats(2027, [], today).daysSoFar).toBe(0)
  })

  it('names the most common color, leaving out paper and ink', () => {
    const mixed = [m('2026-01-01', { palette: REDS }), ...run('2026-01-02', '2026-01-04')]
    const stats = yearStats(2026, mixed, today)
    expect(stats.topColor.name).toBe('Blue') // three blue stamps against one red
    expect(stats.topColor.stamps).toBe(3)
    expect(stats.topColor.hex).toBe(familyHex('Blue'))
  })

  it('has no top color when there is nothing', () => {
    expect(yearStats(2026, [], today).topColor).toBeNull()
    expect(
      yearStats(
        2026,
        [
          m('2026-01-01', {
            palette: palette('#FFFFFF', '#000000', '#9A978F', '#FFF8EC', '#3A3633'),
          }),
        ],
        today,
      ).topColor,
    ).toBeNull()
  })

  it('counts rainy days and finds the feeling and topic that came up most', () => {
    const days = [
      m('2026-02-01', { topic: 'rain', feeling: 'sad' }),
      m('2026-02-02', { topic: 'rain', feeling: 'sad' }),
      m('2026-02-03', { topic: 'rain', feeling: 'peaceful' }),
      m('2026-02-04', { topic: 'food', feeling: 'peaceful' }),
      m('2026-02-05', { topic: 'food', feeling: 'sad' }),
    ]
    const stats = yearStats(2026, days, today)
    expect(stats.rainyDays).toBe(3)
    expect(stats.topFeeling).toEqual({ id: 'sad', count: 3 })
    expect(stats.topTopic).toEqual({ id: 'rain', count: 3 })
  })

  it('has no top feeling or topic when there are no stamps', () => {
    const stats = yearStats(2026, [], today)
    expect(stats.topFeeling).toBeNull()
    expect(stats.topTopic).toBeNull()
    expect(stats.stamps).toBe(0)
  })

  it('only counts the year asked for, but the streak right now runs across New Year', () => {
    const days = [...run('2025-12-28', '2026-01-03'), m('2024-06-06')]
    const stats = yearStats(2026, days, '2026-01-04')
    expect(stats.stamps).toBe(3) // 1 to 3 Jan
    expect(stats.longestStreak).toBe(3) // its own days: 1 to 3 Jan
    expect(stats.currentStreak).toBe(7) // today (4 Jan) has none yet, but yesterday does
    expect(yearStats(2025, days, '2026-01-04').longestStreak).toBe(4) // 28 to 31 Dec
  })

  it('does not borrow a streak from another year', () => {
    const days = [...run('2026-03-01', '2026-03-20'), m('2025-06-06')]
    expect(yearStats(2025, days, '2026-10-15').longestStreak).toBe(1)
    expect(yearStats(2026, days, '2026-10-15').longestStreak).toBe(20)
  })

  it('counts a month as complete only when it is over and every day has a stamp', () => {
    const days = [
      ...run('2026-01-01', '2026-01-31'),
      ...run('2026-02-01', '2026-02-27'),
      ...run('2026-10-01', '2026-10-15'),
    ]
    const stats = yearStats(2026, days, today)
    expect(stats.completeMonths).toBe(1) // January; February is missing the 28th; October is not over
  })

  it('does not count the month that is still going on', () => {
    expect(yearStats(2026, run('2026-10-01', '2026-10-31'), '2026-10-31').completeMonths).toBe(0)
    expect(yearStats(2026, run('2026-10-01', '2026-10-31'), '2026-11-01').completeMonths).toBe(1)
  })

  it('reports a streak that ends today', () => {
    const stats = yearStats(2026, run('2026-10-10', '2026-10-15'), today)
    expect(stats.currentStreak).toBe(6)
    expect(stats.longestStreak).toBe(6)
  })
})
