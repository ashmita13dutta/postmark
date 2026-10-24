import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import rewardData from '../src/data/rewards.json'
import { PACKS } from '../src/data/stickers'
import { feelings } from '../src/data/feelings.json'
import { topics } from '../src/data/topics.json'
import { makeQueries } from '../src/db/queries'
import { PostmarkDB } from '../src/db/schema'
import { setNow } from '../src/lib/clock'
import { addDays } from '../src/lib/dates'
import { earnedRewards, monthKeepsake, pastMonths } from '../src/lib/rewards'

const m = (day, extra = {}) => ({ day, feeling: 'joyful', topic: null, ...extra })
/** Every day from `from` to `to` inclusive. */
const run = (from, to, extra) => {
  const out = []
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(m(d, extra))
  return out
}
const kinds = (list) => list.map((r) => r.id)

describe('the rewards data', () => {
  it('points every topic, feeling and the fallback at a sticker pack that exists', () => {
    const packs = new Set(PACKS.map((p) => p.id))
    const pointed = [
      ...Object.values(rewardData.topics),
      ...Object.values(rewardData.feelings),
      rewardData.fallback,
    ]
    for (const entry of pointed) {
      expect(entry.name).toBeTruthy()
      expect(packs.has(entry.pack), `${entry.name} -> ${entry.pack}`).toBe(true)
    }
  })

  it('only names topics and feelings the app knows', () => {
    for (const id of Object.keys(rewardData.topics)) expect(topics[id], id).toBeTruthy()
    for (const id of Object.keys(rewardData.feelings)) expect(feelings[id], id).toBeTruthy()
  })

  it('has a name for every feeling, so a month always gets one', () => {
    expect(Object.keys(rewardData.feelings).sort()).toEqual(Object.keys(feelings).sort())
  })
})

describe('monthKeepsake', () => {
  it('names a rainy month Monsoon', () => {
    const month = [
      m('2026-08-01', { topic: 'rain' }),
      m('2026-08-02', { topic: 'rain' }),
      m('2026-08-05', { topic: 'rain' }),
    ]
    expect(monthKeepsake(month)).toMatchObject({ name: 'Monsoon', packId: 'blue' })
  })

  it('uses the feeling when no topic shows up often enough', () => {
    const month = [
      m('2026-08-01', { topic: 'rain', feeling: 'nostalgic' }),
      m('2026-08-02', { topic: 'food', feeling: 'nostalgic' }),
      m('2026-08-03', { topic: 'work', feeling: 'joyful' }),
    ]
    expect(monthKeepsake(month)).toMatchObject({
      name: 'Looking back',
      because: { kind: 'feeling' },
    })
  })

  it('breaks ties the same way every time', () => {
    const month = [m('2026-08-01', { feeling: 'sad' }), m('2026-08-02', { feeling: 'joyful' })]
    const first = monthKeepsake(month)
    expect(monthKeepsake([...month].reverse())).toEqual(first)
    expect(first.because.id).toBe('joyful') // alphabetical
  })

  it('falls back when nothing was read', () => {
    expect(monthKeepsake([{ day: '2026-08-01' }])).toMatchObject({
      name: 'Postmarked',
      packId: 'post',
    })
  })
})

describe('pastMonths', () => {
  it('leaves out the current month and counts blanks', () => {
    const months = pastMonths([...run('2026-08-01', '2026-08-30'), m('2026-09-02')], '2026-09-24')
    expect(months).toHaveLength(1)
    expect(months[0]).toMatchObject({ key: '2026-08', stamps: 30, blanks: 1 })
  })

  it('counts one stamp a day', () => {
    const months = pastMonths([m('2026-08-01'), m('2026-08-01')], '2026-09-24')
    expect(months[0].stamps).toBe(1)
  })
})

describe('earnedRewards', () => {
  it('gives a complete-month badge only for a past month with no blank days', () => {
    const full = run('2026-08-01', '2026-08-31')
    expect(kinds(earnedRewards(full, '2026-09-24'))).toContain('complete-month:2026-08')
    // the same month with one day missing
    const gap = full.filter((x) => x.day !== '2026-08-15')
    expect(kinds(earnedRewards(gap, '2026-09-24'))).not.toContain('complete-month:2026-08')
    // a month is not complete while it is still going
    expect(kinds(earnedRewards(run('2026-09-01', '2026-09-30'), '2026-09-24'))).not.toContain(
      'complete-month:2026-09',
    )
  })

  it('knows February in a leap year', () => {
    expect(kinds(earnedRewards(run('2028-02-01', '2028-02-28'), '2028-03-05'))).not.toContain(
      'complete-month:2028-02',
    )
    expect(kinds(earnedRewards(run('2028-02-01', '2028-02-29'), '2028-03-05'))).toContain(
      'complete-month:2028-02',
    )
  })

  it('gives the sticker at 7 days in a row and the golden stamp at 20', () => {
    expect(kinds(earnedRewards(run('2026-09-01', '2026-09-06'), '2026-09-24'))).toEqual([])
    expect(kinds(earnedRewards(run('2026-09-01', '2026-09-07'), '2026-09-24'))).toEqual([
      'streak-sticker',
    ])
    expect(kinds(earnedRewards(run('2026-09-01', '2026-09-19'), '2026-09-24'))).toEqual([
      'streak-sticker',
    ])
    expect(kinds(earnedRewards(run('2026-09-01', '2026-09-20'), '2026-09-24'))).toEqual([
      'streak-sticker',
      'golden-stamp',
    ])
  })

  it('does not join days that are not in a row', () => {
    const split = [...run('2026-09-01', '2026-09-10'), ...run('2026-09-12', '2026-09-21')]
    expect(kinds(earnedRewards(split, '2026-09-24'))).toEqual(['streak-sticker'])
  })

  it('gives a month pack to a delivered month with at least 3 stamps', () => {
    const few = [m('2026-08-01'), m('2026-08-02')]
    expect(kinds(earnedRewards(few, '2026-09-24'))).toEqual([])
    const three = [...few, m('2026-08-03')]
    const [pack] = earnedRewards(three, '2026-09-24')
    expect(pack).toMatchObject({
      id: 'month-pack:2026-08',
      kind: 'month-pack',
      monthKey: '2026-08',
    })
    expect(pack.packId).toBeTruthy()
  })

  it('is the same every time', () => {
    const stamps = run('2026-07-01', '2026-08-31').map((x, i) => ({
      ...x,
      topic: i % 2 ? 'rain' : 'food',
    }))
    expect(earnedRewards(stamps, '2026-09-24')).toEqual(
      earnedRewards([...stamps].reverse(), '2026-09-24'),
    )
  })
})

describe('syncRewards', () => {
  let db
  let q
  let n = 0
  const at = (iso) => new Date(iso).getTime()
  const PALETTE = ['#111111', '#222222', '#333333', '#444444', '#555555'].map((hex, i) => ({
    hex,
    name: `c${i}`,
  }))
  const stamp = (day, extra = {}) => q.saveMoment(day, { note: 'x', palette: PALETTE, ...extra })

  beforeEach(() => {
    db = new PostmarkDB(`rewards-${++n}`)
    q = makeQueries(db)
    setNow(at('2026-09-24T21:00'))
  })
  afterEach(async () => {
    setNow(null)
    await db.delete()
  })

  it('remembers a reward once, with when it was earned, and says what is new', async () => {
    for (const x of run('2026-08-01', '2026-08-31')) await stamp(x.day, { topic: 'rain' })
    const first = await q.syncRewards('2026-09-24')
    expect(kinds(first).sort()).toEqual(
      ['complete-month:2026-08', 'golden-stamp', 'month-pack:2026-08', 'streak-sticker'].sort(),
    )
    expect(first.every((r) => r.at === at('2026-09-24T21:00') && r.seen === false)).toBe(true)

    setNow(at('2026-09-25T09:00'))
    expect(await q.syncRewards('2026-09-25')).toEqual([]) // nothing twice
    expect((await q.allRewards()).every((r) => r.at === at('2026-09-24T21:00'))).toBe(true)

    await q.markRewardsSeen()
    expect((await q.allRewards()).every((r) => r.seen)).toBe(true)
  })

  it('does not count demo postcards', async () => {
    for (const x of run('2026-08-01', '2026-08-31')) await stamp(x.day)
    await db.moments.toCollection().modify({ demo: true })
    expect(await q.syncRewards('2026-09-24')).toEqual([])
    expect(await q.allRewards()).toEqual([])
  })
})
