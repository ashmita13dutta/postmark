import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { makeQueries } from '../src/db/queries'
import { PostmarkDB } from '../src/db/schema'
import { setNow } from '../src/lib/clock'
import {
  DELAY_MIN_AGE_DAYS,
  eligibleForDelay,
  groupByMonth,
  headlineGroup,
  nextDelivery,
  pickDelayed,
  yearAgoLetter,
} from '../src/lib/mailbox'

const at = (iso) => new Date(iso).getTime()
const card = (day, extra = {}) => ({
  id: `m-${day}`,
  day,
  sealedUntil: at('2026-10-01T00:00'),
  openedAt: null,
  ...extra,
})

describe('groupByMonth', () => {
  const groups = groupByMonth([
    card('2026-08-30', { openedAt: 1 }),
    card('2026-09-03'),
    card('2026-09-01', { openedAt: 5 }),
    card('2026-09-20'),
  ])

  it('puts the newest month first and counts every card', () => {
    expect(groups.map((g) => [g.monthKey, g.total])).toEqual([
      ['2026-09', 3],
      ['2026-08', 1],
    ])
  })
  it('orders each month by day and counts opened ones', () => {
    expect(groups[0].moments.map((m) => m.day)).toEqual(['2026-09-01', '2026-09-03', '2026-09-20'])
    expect(groups[0].opened).toBe(1)
    expect(groups[1].opened).toBe(1)
  })
  it('handles nothing delivered', () => {
    expect(groupByMonth([])).toEqual([])
  })
  it('counts all 21 cards of a 21-stamp month, not a subset', () => {
    const days = Array.from({ length: 21 }, (_, i) => `2026-09-${String(i + 1).padStart(2, '0')}`)
    expect(groupByMonth(days.map((d) => card(d)))[0].total).toBe(21)
  })
})

describe('headlineGroup', () => {
  it('is the most recent month with something unopened', () => {
    const groups = groupByMonth([
      card('2026-09-01', { openedAt: 1 }),
      card('2026-08-01'),
      card('2026-07-01'),
    ])
    expect(headlineGroup(groups).monthKey).toBe('2026-08')
  })
  it('is null once everything is opened', () => {
    expect(headlineGroup(groupByMonth([card('2026-09-01', { openedAt: 1 })]))).toBeNull()
    expect(headlineGroup([])).toBeNull()
  })
})

describe('nextDelivery', () => {
  it('finds the soonest delivery still to come', () => {
    const list = [
      card('2026-09-01', { sealedUntil: at('2026-10-01') }),
      card('2026-10-02', { sealedUntil: at('2026-11-01') }),
    ]
    expect(nextDelivery(list, at('2026-09-15'))).toBe(at('2026-10-01'))
    expect(nextDelivery(list, at('2026-10-05'))).toBe(at('2026-11-01'))
    expect(nextDelivery(list, at('2026-11-05'))).toBeNull()
  })
  it('counts a card due exactly now as delivered, not waiting', () => {
    expect(nextDelivery([card('2026-09-01')], at('2026-10-01T00:00'))).toBeNull()
  })
})

describe('yearAgoLetter', () => {
  it('finds the postcard from exactly a year ago', () => {
    const list = [card('2025-10-08'), card('2025-10-09')]
    expect(yearAgoLetter(list, '2026-10-08').day).toBe('2025-10-08')
  })
  it('finds nothing when that day was skipped', () => {
    expect(yearAgoLetter([card('2025-10-09')], '2026-10-08')).toBeNull()
  })
  it('on 29 Feb looks at 28 Feb of the year before', () => {
    expect(yearAgoLetter([card('2027-02-28')], '2028-02-29')?.day).toBe('2027-02-28')
  })
  it("on 28 Feb after a leap year also finds last year's 29 Feb", () => {
    expect(yearAgoLetter([card('2028-02-29')], '2029-02-28')?.day).toBe('2028-02-29')
  })
})

describe('delayed in transit', () => {
  const old = card('2026-06-01', { openedAt: 1 })
  const fresh = card('2026-09-20', { openedAt: 1 })
  const unopened = card('2026-05-01')

  it(`only offers opened postcards older than ${DELAY_MIN_AGE_DAYS} days`, () => {
    expect(eligibleForDelay([old, fresh, unopened], '2026-10-08').map((m) => m.day)).toEqual([
      '2026-06-01',
    ])
  })
  it('needs strictly more than the minimum age', () => {
    // 2026-08-08 to 2026-10-07 is exactly 60 days
    expect(eligibleForDelay([card('2026-08-08', { openedAt: 1 })], '2026-10-07')).toHaveLength(0)
    expect(eligibleForDelay([card('2026-08-08', { openedAt: 1 })], '2026-10-08')).toHaveLength(1)
  })
  it('gives the same answer every time for a month', () => {
    const list = [old, card('2026-06-02', { openedAt: 1 }), card('2026-06-03', { openedAt: 1 })]
    for (const key of ['2026-10', '2026-11', '2026-12']) {
      expect(pickDelayed(key, list)?.id).toBe(pickDelayed(key, list)?.id)
    }
  })
  it('returns nothing without an eligible postcard', () => {
    for (let m = 1; m <= 12; m++) {
      expect(pickDelayed(`2026-${String(m).padStart(2, '0')}`, [])).toBeNull()
    }
  })
  it('happens in roughly half of all months', () => {
    let hits = 0
    for (let y = 2020; y < 2030; y++) {
      for (let m = 1; m <= 12; m++) {
        if (pickDelayed(`${y}-${String(m).padStart(2, '0')}`, [old])) hits++
      }
    }
    expect(hits).toBeGreaterThan(30)
    expect(hits).toBeLessThan(90)
  })
})

describe('allSeals and delayedForMonth', () => {
  let db
  let q
  let n = 0
  beforeEach(() => {
    db = new PostmarkDB(`mailbox-${++n}`)
    q = makeQueries(db)
  })
  afterEach(async () => {
    setNow(null)
    await db.delete()
  })

  it('maps wax seals by postcard id', async () => {
    setNow(at('2026-09-24T21:00'))
    const m = await q.saveMoment('2026-09-24', { note: 'x' })
    await q.sealMoment(m.id, { color: '#B14126', emblem: 'star' })
    expect((await q.allSeals()).get(m.id)).toMatchObject({ emblem: 'star' })
  })

  it('decides once per month and remembers it', async () => {
    // an opened postcard from June, then it is October
    setNow(at('2026-06-10T10:00'))
    const m = await q.saveMoment('2026-06-10', { note: 'old' })
    setNow(at('2026-07-02T10:00'))
    await q.markOpened(m.id)
    setNow(at('2026-10-08T10:00'))
    const first = await q.delayedForMonth('2026-10')
    const row = await db.redeliveries.get('2026-10')
    expect(row).toBeTruthy() // the decision is stored even when it is "none"
    const again = await q.delayedForMonth('2026-10')
    expect(again?.id).toBe(first?.id)
    expect(await db.redeliveries.count()).toBe(1)
    if (first) expect(first.id).toBe(m.id)
  })

  it('is none when nothing is old and opened', async () => {
    setNow(at('2026-10-08T10:00'))
    await q.saveMoment('2026-10-07', { note: 'new' })
    expect(await q.delayedForMonth('2026-10')).toBeNull()
  })
})
