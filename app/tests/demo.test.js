import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { makeDemo } from '../src/db/demo'
import { makeQueries } from '../src/db/queries'
import { PostmarkDB } from '../src/db/schema'
import { setNow } from '../src/lib/clock'
import { dayKey } from '../src/lib/dates'
import { MAX_DECORATIONS } from '../src/lib/decor'
import { groupByMonth, headlineGroup, yearAgoLetter } from '../src/lib/mailbox'

const NOW = new Date('2026-10-10T10:00').getTime()

let db
let q
let demo
let n = 0

beforeEach(() => {
  db = new PostmarkDB(`demo-${++n}`)
  q = makeQueries(db)
  demo = makeDemo(db)
  setNow(NOW)
})

afterEach(async () => {
  setNow(null)
  await db.delete()
})

describe('demo postcards', () => {
  it('adds delivered postcards for last month, a year ago, and an old opened one', async () => {
    const { added } = await demo.addPostcards(NOW)
    expect(added).toBe(8)
    const delivered = await q.deliveredMoments(NOW)
    expect(delivered).toHaveLength(8) // every one of them is already deliverable
    expect(delivered.every((m) => m.demo === true && m.stampNo === 0)).toBe(true)
    expect(delivered.every((m) => m.sealedAt != null && m.palette.length === 5)).toBe(true)
  })

  it('makes a September to open: last month is the headline, with six unopened postcards', async () => {
    await demo.addPostcards(NOW)
    const groups = groupByMonth(await q.deliveredMoments(NOW))
    const headline = headlineGroup(groups)
    expect(headline.monthKey).toBe('2026-09')
    expect(headline.total).toBe(6)
    expect(headline.opened).toBe(0)
  })

  it('makes a letter from exactly a year ago', async () => {
    await demo.addPostcards(NOW)
    const letter = yearAgoLetter(await q.deliveredMoments(NOW), dayKey(NOW))
    expect(letter?.day).toBe('2025-10-10')
    expect(letter.openedAt).toBeNull()
  })

  it('makes an old opened postcard turn up as this month’s delayed one', async () => {
    await demo.addPostcards(NOW)
    const delayed = await q.delayedForMonth('2026-10', NOW)
    expect(delayed?.demo).toBe(true)
    expect(delayed.openedAt).not.toBeNull()
  })

  it('gives each a wax seal and a few stickers, never more than a card holds', async () => {
    await demo.addPostcards(NOW)
    for (const m of await db.moments.toArray()) {
      expect(await q.getSeal(m.id)).toBeTruthy()
      const decorations = await q.decorationsFor(m.id)
      expect(decorations.length).toBeGreaterThanOrEqual(2)
      expect(decorations.length).toBeLessThanOrEqual(MAX_DECORATIONS)
    }
  })

  it('is safe to run again: it resets instead of piling up', async () => {
    await demo.addPostcards(NOW)
    await demo.addPostcards(NOW)
    expect((await demo.status()).demo).toBe(8)
    expect(await db.moments.count()).toBe(8)
  })

  it('never overwrites one of your own stamps on the same day', async () => {
    const mine = await q.saveMoment('2026-09-12', { note: 'my own real note' })
    const { added } = await demo.addPostcards(NOW)
    expect(added).toBe(7)
    expect((await q.getMoment(mine.id)).note).toBe('my own real note')
    expect((await q.getMoment(mine.id)).demo).toBeUndefined()
  })

  it('keeps your real stamp numbering intact, with and without demo postcards', async () => {
    await demo.addPostcards(NOW)
    expect(await q.nextStampNo()).toBe(1) // demo postcards are number 0
    const first = await q.saveMoment('2026-10-10', { note: 'real' })
    expect(first.stampNo).toBe(1)
    await demo.removeDemo()
    expect(await q.nextStampNo()).toBe(2)
  })

  it('removes only the demo postcards, with their seals and stickers', async () => {
    const mine = await q.saveMoment('2026-10-10', { note: 'real' })
    await demo.addPostcards(NOW)
    const demoIds = (await db.moments.toArray()).filter((m) => m.demo).map((m) => m.id)
    const { removed } = await demo.removeDemo()
    expect(removed).toBe(8)
    expect(await db.moments.count()).toBe(1)
    expect((await q.getMoment(mine.id)).note).toBe('real')
    for (const id of demoIds) {
      expect(await q.getSeal(id)).toBeUndefined()
      expect(await q.decorationsFor(id)).toHaveLength(0)
    }
    expect(await db.redeliveries.count()).toBe(0)
  })

  it('does not take over a delayed-in-transit pick that is already one of yours', async () => {
    const real = await q.saveMoment('2026-01-05', { note: 'a real old one' })
    await db.redeliveries.put({ monthKey: '2026-10', momentId: real.id })
    await demo.addPostcards(NOW)
    expect((await db.redeliveries.get('2026-10')).momentId).toBe(real.id)
  })
})

describe('opening today’s postcard now', () => {
  it('says so when there is no stamp today', async () => {
    expect(await demo.deliverToday(NOW)).toBe('none')
  })

  it('wants the postcard sealed first', async () => {
    await q.saveMoment('2026-10-10', { note: 'not sealed yet' })
    expect(await demo.deliverToday(NOW)).toBe('unsealed')
  })

  it('delivers a sealed postcard at once, and can put its real date back', async () => {
    const m = await q.saveMoment('2026-10-10', { note: 'sealed today' })
    await q.sealMoment(m.id, { color: '#B14126', emblem: 'heart' })
    const realDate = (await q.getMoment(m.id)).sealedUntil
    expect(realDate).toBeGreaterThan(NOW) // really is a month away

    expect(await demo.deliverToday(NOW)).toBe('delivered')
    expect((await q.deliveredMoments(NOW)).map((x) => x.id)).toContain(m.id)
    expect(await demo.deliverToday(NOW)).toBe('already')
    expect(await demo.status()).toEqual({ demo: 0, early: 1 })

    // open it, then remove: it goes back to being sealed and unopened, on its real date
    await q.markOpened(m.id)
    const { restored } = await demo.removeDemo()
    expect(restored).toBe(1)
    const back = await q.getMoment(m.id)
    expect(back.sealedUntil).toBe(realDate)
    expect(back.openedAt).toBeNull()
    expect(back.earlySealedUntil).toBeUndefined()
    expect((await q.deliveredMoments(NOW)).map((x) => x.id)).not.toContain(m.id)
  })
})
