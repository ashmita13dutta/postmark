import { now } from '../lib/clock'
import { MAX_DECORATIONS, clampPlacement } from '../lib/decor'
import { clampDeliveryDay, dayKey, sealedUntilFor } from '../lib/dates'
import { eligibleForDelay, pickDelayed } from '../lib/mailbox'
import { MAX_MOODS, buildMoods, cleanMood, isMyMood } from '../engine/moods'
import { applyFields, newMoment } from './moments'
import { db as defaultDb } from './schema'

export const SETTING_DEFAULTS = {
  homeCity: null,
  paletteDefault: 'moment', // 'moment' | 'photo'
  songModeDefault: 'suggested', // 'own' | 'suggested'
  deliveryDay: 1, // 1 to 28
  revealAnimation: true,
  reminderTime: null, // 'HH:MM' or null
  soundOn: true,
  hapticsOn: true,
  appLock: false,
  onboarded: false,
  stripFrames: 3, // photo-booth strip: 3 or 4 frames
  smartReading: null, // the on-device note reader: null = not asked yet, 'on', or 'off'
}

export class SealedError extends Error {
  constructor() {
    super('This postcard is sealed and can no longer be edited')
    this.name = 'SealedError'
  }
}

export class PostcardFullError extends Error {
  constructor() {
    super('Your postcard is full')
    this.name = 'PostcardFullError'
  }
}

const newId = () => globalThis.crypto.randomUUID()

/**
 * All database operations. Built from a db instance so tests can use an isolated database;
 * the app uses the default `queries` export below.
 */
export function makeQueries(db) {
  // ---- settings ----

  async function getSetting(key) {
    const row = await db.settings.get(key)
    return row ? row.value : SETTING_DEFAULTS[key]
  }

  async function getSettings() {
    const rows = await db.settings.toArray()
    return { ...SETTING_DEFAULTS, ...Object.fromEntries(rows.map((r) => [r.key, r.value])) }
  }

  async function setSetting(key, value) {
    if (!(key in SETTING_DEFAULTS)) throw new Error(`Unknown setting: ${key}`)
    if (key === 'deliveryDay') return setDeliveryDay(value)
    if (key === 'stripFrames' && value !== 3 && value !== 4)
      throw new Error('stripFrames is 3 or 4')
    if (key === 'smartReading' && value !== null && value !== 'on' && value !== 'off')
      throw new Error("smartReading is null, 'on' or 'off'")
    await db.settings.put({ key, value })
  }

  /** Changing the delivery day re-times every postcard that has not been delivered yet. */
  async function setDeliveryDay(value) {
    const deliveryDay = clampDeliveryDay(value)
    const nowMs = now()
    await db.transaction('rw', db.settings, db.moments, async () => {
      await db.settings.put({ key: 'deliveryDay', value: deliveryDay })
      const pending = await db.moments.where('sealedUntil').above(nowMs).toArray()
      await Promise.all(
        pending.map((m) =>
          db.moments.update(m.id, { sealedUntil: sealedUntilFor(m.day, deliveryDay) }),
        ),
      )
    })
    return deliveryDay
  }

  // ---- moments ----

  const getMoment = (id) => db.moments.get(id)
  const getMomentByDay = (day) => db.moments.where('day').equals(day).first()
  const countMoments = () => db.moments.count()
  const allMoments = () => db.moments.orderBy('day').toArray()

  /** All moments in a month ('YYYY-MM'), ordered by day. */
  const momentsInMonth = (monthKey) =>
    db.moments.where('day').between(`${monthKey}-01`, `${monthKey}-31`, true, true).toArray()

  /** Moments whose delivery time has passed, ordered by day. */
  async function deliveredMoments(nowMs = now()) {
    return db.moments.where('sealedUntil').belowOrEqual(nowMs).sortBy('day')
  }

  /**
   * This month's "delayed in transit" postcard, or null. Decided once per month (spec 6.5), the
   * first time it is asked for, and stored so reopening the Mailbox never re-rolls it.
   */
  async function delayedForMonth(monthKey, nowMs = now()) {
    const row = await db.transaction('rw', db.redeliveries, db.moments, async () => {
      const found = await db.redeliveries.get(monthKey)
      if (found) return found
      const delivered = await deliveredMoments(nowMs)
      const picked = pickDelayed(monthKey, eligibleForDelay(delivered, dayKey(nowMs)))
      const next = { monthKey, momentId: picked?.id ?? null }
      await db.redeliveries.put(next)
      return next
    })
    return row.momentId ? ((await getMoment(row.momentId)) ?? null) : null
  }

  async function nextStampNo() {
    const last = await db.moments.orderBy('stampNo').last()
    return last ? last.stampNo + 1 : 1
  }

  /**
   * Create today's stamp, or edit it if it already exists (one stamp per day). A sealed
   * postcard cannot be edited. `fields` is whitelisted; see EDITABLE_FIELDS.
   */
  async function saveMoment(day, fields) {
    return db.transaction('rw', db.moments, db.settings, async () => {
      const nowMs = now()
      const existing = await getMomentByDay(day)
      if (existing) {
        if (existing.sealedAt != null) throw new SealedError()
        const updated = { ...applyFields(existing, fields), updatedAt: nowMs }
        await db.moments.put(updated)
        return updated
      }
      const moment = newMoment({
        day,
        stampNo: await nextStampNo(),
        nowMs,
        deliveryDay: await getSetting('deliveryDay'),
        fields,
      })
      await db.moments.add(moment)
      return moment
    })
  }

  /** "Seal & send": records the wax seal and locks the postcard. Safe to call twice. */
  async function sealMoment(momentId, seal) {
    return db.transaction('rw', db.moments, db.seals, async () => {
      const moment = await getMoment(momentId)
      if (!moment) throw new Error(`No such moment: ${momentId}`)
      if (moment.sealedAt != null) return moment
      const sealed = { ...moment, sealedAt: now(), updatedAt: now() }
      await db.moments.put(sealed)
      if (seal) await db.seals.put({ ...seal, momentId })
      return sealed
    })
  }

  /** Called when the opening ritual finishes. Only delivered postcards can be opened. */
  async function markOpened(momentId) {
    const moment = await getMoment(momentId)
    if (!moment) throw new Error(`No such moment: ${momentId}`)
    if (now() < moment.sealedUntil) throw new Error('This postcard has not been delivered yet')
    if (moment.openedAt != null) return moment
    const opened = { ...moment, openedAt: now() }
    await db.moments.put(opened)
    return opened
  }

  // ---- corrections: notes you told the reader it had read wrong ----

  const MAX_CORRECTIONS = 400 // plenty; the oldest go first

  /** Remember how a day's note really felt. One per day: a new one replaces the old. */
  async function saveCorrection(day, { text, vector, guess, feeling }) {
    await db.transaction('rw', db.corrections, async () => {
      await db.corrections.put({
        id: day,
        text,
        vector: Array.from(vector, (v) => Math.round(v * 1e4) / 1e4),
        guess,
        feeling,
        createdAt: now(),
      })
      const extra = (await db.corrections.count()) - MAX_CORRECTIONS
      if (extra > 0) {
        const oldest = await db.corrections.orderBy('createdAt').limit(extra).primaryKeys()
        await db.corrections.bulkDelete(oldest)
      }
    })
  }
  const clearCorrection = (day) => db.corrections.delete(day)
  const getCorrections = () => db.corrections.orderBy('createdAt').toArray()
  const forgetCorrections = () => db.corrections.clear()

  // ---- postcard decorations ----

  /** A moment's stickers, back to front. */
  const decorationsFor = (momentId) => db.decorations.where('momentId').equals(momentId).sortBy('z')

  const getSeal = (momentId) => db.seals.get(momentId)

  /** Every wax seal, by postcard id, so a whole month of envelopes can be drawn at once. */
  const allSeals = async () => new Map((await db.seals.toArray()).map((s) => [s.momentId, s]))

  async function editableMoment(momentId) {
    const moment = await getMoment(momentId)
    if (!moment) throw new Error(`No such moment: ${momentId}`)
    // a demo postcard is made already sealed, but stays decoratable so stickers can be tested on it
    if (moment.sealedAt != null && !moment.demo) throw new SealedError()
    return moment
  }

  /** Put a sticker on the back of a postcard. At most MAX_DECORATIONS; a sealed postcard is locked. */
  async function addDecoration(momentId, { stickerId, ...placement }) {
    return db.transaction('rw', db.moments, db.decorations, async () => {
      await editableMoment(momentId)
      const here = await db.decorations.where('momentId').equals(momentId).toArray()
      if (here.length >= MAX_DECORATIONS) throw new PostcardFullError()
      const deco = {
        id: newId(),
        momentId,
        stickerId,
        x: 0.5,
        y: 0.5,
        rotation: 0,
        scale: 1,
        ...clampPlacement(placement),
        side: 'back',
        z: here.reduce((top, d) => Math.max(top, d.z), 0) + 1,
      }
      await db.decorations.add(deco)
      return deco
    })
  }

  /** Move, turn or resize a sticker. `front: true` also brings it on top of the others. */
  async function updateDecoration(id, { front, ...patch }) {
    return db.transaction('rw', db.moments, db.decorations, async () => {
      const deco = await db.decorations.get(id)
      if (!deco) throw new Error(`No such decoration: ${id}`)
      await editableMoment(deco.momentId)
      const next = { ...deco, ...clampPlacement(patch) }
      if (front) {
        const all = await db.decorations.where('momentId').equals(deco.momentId).toArray()
        next.z = all.reduce((top, d) => Math.max(top, d.z), 0) + 1
      }
      await db.decorations.put(next)
      return next
    })
  }

  async function removeDecoration(id) {
    return db.transaction('rw', db.moments, db.decorations, async () => {
      const deco = await db.decorations.get(id)
      if (!deco) return
      await editableMoment(deco.momentId)
      await db.decorations.delete(id)
    })
  }

  // ---- media (photos) ----

  const saveMedia = async (media) => {
    await db.media.put(media)
    return media
  }
  const mediaForMoment = (momentId) => db.media.where('momentId').equals(momentId).toArray()
  const deleteMediaForMoment = (momentId) => db.media.where('momentId').equals(momentId).delete()

  // ---- lexicon: words you taught the mood engine ----

  const MAX_LEXICON = 3000 // plenty for one person; stops a runaway list

  /** Everything you have taught, newest first. Feed it to detectMood({ lexicon }). */
  async function getLexicon() {
    // `key` is how a row is stored; `word` is the word itself
    return (await db.lexicon.toArray())
      .map((r) => ({ ...r, key: r.word, word: r.text ?? r.word }))
      .sort((a, b) => b.createdAt - a.createdAt)
  }

  /**
   * Save taught words (entries from engine/teach.js). Teaching a word again replaces what it meant
   * before, so a correction always wins. Returns the entries that were saved.
   */
  async function teachWords(entries) {
    const clean = entries
      .filter(
        (e) =>
          e?.word &&
          /^\p{L}{2,}$/u.test(e.word) &&
          (e.kind === 'feeling' ||
            e.kind === 'topic' ||
            (e.kind === 'tint' && /^#[0-9A-Fa-f]{6}$/.test(e.id ?? ''))) &&
          e.id,
      )
      .map((e) => ({
        // a color row is stored as "tint:breezy", so one word can mean a feeling AND a color
        word: e.kind === 'tint' ? `tint:${e.word}` : e.word,
        text: e.word,
        kind: e.kind,
        id: e.kind === 'tint' ? e.id.toUpperCase() : e.id,
        parts: e.parts ?? 1,
        example: e.example ?? e.word,
        createdAt: now(),
      }))
    if (!clean.length) return []
    return db.transaction('rw', db.lexicon, db.moods, async () => {
      // a word can only be taught to a mood of yours that still exists
      for (const e of clean) {
        if (e.kind === 'feeling' && isMyMood(e.id) && !(await db.moods.get(e.id)))
          throw new Error('That mood no longer exists.')
      }
      if ((await db.lexicon.count()) + clean.length > MAX_LEXICON) {
        throw new Error('Your word list is full. Remove some words first.')
      }
      await db.lexicon.bulkPut(clean)
      return clean
    })
  }

  /** Forget one taught word. Pass its `key` from getLexicon (a plain word works for feelings and topics). */
  const forgetWord = (key) => db.lexicon.delete(key)
  const forgetAllWords = () => db.lexicon.clear()

  // ---- moods: feelings you made up (see engine/moods.js) ----

  /** Your moods, oldest first. Feed it to buildMoods. */
  const getMoods = () => db.moods.orderBy('createdAt').toArray()

  /**
   * Make a mood ({ label, colors }) or, with `id`, change one. The name and colors are checked and
   * tidied (cleanMood). Returns the saved mood.
   */
  async function saveMood({ id, label, colors }) {
    return db.transaction('rw', db.moods, async () => {
      const rows = await db.moods.toArray()
      const existing = id ? rows.find((r) => r.id === id) : null
      if (id && !existing) throw new Error('That mood no longer exists.')
      if (!existing && rows.length >= MAX_MOODS)
        throw new Error(`You can have up to ${MAX_MOODS} moods. Delete one first.`)
      const cleaned = cleanMood({ label, colors }, buildMoods(rows), id)
      const row = existing
        ? { ...existing, ...cleaned }
        : { id: `my:${newId().slice(0, 8)}`, ...cleaned, createdAt: now() }
      await db.moods.put(row)
      return row
    })
  }

  /**
   * Delete a mood and the words you taught it. Postcards that used it keep their colors; they just
   * stop knowing its name. Returns how many taught words went with it.
   */
  async function deleteMood(id) {
    return db.transaction('rw', db.moods, db.lexicon, async () => {
      const words = await db.lexicon
        .where('id')
        .equals(id)
        .filter((w) => w.kind === 'feeling')
        .primaryKeys()
      await db.lexicon.bulkDelete(words)
      await db.moods.delete(id)
      return words.length
    })
  }

  return {
    getLexicon,
    teachWords,
    forgetWord,
    forgetAllWords,
    getMoods,
    saveMood,
    deleteMood,
    getSetting,
    getSettings,
    setSetting,
    setDeliveryDay,
    getMoment,
    getMomentByDay,
    countMoments,
    allMoments,
    momentsInMonth,
    deliveredMoments,
    nextStampNo,
    saveMoment,
    sealMoment,
    markOpened,
    decorationsFor,
    getSeal,
    allSeals,
    saveCorrection,
    clearCorrection,
    getCorrections,
    forgetCorrections,
    delayedForMonth,
    addDecoration,
    updateDecoration,
    removeDecoration,
    saveMedia,
    mediaForMoment,
    deleteMediaForMoment,
  }
}

export const queries = makeQueries(defaultDb)
