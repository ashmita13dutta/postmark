import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { BLANK_PALETTE } from '../src/db/moments'
import { SealedError, SETTING_DEFAULTS, makeQueries } from '../src/db/queries'
import { PostmarkDB, SCHEMA_VERSION } from '../src/db/schema'
import { setNow } from '../src/lib/clock'

const at = (iso) => new Date(iso).getTime()
const PALETTE = [
  { hex: '#3A5771', name: 'Wet Alley Blue' },
  { hex: '#5B6470', name: 'Late Tram Grey' },
  { hex: '#B6C7D6', name: 'Mizzle Mist' },
  { hex: '#E7C64B', name: 'Kadam Yellow' },
  { hex: '#B14126', name: 'Puja Red' },
]

let db
let q
let n = 0

beforeEach(() => {
  db = new PostmarkDB(`test-${++n}`) // fresh, isolated database per test
  q = makeQueries(db)
  setNow(at('2026-09-24T21:00'))
})

afterEach(async () => {
  setNow(null)
  await db.delete()
})

describe('schema', () => {
  it('declares version 3 with all tables', () => {
    expect(SCHEMA_VERSION).toBe(3)
    expect(db.tables.map((t) => t.name).sort()).toEqual(
      [
        'calendarStickers',
        'corrections',
        'customStickers',
        'decorations',
        'drawings',
        'lexicon',
        'media',
        'moments',
        'redeliveries',
        'rewards',
        'seals',
        'settings',
        'unlocks',
        'volumes',
      ].sort(),
    )
  })
})

describe('settings', () => {
  it('returns defaults until changed', async () => {
    expect(await q.getSetting('deliveryDay')).toBe(1)
    expect(await q.getSetting('stripFrames')).toBe(3)
    expect(await q.getSettings()).toEqual(SETTING_DEFAULTS)
  })

  it('stores and reads back', async () => {
    await q.setSetting('homeCity', 'Kolkata')
    await q.setSetting('soundOn', false)
    expect(await q.getSetting('homeCity')).toBe('Kolkata')
    expect((await q.getSettings()).soundOn).toBe(false)
  })

  it('rejects unknown keys and bad strip frame counts', async () => {
    await expect(q.setSetting('nope', 1)).rejects.toThrow('Unknown setting')
    await expect(q.setSetting('stripFrames', 5)).rejects.toThrow()
    await q.setSetting('stripFrames', 4)
    expect(await q.getSetting('stripFrames')).toBe(4)
  })
})

describe('saving a moment', () => {
  it('creates stamp number 1 with a sealedUntil on the 1st of next month', async () => {
    const m = await q.saveMoment('2026-09-24', { note: 'Rain at Elgin crossing', palette: PALETTE })
    expect(m).toMatchObject({
      day: '2026-09-24',
      stampNo: 1,
      note: 'Rain at Elgin crossing',
      sealedAt: null,
      openedAt: null,
      createdAt: at('2026-09-24T21:00'),
      sealedUntil: at('2026-10-01T00:00'),
    })
    expect(m.palette).toHaveLength(5)
  })

  it('uses a blank 5-color palette until one is given', async () => {
    const m = await q.saveMoment('2026-09-24', { note: 'x' })
    expect(m.palette).toEqual(BLANK_PALETTE)
  })

  it('numbers stamps sequentially', async () => {
    await q.saveMoment('2026-09-22', { note: 'a' })
    await q.saveMoment('2026-09-23', { note: 'b' })
    const c = await q.saveMoment('2026-09-24', { note: 'c' })
    expect(c.stampNo).toBe(3)
    expect(await q.countMoments()).toBe(3)
  })

  it('one stamp per day: saving again edits the same moment', async () => {
    const first = await q.saveMoment('2026-09-24', { note: 'first' })
    setNow(at('2026-09-24T22:30'))
    const second = await q.saveMoment('2026-09-24', { note: 'edited', city: 'Kolkata' })
    expect(second.id).toBe(first.id)
    expect(second.stampNo).toBe(first.stampNo)
    expect(second.createdAt).toBe(first.createdAt)
    expect(second.updatedAt).toBe(at('2026-09-24T22:30'))
    expect(second).toMatchObject({ note: 'edited', city: 'Kolkata' })
    expect(await q.countMoments()).toBe(1)
  })

  it('ignores fields that are not editable', async () => {
    const m = await q.saveMoment('2026-09-24', {
      note: 'x',
      id: 'hacked',
      stampNo: 99,
      sealedUntil: 0,
      sealedAt: 1,
    })
    expect(m.id).not.toBe('hacked')
    expect(m.stampNo).toBe(1)
    expect(m.sealedUntil).toBe(at('2026-10-01T00:00'))
    expect(m.sealedAt).toBeNull()
  })

  it('rejects a palette that is not 5 colors', async () => {
    await expect(q.saveMoment('2026-09-24', { palette: PALETTE.slice(0, 4) })).rejects.toThrow('5')
  })

  it('looks moments up by day and by month', async () => {
    await q.saveMoment('2026-08-31', { note: 'a' })
    await q.saveMoment('2026-09-01', { note: 'b' })
    await q.saveMoment('2026-09-30', { note: 'c' })
    await q.saveMoment('2026-10-01', { note: 'd' })
    expect((await q.getMomentByDay('2026-09-01')).note).toBe('b')
    expect(await q.getMomentByDay('2026-09-02')).toBeUndefined()
    expect((await q.momentsInMonth('2026-09')).map((m) => m.day)).toEqual([
      '2026-09-01',
      '2026-09-30',
    ])
    expect((await q.allMoments()).map((m) => m.day)).toHaveLength(4)
  })
})

describe('sealing', () => {
  it('seals, stores the wax seal, and blocks further edits', async () => {
    const m = await q.saveMoment('2026-09-24', { note: 'x' })
    const sealed = await q.sealMoment(m.id, { color: '#B14126', emblem: 'heart' })
    expect(sealed.sealedAt).toBe(at('2026-09-24T21:00'))
    expect(await db.seals.get(m.id)).toMatchObject({ color: '#B14126', emblem: 'heart' })
    await expect(q.saveMoment('2026-09-24', { note: 'too late' })).rejects.toBeInstanceOf(
      SealedError,
    )
    expect((await q.getMoment(m.id)).note).toBe('x')
  })

  it('sealing twice keeps the first seal time', async () => {
    const m = await q.saveMoment('2026-09-24', { note: 'x' })
    await q.sealMoment(m.id)
    setNow(at('2026-09-25T10:00'))
    const again = await q.sealMoment(m.id)
    expect(again.sealedAt).toBe(at('2026-09-24T21:00'))
  })

  it('fails for an unknown moment', async () => {
    await expect(q.sealMoment('nope')).rejects.toThrow('No such moment')
  })
})

describe('delivery and opening', () => {
  it('a postcard is delivered exactly at the 1st of next month', async () => {
    await q.saveMoment('2026-09-24', { note: 'x' })
    expect(await q.deliveredMoments(at('2026-09-30T23:59'))).toHaveLength(0)
    expect(await q.deliveredMoments(at('2026-10-01T00:00'))).toHaveLength(1)
  })

  it('cannot be opened before delivery, can after (milestone 2 check)', async () => {
    const m = await q.saveMoment('2026-09-24', { note: 'x' })
    await expect(q.markOpened(m.id)).rejects.toThrow('not been delivered')
    setNow(at('2026-10-01T09:00'))
    const opened = await q.markOpened(m.id)
    expect(opened.openedAt).toBe(at('2026-10-01T09:00'))
  })

  it('opening twice keeps the first time', async () => {
    const m = await q.saveMoment('2026-09-24', { note: 'x' })
    setNow(at('2026-10-01T09:00'))
    await q.markOpened(m.id)
    setNow(at('2026-10-02T09:00'))
    expect((await q.markOpened(m.id)).openedAt).toBe(at('2026-10-01T09:00'))
  })
})

describe('changing the delivery day', () => {
  it('re-times only postcards that have not been delivered', async () => {
    await q.saveMoment('2026-08-20', { note: 'august' }) // delivered on 1 Sep
    await q.saveMoment('2026-09-24', { note: 'september' }) // pending
    expect(await q.setDeliveryDay(15)).toBe(15)

    expect((await q.getMomentByDay('2026-08-20')).sealedUntil).toBe(at('2026-09-01T00:00'))
    expect((await q.getMomentByDay('2026-09-24')).sealedUntil).toBe(at('2026-10-15T00:00'))
  })

  it('new moments use the new delivery day, and values clamp to 1..28', async () => {
    await q.setSetting('deliveryDay', 40)
    expect(await q.getSetting('deliveryDay')).toBe(28)
    const m = await q.saveMoment('2026-09-24', { note: 'x' })
    expect(m.sealedUntil).toBe(at('2026-10-28T00:00'))
  })
})

describe('media', () => {
  it('saves and lists photos for a moment, and deletes them', async () => {
    const m = await q.saveMoment('2026-09-24', { note: 'x' })
    await q.saveMedia({
      id: 'p1',
      momentId: m.id,
      kind: 'single',
      blob: new Blob(['a']),
      thumb: new Blob(['b']),
      filter: 'vintage',
      intensity: 0.6,
      layoutSeed: 7,
    })
    expect(await q.mediaForMoment(m.id)).toHaveLength(1)
    await q.deleteMediaForMoment(m.id)
    expect(await q.mediaForMoment(m.id)).toHaveLength(0)
  })
})

describe('mood fields', () => {
  it('stores the feeling and topic the mood engine found, and keeps them editable', async () => {
    const m = await q.saveMoment('2026-09-24', { note: 'rain', feeling: 'peaceful', topic: 'rain' })
    expect(m).toMatchObject({ feeling: 'peaceful', topic: 'rain' })
    const edited = await q.saveMoment('2026-09-24', { feeling: 'joyful', topic: 'shopping' })
    expect(edited).toMatchObject({ feeling: 'joyful', topic: 'shopping' })
    expect((await q.getMoment(m.id)).topic).toBe('shopping')
  })

  it('starts as null until the engine has run', async () => {
    const m = await q.saveMoment('2026-09-25', { note: 'x' })
    expect([m.feeling, m.topic]).toEqual([null, null])
  })
})
