import 'fake-indexeddb/auto'
import { strToU8, zipSync } from 'fflate'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { makeQueries } from '../src/db/queries'
import { PostmarkDB } from '../src/db/schema'
import {
  BACKUP_FORMAT,
  BackupError,
  backupFileName,
  makeBackup,
  parseBackup,
} from '../src/lib/backup'
import { setNow } from '../src/lib/clock'

const NOW = new Date('2026-10-15T10:00').getTime()
const PALETTE = Array.from({ length: 5 }, (_, i) => ({ hex: `#10${i}0A0`, name: `Swatch ${i}` }))

let n = 0
const dbs = []
const fresh = () => {
  const db = new PostmarkDB(`backup-${++n}`)
  dbs.push(db)
  return { db, q: makeQueries(db), b: makeBackup(db) }
}
let A // the phone the backup comes from
let B // a phone it is restored onto

beforeEach(() => {
  setNow(NOW)
  A = fresh()
  B = fresh()
})
afterEach(async () => {
  setNow(null)
  await Promise.all(dbs.splice(0).map((db) => db.delete()))
})

/** Stamp a day on a phone, with a seal and a sticker. */
async function stamp({ q }, day, note, extra = {}) {
  const m = await q.saveMoment(day, {
    note,
    palette: PALETTE,
    feeling: 'joyful',
    topic: 'rain',
    ...extra,
  })
  await q.addDecoration(m.id, { stickerId: 'doodle:heart' })
  await q.sealMoment(m.id, { color: '#B14126', emblem: 'heart' })
  return m
}
const roundTrip = async (from, to, options) => {
  const { bytes } = await from.b.exportBackup()
  return to.b.importBackup(parseBackup(bytes), options)
}

describe('exporting', () => {
  it('saves a postcard with its sticker and seal, and says what is inside', async () => {
    await stamp(A, '2026-09-03', 'Rain at the tram stop')
    await stamp(A, '2026-09-20', 'Pujo shopping')
    const out = await A.b.exportBackup()
    expect(out.counts).toMatchObject({ moments: 2, decorations: 2, seals: 2 })
    expect([out.first, out.last]).toEqual(['2026-09-03', '2026-09-20'])
    const { data } = parseBackup(out.bytes)
    expect(data).toMatchObject({ app: 'postmark', format: BACKUP_FORMAT })
    expect(data.tables.moments.map((m) => m.note).sort()).toEqual([
      'Pujo shopping',
      'Rain at the tram stop',
    ])
  })

  it('works with nothing to save', async () => {
    const out = await A.b.exportBackup()
    expect(out.counts.moments).toBe(0)
    expect([out.first, out.last]).toEqual([null, null])
    expect(parseBackup(out.bytes).data.tables.moments).toEqual([])
  })

  it('never saves demo postcards, nor what belongs to them', async () => {
    const real = await stamp(A, '2026-09-03', 'my real day')
    const demo = await stamp(A, '2026-09-04', 'a demo day')
    await A.db.moments.update(demo.id, { demo: true })
    await A.db.redeliveries.put({ monthKey: '2026-10', momentId: demo.id })
    const { data } = parseBackup((await A.b.exportBackup()).bytes)
    expect(data.tables.moments.map((m) => m.id)).toEqual([real.id])
    expect(data.tables.decorations.every((d) => d.momentId === real.id)).toBe(true)
    expect(data.tables.seals.map((s) => s.momentId)).toEqual([real.id])
    expect(data.tables.redeliveries).toEqual([])
  })

  it('puts a postcard delivered early by the testing tools back on its real date', async () => {
    const m = await stamp(A, '2026-10-15', 'sealed today')
    const real = (await A.q.getMoment(m.id)).sealedUntil
    await A.db.moments.update(m.id, {
      earlySealedUntil: real,
      sealedUntil: NOW - 60_000,
      openedAt: NOW,
    })
    const saved = parseBackup((await A.b.exportBackup()).bytes).data.tables.moments[0]
    expect(saved.sealedUntil).toBe(real)
    expect(saved.openedAt).toBeNull()
    expect(saved.earlySealedUntil).toBeUndefined()
  })
})

describe('importing onto an empty phone', () => {
  it('brings back every postcard exactly, with its stickers and seal', async () => {
    const m = await stamp(A, '2026-09-03', 'Rain at the tram stop', { city: 'Kolkata' })
    const result = await roundTrip(A, B)
    expect(result).toEqual({ added: 1, replaced: 0, kept: 0, skipped: 0 })
    expect(await B.q.getMoment(m.id)).toEqual(await A.q.getMoment(m.id))
    expect(await B.q.decorationsFor(m.id)).toEqual(await A.q.decorationsFor(m.id))
    expect(await B.q.getSeal(m.id)).toEqual(await A.q.getSeal(m.id))
  })

  it('brings back the words, moods, combos, settings and corrections', async () => {
    const mood = await A.q.saveMood({
      label: 'Cosy chaos',
      colors: PALETTE.map((c) => c.hex.replace('#10', '#2A')),
    })
    await A.q.teachWords([{ word: 'ghurni', kind: 'feeling', id: mood.id, parts: 1 }])
    await A.q.saveCombo({
      kind: 'feeling',
      target: mood.id,
      parts: [
        { word: 'rain', parts: 1 },
        { word: 'chai', parts: 1 },
      ],
    })
    await A.q.setSetting('deliveryDay', 5)
    await A.q.saveCorrection('2026-09-03', {
      text: 'a note',
      vector: [0.1, 0.2],
      guess: 'sad',
      feeling: 'joyful',
    })
    await roundTrip(A, B)
    expect((await B.q.getMoods()).map((x) => x.id)).toEqual([mood.id])
    expect((await B.q.getLexicon()).map((w) => w.word)).toEqual(['ghurni'])
    expect((await B.q.getCombos()).map((c) => c.id)).toEqual(['feeling:chai+rain'])
    expect(await B.q.getSetting('deliveryDay')).toBe(5)
    expect((await B.q.getCorrections()).map((c) => c.id)).toEqual(['2026-09-03'])
  })

  it('brings back photos and cut-outs as real files', async () => {
    const m = await stamp(A, '2026-09-03', 'with a photo')
    const photo = new Blob([new Uint8Array([1, 2, 3, 4, 5, 6])], { type: 'image/jpeg' })
    const thumb = new Blob([new Uint8Array([9, 8])], { type: 'image/jpeg' })
    await A.db.media.put({ id: 'p1', momentId: m.id, kind: 'single', blob: photo, thumb })
    await A.db.customStickers.put({ id: 's1', blob: photo, createdFrom: 'manual', createdAt: 1 })
    const out = await A.b.exportBackup()
    const { files } = parseBackup(out.bytes)
    expect(Object.keys(files).sort()).toEqual(
      ['customStickers/s1/blob', 'data.json', 'media/p1/blob', 'media/p1/thumb'].sort(),
    )
    await B.b.importBackup(parseBackup(out.bytes))
    const media = await B.db.media.get('p1')
    expect(media.blob.type).toBe('image/jpeg')
    expect([...new Uint8Array(await media.blob.arrayBuffer())]).toEqual([1, 2, 3, 4, 5, 6])
    expect([...new Uint8Array(await media.thumb.arrayBuffer())]).toEqual([9, 8])
    expect(media.momentId).toBe(m.id)
    expect((await B.db.customStickers.get('s1')).blob.size).toBe(6)
  })
})

describe('importing onto a phone that already has stamps', () => {
  it('keeps your day when the same day is in the backup, and adds the rest', async () => {
    await stamp(A, '2026-09-03', 'backup version')
    await stamp(A, '2026-09-04', 'only in the backup')
    await stamp(B, '2026-09-03', 'my version')
    const result = await roundTrip(A, B)
    expect(result).toEqual({ added: 1, replaced: 0, kept: 1, skipped: 0 })
    const notes = Object.fromEntries((await B.q.allMoments()).map((m) => [m.day, m.note]))
    expect(notes).toEqual({ '2026-09-03': 'my version', '2026-09-04': 'only in the backup' })
  })

  it('takes the backup’s version of a shared day when asked, with its own stickers', async () => {
    await stamp(A, '2026-09-03', 'backup version')
    const mine = await stamp(B, '2026-09-03', 'my version')
    await B.db.decorations.add({
      id: 'extra',
      momentId: mine.id,
      stickerId: 'doodle:star',
      x: 0.5,
      y: 0.5,
      rotation: 0,
      scale: 1,
      side: 'back',
      z: 9,
    })
    const result = await roundTrip(A, B, { replaceClashes: true })
    expect(result).toEqual({ added: 0, replaced: 1, kept: 0, skipped: 0 })
    const [m] = await B.q.allMoments()
    expect(m.note).toBe('backup version')
    expect(await B.db.decorations.count()).toBe(1)
    expect((await B.q.decorationsFor(m.id))[0].stickerId).toBe('doodle:heart')
    expect(await B.db.seals.count()).toBe(1)
  })

  it('lets a real postcard take the day of a demo postcard, without asking', async () => {
    await stamp(A, '2026-09-03', 'the real one')
    const demo = await stamp(B, '2026-09-03', 'a demo day')
    await B.db.moments.update(demo.id, { demo: true })
    const { bytes } = await A.b.exportBackup()
    const summary = await B.b.summarize(parseBackup(bytes))
    expect(summary).toMatchObject({ stamps: 1, added: 1, clashes: [] })
    expect(await B.b.importBackup(parseBackup(bytes))).toEqual({
      added: 1,
      replaced: 0,
      kept: 0,
      skipped: 0,
    })
    const [m] = await B.q.allMoments()
    expect(m.note).toBe('the real one')
    expect(m.demo).toBeUndefined()
    expect(await B.db.decorations.count()).toBe(1)
  })

  it('gives a postcard a new id when its id is already used by another day', async () => {
    const mine = await stamp(B, '2026-09-10', 'mine, with the same id')
    await stamp(A, '2026-09-03', 'theirs')
    const { bytes } = await A.b.exportBackup()
    // give the backup's postcard (and what belongs to it) an id that B already has on another day
    const { data } = parseBackup(bytes)
    data.tables.moments[0].id = mine.id
    data.tables.decorations.forEach((d) => (d.momentId = mine.id))
    data.tables.seals.forEach((s) => (s.momentId = mine.id))
    const result = await B.b.importBackup({ data, files: {} })
    expect(result.added).toBe(1)
    const all = await B.q.allMoments()
    expect(all.map((m) => m.day)).toEqual(['2026-09-03', '2026-09-10'])
    const added = all.find((m) => m.day === '2026-09-03')
    expect(added.id).not.toBe(mine.id)
    expect(await B.q.decorationsFor(added.id)).toHaveLength(1)
    expect(await B.q.getSeal(added.id)).toBeTruthy()
    // and my own postcard is untouched
    expect((await B.q.getMoment(mine.id)).note).toBe('mine, with the same id')
    expect(await B.q.decorationsFor(mine.id)).toHaveLength(1)
  })

  it('only adds what is missing: your settings, words and moods are never overwritten', async () => {
    await A.q.setSetting('deliveryDay', 5)
    await A.q.teachWords([{ word: 'quiet', kind: 'feeling', id: 'sad', parts: 1 }])
    await B.q.setSetting('deliveryDay', 12)
    await B.q.teachWords([{ word: 'quiet', kind: 'feeling', id: 'peaceful', parts: 1 }])
    await A.q.teachWords([{ word: 'adda', kind: 'feeling', id: 'joyful', parts: 1 }])
    await roundTrip(A, B)
    expect(await B.q.getSetting('deliveryDay')).toBe(12)
    const words = Object.fromEntries((await B.q.getLexicon()).map((w) => [w.word, w.id]))
    expect(words).toEqual({ quiet: 'peaceful', adda: 'joyful' })
  })

  it('carries a "delayed in transit" choice over to the new postcard id', async () => {
    const m = await stamp(A, '2026-01-05', 'an old one')
    await A.db.redeliveries.put({ monthKey: '2026-10', momentId: m.id })
    await roundTrip(A, B)
    expect(await B.db.redeliveries.get('2026-10')).toEqual({ monthKey: '2026-10', momentId: m.id })
  })

  it('does not choose a "delayed" postcard for a month that already has a choice', async () => {
    const m = await stamp(A, '2026-01-05', 'an old one')
    await A.db.redeliveries.put({ monthKey: '2026-10', momentId: m.id })
    await B.db.redeliveries.put({ monthKey: '2026-10', momentId: null })
    await roundTrip(A, B)
    expect((await B.db.redeliveries.get('2026-10')).momentId).toBeNull()
  })
})

describe('what it will not bring in', () => {
  const backupWith = (moments) =>
    parseBackup(
      zipSync({
        'data.json': strToU8(JSON.stringify({ app: 'postmark', format: 1, tables: { moments } })),
      }),
    )
  const ok = { id: 'a', day: '2026-09-03', note: 'fine', palette: PALETTE }

  it('skips postcards that do not look right and says how many', async () => {
    const result = await B.b.importBackup(
      backupWith([
        ok,
        { ...ok, id: 'b', day: '2026-02-30' }, // not a real day
        { ...ok, id: 'c', day: '2026-09-04', palette: PALETTE.slice(0, 4) },
        { ...ok, id: 'd', day: 'tomorrow' },
        { ...ok, id: 5, day: '2026-09-05' },
        { ...ok, id: 'e' }, // the same day twice
      ]),
    )
    expect(result).toEqual({ added: 1, replaced: 0, kept: 0, skipped: 5 })
    expect((await B.q.allMoments()).map((m) => m.id)).toEqual(['a'])
  })

  it('does not change anything when the file has nothing usable', async () => {
    await stamp(B, '2026-09-03', 'mine')
    await B.b.importBackup(backupWith([]))
    expect(await B.q.countMoments()).toBe(1)
  })
})

describe('summarising a backup before importing it', () => {
  it('says how many are new, which days are on both, and the date range', async () => {
    await stamp(A, '2026-09-03', 'a')
    await stamp(A, '2026-09-04', 'b')
    await stamp(A, '2026-09-20', 'c')
    await stamp(B, '2026-09-04', 'mine')
    const { bytes } = await A.b.exportBackup()
    expect(await B.b.summarize(parseBackup(bytes))).toEqual({
      stamps: 3,
      added: 2,
      clashes: ['2026-09-04'],
      first: '2026-09-03',
      last: '2026-09-20',
      exportedAt: NOW,
    })
  })

  it('changes nothing', async () => {
    await stamp(A, '2026-09-03', 'a')
    await B.b.summarize(parseBackup((await A.b.exportBackup()).bytes))
    expect(await B.q.countMoments()).toBe(0)
  })
})

describe('opening a file that is not a good backup', () => {
  const message = (fn) => {
    try {
      fn()
    } catch (err) {
      expect(err).toBeInstanceOf(BackupError)
      return err.message
    }
    throw new Error('expected a BackupError')
  }
  const zipOf = (files) => zipSync(files)

  it('refuses something that is not a zip', () => {
    expect(message(() => parseBackup(strToU8('hello')))).toMatch(/not a Postmark backup/)
  })

  it('refuses a zip without data.json', () => {
    expect(message(() => parseBackup(zipOf({ 'notes.txt': strToU8('hi') })))).toMatch(
      /not a Postmark backup/,
    )
  })

  it('refuses data that cannot be read', () => {
    expect(message(() => parseBackup(zipOf({ 'data.json': strToU8('{ nope') })))).toMatch(/damaged/)
  })

  it('refuses a zip from another app', () => {
    const data = JSON.stringify({ app: 'other', format: 1, tables: {} })
    expect(message(() => parseBackup(zipOf({ 'data.json': strToU8(data) })))).toMatch(
      /not a Postmark backup/,
    )
  })

  it('refuses a backup from a newer version and says what to do', () => {
    const data = JSON.stringify({ app: 'postmark', format: BACKUP_FORMAT + 1, tables: {} })
    expect(message(() => parseBackup(zipOf({ 'data.json': strToU8(data) })))).toMatch(
      /newer version.*update/s,
    )
  })

  it('refuses a backup that mentions a photo it does not contain', async () => {
    const data = {
      app: 'postmark',
      format: 1,
      tables: {
        moments: [{ id: 'a', day: '2026-09-03', palette: PALETTE }],
        media: [{ id: 'p', momentId: 'a', blob: { $file: 'media/p/blob', type: 'image/jpeg' } }],
      },
    }
    // media rows are brought in with their postcard, so the missing file is found while reviving
    const parsed = parseBackup(zipOf({ 'data.json': strToU8(JSON.stringify(data)) }))
    await expect(B.b.importBackup(parsed)).rejects.toThrow(/missing a photo/)
    expect(await B.q.countMoments()).toBe(0)
  })
})

describe('backupFileName', () => {
  it('names the file by its date', () => {
    expect(backupFileName(new Date('2026-10-05T09:00').getTime())).toBe(
      'postmark-backup-2026-10-05.zip',
    )
  })
})
