import { PACKS, WAX_COLORS, WAX_EMBLEMS } from '../data/stickers'
import { readNote } from '../engine/readNote'
import { now } from '../lib/clock'
import {
  addDays,
  addMonths,
  dayKey,
  daysInMonth,
  monthKey,
  parseMonthKey,
  yearAgoDays,
} from '../lib/dates'
import { dropSpot, dropTilt } from '../lib/decor'
import { seededRng } from '../lib/rng'
import { newMoment } from './moments'
import { db as defaultDb } from './schema'

/**
 * Testing aids, so you never have to wait for a real month to try the Mailbox.
 *
 *  - addPostcards: a month of already-delivered, unopened postcards (written last month), one from
 *    exactly a year ago, and an old opened one that shows up as "delayed in transit". They are
 *    marked `demo: true`, so they can be removed without touching your own stamps.
 *  - deliverToday: delivers today's sealed postcard right now (its real delivery date is kept, so
 *    removeDemo can put it back).
 *  - removeDemo: deletes the demo postcards and puts early-delivered ones back as they were.
 *
 * Demo postcards use stamp number 0, so they never change the numbering of your real stamps.
 */

const NOTES = [
  'Rain at the tram stop, chai in a clay cup, and nobody in a hurry for once.',
  'Finally finished the viva! Cried a little in the corridor, then ate rolls with the gang.',
  'Maa called. Dadu’s old radio still plays Kishore Kumar. I miss home today.',
  'Pujo shopping with Riya, bargained like pros, my feet hurt and my heart is full.',
  'Could not sleep, scrolled for hours, felt nothing in particular.',
  'Sunday khichdi, rain on the tin roof, and a book I had forgotten I loved.',
  'Group project meeting ran three hours and decided nothing. I am so done.',
  'Walked by the river at sunset and the whole sky went pink. Grateful for small things.',
]
/** Days of last month that get a demo postcard. */
const DEMO_DAYS = [3, 8, 12, 17, 21, 26]
const OLD_AGE_DAYS = 100

const pad = (n) => String(n).padStart(2, '0')

export function makeDemo(db) {
  /** A sticker or two for the back of a demo postcard, spread like a person would place them. */
  function decorationsFor(momentId, day) {
    const rnd = seededRng(`demo:${day}`)
    const pool = PACKS.flatMap((p) => p.items).filter((i) => i.id.startsWith('img:'))
    const fallback = PACKS.flatMap((p) => p.items).filter((i) => i.id.startsWith('doodle:'))
    const source = pool.length ? pool : fallback
    const count = 2 + Math.floor(rnd() * 2)
    return Array.from({ length: count }, (_, i) => {
      const sticker = source[Math.floor(rnd() * source.length)]
      const key = `${momentId}:${i}`
      return {
        id: globalThis.crypto.randomUUID(),
        momentId,
        stickerId: sticker.id,
        ...dropSpot(i, key),
        rotation: dropTilt(key),
        scale: 1,
        side: 'back',
        z: i + 1,
        ...(sticker.id.startsWith('img:') ? { tone: 'original', outline: true } : {}),
      }
    })
  }

  /** One delivered demo postcard (a moment, its wax seal and a few stickers), unless the day is taken. */
  async function putDemo({ day, noteIndex, nowMs, deliveryDay, opened = false, sealedAtMs }) {
    if (await db.moments.where('day').equals(day).first()) return null
    const text = NOTES[noteIndex % NOTES.length]
    const read = readNote({ text, day, hour: 12, month: Number(day.slice(5, 7)) })
    const base = newMoment({
      day,
      stampNo: 0,
      nowMs,
      deliveryDay,
      fields: {
        note: text,
        feeling: read.feeling,
        topic: read.topic,
        palette: read.built.colors,
        paletteSource: 'moment',
      },
    })
    const moment = {
      ...base,
      demo: true,
      // always already delivered, even if this month's delivery day has not come yet
      sealedUntil: Math.min(base.sealedUntil, nowMs - 60_000),
      sealedAt: sealedAtMs,
      openedAt: opened ? nowMs - 30 * 86_400_000 : null,
    }
    await db.moments.add(moment)
    const rnd = seededRng(`demo-seal:${day}`)
    const emblem = WAX_EMBLEMS[Math.floor(rnd() * WAX_EMBLEMS.length)].id
    await db.seals.put({
      momentId: moment.id,
      color: WAX_COLORS[Math.floor(rnd() * WAX_COLORS.length)].hex,
      emblem,
      ...(emblem === 'initial' ? { initial: 'A' } : {}),
    })
    await db.decorations.bulkAdd(decorationsFor(moment.id, day))
    return moment
  }

  /** Delete the demo postcards and put early-delivered ones back. Call inside a transaction. */
  async function removeDemoInTransaction() {
    const all = await db.moments.toArray()
    const demos = all.filter((m) => m.demo === true)
    for (const m of demos) {
      await db.decorations.where('momentId').equals(m.id).delete()
      await db.seals.delete(m.id)
      await db.moments.delete(m.id)
    }
    // a delayed-in-transit pick that pointed at a demo postcard is cleared, so it can be re-rolled
    const demoIds = new Set(demos.map((m) => m.id))
    for (const row of await db.redeliveries.toArray()) {
      if (row.momentId && demoIds.has(row.momentId)) await db.redeliveries.delete(row.monthKey)
    }
    let restored = 0
    for (const m of all.filter((x) => !x.demo && x.earlySealedUntil != null)) {
      const { earlySealedUntil, ...rest } = m
      await db.moments.put({ ...rest, sealedUntil: earlySealedUntil, openedAt: null })
      restored++
    }
    return { removed: demos.length, restored }
  }

  /** Make (or remake) the demo postcards. Returns how many were added. */
  async function addPostcards(nowMs = now()) {
    return db.transaction(
      'rw',
      [db.moments, db.seals, db.decorations, db.redeliveries, db.settings],
      async () => {
        await removeDemoInTransaction()
        const deliveryDay = (await db.settings.get('deliveryDay'))?.value ?? 1
        const today = dayKey(nowMs)
        const { y, m } = parseMonthKey(addMonths(monthKey(today), -1))
        const days = DEMO_DAYS.filter((d) => d <= daysInMonth(y, m)).map(
          (d) => `${y}-${pad(m)}-${pad(d)}`,
        )
        const made = []
        for (const [i, day] of days.entries()) {
          made.push(
            await putDemo({
              day,
              noteIndex: i,
              nowMs,
              deliveryDay,
              sealedAtMs: nowMs - 40 * 86_400_000,
            }),
          )
        }
        // a letter from exactly one year ago (the banner on Today and the aged envelope)
        const yearAgo = await putDemo({
          day: yearAgoDays(today)[0],
          noteIndex: 7,
          nowMs,
          deliveryDay,
          sealedAtMs: nowMs - 360 * 86_400_000,
        })
        made.push(yearAgo)
        // an old opened one, and make it this month's "delayed in transit" postcard
        const old = await putDemo({
          day: addDays(today, -OLD_AGE_DAYS),
          noteIndex: 2,
          nowMs,
          deliveryDay,
          opened: true,
          sealedAtMs: nowMs - (OLD_AGE_DAYS + 5) * 86_400_000,
        })
        made.push(old)
        if (old) {
          const key = monthKey(today)
          const existing = await db.redeliveries.get(key)
          if (!existing || existing.momentId === null) {
            await db.redeliveries.put({ monthKey: key, momentId: old.id })
          }
        }
        return { added: made.filter(Boolean).length }
      },
    )
  }

  /** Deliver today's sealed postcard now. Returns 'delivered', 'already', 'unsealed' or 'none'. */
  async function deliverToday(nowMs = now()) {
    return db.transaction('rw', db.moments, async () => {
      const moment = await db.moments.where('day').equals(dayKey(nowMs)).first()
      if (!moment) return 'none'
      if (moment.sealedAt == null) return 'unsealed'
      if (moment.sealedUntil <= nowMs) return 'already'
      await db.moments.put({
        ...moment,
        earlySealedUntil: moment.sealedUntil,
        sealedUntil: nowMs - 60_000,
      })
      return 'delivered'
    })
  }

  async function removeDemo() {
    return db.transaction(
      'rw',
      [db.moments, db.seals, db.decorations, db.redeliveries],
      removeDemoInTransaction,
    )
  }

  /** What is currently set up: demo postcards, and postcards delivered early. */
  async function status() {
    const all = await db.moments.toArray()
    return {
      demo: all.filter((m) => m.demo === true).length,
      early: all.filter((m) => !m.demo && m.earlySealedUntil != null).length,
    }
  }

  return { addPostcards, deliverToday, removeDemo, status }
}

export const demo = makeDemo(defaultDb)
