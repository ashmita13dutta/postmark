import { now } from '../lib/clock'
import { clampDeliveryDay, sealedUntilFor } from '../lib/dates'
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
}

export class SealedError extends Error {
  constructor() {
    super('This postcard is sealed and can no longer be edited')
    this.name = 'SealedError'
  }
}

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
    return db.transaction('rw', db.lexicon, async () => {
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

  return {
    getLexicon,
    teachWords,
    forgetWord,
    forgetAllWords,
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
    saveMedia,
    mediaForMoment,
    deleteMediaForMoment,
  }
}

export const queries = makeQueries(defaultDb)
