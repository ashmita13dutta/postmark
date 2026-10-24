import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PACKS } from '../src/data/stickers'
import { makeQueries } from '../src/db/queries'
import { PostmarkDB } from '../src/db/schema'
import { setNow } from '../src/lib/clock'
import {
  BASE_COVER_PACK,
  COVER_SLOTS,
  cleanCover,
  coverColors,
  coverPackIds,
  coverSlots,
  yearsToClose,
} from '../src/lib/volumes'

const pal = (...hexes) => hexes.map((hex, i) => ({ hex, name: `c${i}` }))
const BLUES = pal('#2F7FD8', '#4B8FE8', '#9AD9F2', '#1F4F9A', '#FFF8EC')
const REDS = pal('#C8402F', '#E5503C', '#F0A090', '#7A1F26', '#F1E8D4')
const m = (day, palette = BLUES, extra = {}) => ({
  day,
  palette,
  feeling: 'joyful',
  topic: null,
  ...extra,
})

describe('yearsToClose', () => {
  it('lists finished years with stamps that have not been closed, oldest first', () => {
    const moments = [m('2026-03-01'), m('2024-12-31'), m('2025-06-06'), m('2027-01-02')]
    expect(yearsToClose(moments, '2027-01-05', [])).toEqual([2024, 2025, 2026])
    expect(yearsToClose(moments, '2027-01-05', [2024, 2026])).toEqual([2025])
  })

  it('does not close the current year, even on 31 December', () => {
    expect(yearsToClose([m('2026-12-30')], '2026-12-31', [])).toEqual([])
    expect(yearsToClose([m('2026-12-30')], '2027-01-01', [])).toEqual([2026])
  })

  it('has nothing to close for a year with no stamps', () => {
    expect(yearsToClose([m('2027-01-02')], '2027-01-05', [])).toEqual([])
  })
})

describe('coverColors', () => {
  it('gives five colors, one per color family, most used first', () => {
    const year = [m('2026-01-01', BLUES), m('2026-01-02', BLUES), m('2026-01-03', REDS)]
    const colors = coverColors(year)
    expect(colors).toHaveLength(5)
    expect(BLUES.map((c) => c.hex)).toContain(colors[0]) // blues are used the most
    expect(colors.some((c) => REDS.some((r) => r.hex === c))).toBe(true)
  })

  it('fills a short year up with paper', () => {
    expect(coverColors([])).toEqual(Array(5).fill('#EDE5D2'))
    expect(
      coverColors([m('2026-01-01', pal('#FFF8EC', '#FFF8EC', '#FFF8EC', '#FFF8EC', '#FFF8EC'))]),
    ).toEqual(Array(5).fill('#EDE5D2'))
  })

  it('is the same whatever order the stamps come in', () => {
    const year = [m('2026-01-01', BLUES), m('2026-01-02', REDS), m('2026-01-03', BLUES)]
    expect(coverColors(year)).toEqual(coverColors([...year].reverse()))
  })
})

describe('coverSlots', () => {
  it('places every slot, the same way each time for a year, differently between years', () => {
    const a = coverSlots(2026)
    expect(a).toHaveLength(COVER_SLOTS)
    expect(a.map((s) => s.slot)).toEqual([0, 1, 2, 3, 4, 5])
    expect(coverSlots(2026)).toEqual(a)
    expect(coverSlots(2027)).not.toEqual(a)
    for (const s of a) {
      expect(s.x).toBeGreaterThan(0)
      expect(s.x).toBeLessThan(1)
      expect(Math.abs(s.rotate)).toBeLessThanOrEqual(8)
    }
  })
})

describe('cleanCover', () => {
  it('keeps one picture sticker per slot and drops the rest', () => {
    expect(
      cleanCover([
        { slot: 2, stickerId: 'img:post/stamp' },
        { slot: 2, stickerId: 'img:post/other' }, // slot already used
        { slot: 9, stickerId: 'img:post/x' }, // no such slot
        { slot: 1, stickerId: 'tape:3' }, // not a picture sticker
        { slot: 0, stickerId: 'img:cozy/candle-jar' },
        null,
        { slot: 'a', stickerId: 'img:x' },
      ]),
    ).toEqual([
      { slot: 0, stickerId: 'img:cozy/candle-jar' },
      { slot: 2, stickerId: 'img:post/stamp' },
    ])
    expect(cleanCover('nope')).toEqual([])
  })
})

describe('coverPackIds', () => {
  it('always offers the base pack, and adds the packs the delivered months were given', () => {
    expect(coverPackIds([], '2026-10-01')).toEqual([BASE_COVER_PACK])
    const august = [1, 2, 3].map((d) => m(`2026-08-0${d}`, BLUES, { topic: 'rain' }))
    const ids = coverPackIds(august, '2026-10-01')
    expect(ids).toEqual(['blue', BASE_COVER_PACK]) // rain -> Monsoon -> the blue pack
  })

  it('only names packs that exist', () => {
    const packs = new Set(PACKS.map((p) => p.id))
    expect(packs.has(BASE_COVER_PACK)).toBe(true)
  })
})

describe('volumes in the database', () => {
  let db
  let q
  let n = 0
  const at = (iso) => new Date(iso).getTime()
  const PALETTE = pal('#111111', '#222222', '#333333', '#444444', '#555555')
  const stamp = (day) => q.saveMoment(day, { note: 'x', palette: PALETTE })

  beforeEach(() => {
    db = new PostmarkDB(`volumes-${++n}`)
    q = makeQueries(db)
    setNow(at('2027-01-02T09:00'))
  })
  afterEach(async () => {
    setNow(null)
    await db.delete()
  })

  it('closes a finished year once, keeping a cover that was already decorated', async () => {
    await stamp('2026-05-05')
    await q.setCover(2026, [{ slot: 0, stickerId: 'img:post/stamp' }])
    expect(await q.closeVolumes('2027-01-02')).toEqual([2026])
    const [row] = await q.allVolumes()
    expect(row).toMatchObject({
      year: 2026,
      closedAt: at('2027-01-02T09:00'),
      coverStickers: [{ slot: 0, stickerId: 'img:post/stamp' }],
    })
    setNow(at('2027-01-09T09:00'))
    expect(await q.closeVolumes('2027-01-09')).toEqual([]) // never twice
    expect((await q.allVolumes())[0].closedAt).toBe(at('2027-01-02T09:00'))
  })

  it('does not close the current year, or a year that only has demo stamps', async () => {
    await stamp('2027-01-01')
    await stamp('2025-05-05')
    await db.moments.where('day').equals('2025-05-05').modify({ demo: true })
    expect(await q.closeVolumes('2027-01-02')).toEqual([])
    expect(await q.allVolumes()).toEqual([])
  })

  it('decorating a cover cleans the list and works before a year is closed', async () => {
    await q.setCover(2027, [
      { slot: 1, stickerId: 'img:cozy/candle-jar' },
      { slot: 1, stickerId: 'img:cozy/other' },
      { slot: 7, stickerId: 'img:cozy/x' },
    ])
    const [row] = await q.allVolumes()
    expect(row).toMatchObject({ year: 2027, closedAt: null })
    expect(row.coverStickers).toEqual([{ slot: 1, stickerId: 'img:cozy/candle-jar' }])
  })
})
