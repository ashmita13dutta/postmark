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
    expect(await demo.status()).toEqual({ demo: 0, own: 0, early: 1 })

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

describe('a demo postcard you write yourself', () => {
  const fields = {
    note: 'Failed the viva. Sat on the stairs and could not stop crying.',
    feeling: 'sad',
    topic: 'exams',
    palette: Array.from({ length: 5 }, (_, i) => ({ hex: `#10${i}0A0`, name: `Swatch ${i}` })),
    paletteSource: 'manual',
  }

  it('lands delivered, unopened and numbered 0, with a wax seal and no stickers yet', async () => {
    const m = await demo.savePostcard({ day: '2026-09-14', ...fields }, NOW)
    expect(m).toMatchObject({ demo: true, custom: true, stampNo: 0, openedAt: null, ...fields })
    expect((await q.deliveredMoments(NOW)).map((x) => x.id)).toContain(m.id)
    expect(m.sealedAt).not.toBeNull()
    expect(await q.getSeal(m.id)).toBeTruthy()
    expect(await q.decorationsFor(m.id)).toHaveLength(0)
  })

  it('can be saved as already opened', async () => {
    const m = await demo.savePostcard({ day: '2026-09-14', opened: true, ...fields }, NOW)
    expect(m.openedAt).toBe(NOW)
  })

  it('turns up in the Mailbox grouped under its month', async () => {
    await demo.savePostcard({ day: '2026-09-14', ...fields }, NOW)
    const headline = headlineGroup(groupByMonth(await q.deliveredMoments(NOW)))
    expect(headline.monthKey).toBe('2026-09')
    expect(headline.total).toBe(1)
  })

  it('only takes a day before today, and never a day holding a real postcard', async () => {
    await expect(demo.savePostcard({ day: '2026-10-10', ...fields }, NOW)).rejects.toThrow(
      /before today/,
    )
    await expect(demo.savePostcard({ day: '2026-11-02', ...fields }, NOW)).rejects.toThrow(
      /before today/,
    )
    const mine = await q.saveMoment('2026-09-12', { note: 'my own real note' })
    await expect(demo.savePostcard({ day: '2026-09-12', ...fields }, NOW)).rejects.toThrow(
      /real postcard/,
    )
    expect((await q.getMoment(mine.id)).note).toBe('my own real note')
  })

  it('refuses a palette that is not five colors, and saves nothing', async () => {
    await expect(
      demo.savePostcard({ day: '2026-09-14', ...fields, palette: fields.palette.slice(0, 3) }, NOW),
    ).rejects.toThrow(/5 palette colors/)
    expect(await db.moments.count()).toBe(0)
    expect(await db.seals.count()).toBe(0)
  })

  it('is changed in place when saved again on the same day, keeping its stickers and wax', async () => {
    const first = await demo.savePostcard({ day: '2026-09-14', ...fields }, NOW)
    await q.addDecoration(first.id, { stickerId: 'doodle:heart' })
    const seal = await q.getSeal(first.id)
    const again = await demo.savePostcard(
      { day: '2026-09-14', ...fields, note: 'Rewritten.', feeling: 'content', opened: true },
      NOW + 1000,
    )
    expect(again.id).toBe(first.id)
    expect(again).toMatchObject({ note: 'Rewritten.', feeling: 'content', openedAt: NOW + 1000 })
    expect(await db.moments.count()).toBe(1)
    expect(await q.decorationsFor(first.id)).toHaveLength(1)
    expect(await q.getSeal(first.id)).toEqual(seal)
  })

  it('can be decorated although it is sealed, unlike a real sealed postcard', async () => {
    const m = await demo.savePostcard({ day: '2026-09-14', ...fields }, NOW)
    await q.addDecoration(m.id, { stickerId: 'doodle:heart' })
    const [deco] = await q.decorationsFor(m.id)
    await q.updateDecoration(deco.id, { rotation: 20 })
    await q.removeDecoration(deco.id)
    expect(await q.decorationsFor(m.id)).toHaveLength(0)

    const real = await q.saveMoment('2026-10-10', { note: 'real' })
    await q.sealMoment(real.id, { color: '#B14126', emblem: 'heart' })
    await expect(q.addDecoration(real.id, { stickerId: 'doodle:heart' })).rejects.toThrow(/sealed/)
  })

  it('survives "Reset the sample postcards", but not "Remove"', async () => {
    const mine = await demo.savePostcard({ day: '2026-09-12', ...fields }, NOW)
    await q.addDecoration(mine.id, { stickerId: 'doodle:heart' })
    const { added } = await demo.addPostcards(NOW)
    expect(added).toBe(7) // the sample on 12 Sep is skipped: that day is yours
    await demo.addPostcards(NOW) // and again
    expect((await q.getMoment(mine.id)).note).toBe(fields.note)
    expect(await q.decorationsFor(mine.id)).toHaveLength(1)
    expect(await demo.status()).toEqual({ demo: 8, own: 1, early: 0 })

    const { removed } = await demo.removeDemo()
    expect(removed).toBe(8)
    expect(await q.getMoment(mine.id)).toBeUndefined()
    expect(await q.decorationsFor(mine.id)).toHaveLength(0)
  })

  it('starts on yesterday, or the nearest earlier day with nothing on it', async () => {
    expect(await demo.freeDay(NOW)).toBe('2026-10-09')
    await q.saveMoment('2026-10-09', { note: 'taken' })
    await demo.savePostcard({ day: '2026-10-08', ...fields }, NOW)
    expect(await demo.freeDay(NOW)).toBe('2026-10-07')
  })

  it('lists the demo postcards, and deletes one without touching a real one', async () => {
    const real = await q.saveMoment('2026-10-09', { note: 'real' })
    const a = await demo.savePostcard({ day: '2026-09-14', ...fields }, NOW)
    await demo.savePostcard({ day: '2026-09-02', ...fields, note: 'Earlier.' }, NOW)
    await q.addDecoration(a.id, { stickerId: 'doodle:heart' })

    const rows = await demo.list()
    expect(rows.map((r) => [r.day, r.own])).toEqual([
      ['2026-09-14', true],
      ['2026-09-02', true],
    ])

    expect(await demo.removeOne(a.id)).toBe(true)
    expect(await q.getSeal(a.id)).toBeUndefined()
    expect(await q.decorationsFor(a.id)).toHaveLength(0)
    expect(await demo.removeOne(real.id)).toBe(false) // not a demo postcard
    expect(await q.getMoment(real.id)).toBeTruthy()
    expect((await demo.list()).map((r) => r.day)).toEqual(['2026-09-02'])
  })
})
