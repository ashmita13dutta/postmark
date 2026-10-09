import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { makeQueries } from '../src/db/queries'
import { PostmarkDB } from '../src/db/schema'
import { setNow } from '../src/lib/clock'

let db
let q
let n = 0

beforeEach(() => {
  db = new PostmarkDB(`reader-${++n}`)
  q = makeQueries(db)
  setNow(new Date('2026-10-08T21:00').getTime())
})
afterEach(async () => {
  setNow(null)
  await db.delete()
})

const vec = (hot) => Array.from({ length: 6 }, (_, i) => (i === hot ? 0.123456789 : 0))

describe('the smartReading setting', () => {
  it('starts as "not asked yet" and can be turned on and off', async () => {
    expect(await q.getSetting('smartReading')).toBeNull()
    await q.setSetting('smartReading', 'on')
    expect(await q.getSetting('smartReading')).toBe('on')
    await q.setSetting('smartReading', 'off')
    expect(await q.getSetting('smartReading')).toBe('off')
    await q.setSetting('smartReading', null)
    expect(await q.getSetting('smartReading')).toBeNull()
  })

  it('refuses any other value', async () => {
    await expect(q.setSetting('smartReading', 'maybe')).rejects.toThrow('smartReading')
    await expect(q.setSetting('smartReading', true)).rejects.toThrow('smartReading')
  })
})

describe('corrections', () => {
  const entry = { text: 'Result day', vector: vec(1), guess: 'joyful', feeling: 'anxious' }

  it('remembers the note, what the app guessed, and what you chose', async () => {
    await q.saveCorrection('2026-10-08', entry)
    const [c] = await q.getCorrections()
    expect(c).toMatchObject({
      id: '2026-10-08',
      text: 'Result day',
      guess: 'joyful',
      feeling: 'anxious',
    })
    expect(c.createdAt).toBe(new Date('2026-10-08T21:00').getTime())
  })

  it('stores the embedding as a plain list, rounded to four decimals', async () => {
    await q.saveCorrection('2026-10-08', { ...entry, vector: Float32Array.from(vec(2)) })
    const [c] = await q.getCorrections()
    expect(Array.isArray(c.vector)).toBe(true)
    expect(c.vector[2]).toBe(0.1235)
    expect(c.vector).toHaveLength(6)
  })

  it('keeps one per day: a new correction replaces the old', async () => {
    await q.saveCorrection('2026-10-08', entry)
    await q.saveCorrection('2026-10-08', { ...entry, feeling: 'sad' })
    const all = await q.getCorrections()
    expect(all).toHaveLength(1)
    expect(all[0].feeling).toBe('sad')
  })

  it('lists them oldest first', async () => {
    await q.saveCorrection('2026-10-06', { ...entry, text: 'older' })
    setNow(new Date('2026-10-09T09:00').getTime())
    await q.saveCorrection('2026-10-07', { ...entry, text: 'newer' })
    expect((await q.getCorrections()).map((c) => c.text)).toEqual(['older', 'newer'])
  })

  it('can forget one day, or everything', async () => {
    await q.saveCorrection('2026-10-07', entry)
    await q.saveCorrection('2026-10-08', entry)
    await q.clearCorrection('2026-10-07')
    expect((await q.getCorrections()).map((c) => c.id)).toEqual(['2026-10-08'])
    await q.forgetCorrections()
    expect(await q.getCorrections()).toEqual([])
  })

  it('clearing a day with no correction is harmless', async () => {
    await expect(q.clearCorrection('2020-01-01')).resolves.toBeUndefined()
  })

  it('keeps at most 400, dropping the oldest first', async () => {
    const day = (i) =>
      `2020-${String(Math.floor(i / 28) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`
    for (let i = 0; i < 405; i++) {
      setNow(new Date('2026-01-01T00:00').getTime() + i * 1000)
      await q.saveCorrection(day(i), { ...entry, text: `note ${i}` })
    }
    const all = await q.getCorrections()
    expect(all).toHaveLength(400)
    expect(all[0].text).toBe('note 5')
    expect(all[all.length - 1].text).toBe('note 404')
  }, 60000)
})
