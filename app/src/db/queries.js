import { feelings } from '../data/feelings.json'
import { topics } from '../data/topics.json'
import { now } from '../lib/clock'
import { MAX_DECORATIONS, clampPlacement } from '../lib/decor'
import { clampDeliveryDay, dayKey, sealedUntilFor } from '../lib/dates'
import { eligibleForDelay, pickDelayed } from '../lib/mailbox'
import { cleanSong } from '../engine/songs'
import { earnedRewards } from '../lib/rewards'
import { cleanCover, yearsToClose } from '../lib/volumes'
import { MAX_MOODS, buildMoods, cleanMood, isMyMood } from '../engine/moods'
import { clampLook } from '../data/papers'
import { applyFields, newMoment } from './moments'
import { db as defaultDb } from './schema'

export const SETTING_DEFAULTS = {
  name: '', // what the postmaster card calls you
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
  lastBackupAt: null, // when you last saved a backup (epoch ms), so the app can remind you
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
    if (key === 'songModeDefault' && value !== 'suggested' && value !== 'own')
      throw new Error("songModeDefault is 'suggested' or 'own'")
    if (key === 'paletteDefault' && value !== 'moment' && value !== 'photo')
      throw new Error("paletteDefault is 'moment' or 'photo'")
    if (key === 'name' && (typeof value !== 'string' || value.length > 30))
      throw new Error('A name can be up to 30 letters')
    if (key === 'homeCity' && value !== null && (typeof value !== 'string' || value.length > 40))
      throw new Error('A city name can be up to 40 letters')
    if (key === 'reminderTime' && value !== null && !/^([01]\d|2[0-3]):[0-5]\d$/.test(value))
      throw new Error('reminderTime is HH:MM or null')
    if ((key === 'revealAnimation' || key === 'onboarded') && typeof value !== 'boolean')
      throw new Error(`${key} is true or false`)
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
    return db.transaction('rw', db.moments, db.seals, db.media, async () => {
      const moment = await getMoment(momentId)
      if (!moment) throw new Error(`No such moment: ${momentId}`)
      if (moment.sealedAt != null) return moment
      const sealed = { ...moment, sealedAt: now(), updatedAt: now() }
      await db.moments.put(sealed)
      if (seal) await db.seals.put({ ...seal, momentId })
      // the unfiltered originals were only kept so the look could change; once sealed it cannot
      await db.media
        .where('momentId')
        .equals(momentId)
        .modify((row) => {
          delete row.sources
        })
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
  /** Every sticker on every postcard (for the collection on You). */
  const allDecorations = () => db.decorations.toArray()
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

  /**
   * Choose the paper and/or the frame on the back of a postcard (ids from papers.json). Only the
   * fields you give change, an unknown id becomes the default, and a sealed postcard is locked.
   */
  async function setLook(momentId, look) {
    return db.transaction('rw', db.moments, async () => {
      const moment = await editableMoment(momentId)
      const next = { ...moment, ...clampLook(look) }
      await db.moments.put(next)
      return next
    })
  }

  // ---- media (photos) ----

  const saveMedia = async (media) => {
    await db.media.put(media)
    return media
  }
  /**
   * A postcard's photo: one picture (a single photo or a film strip), replacing any it had. `media` is
   * { kind: 'single' | 'strip', blob, thumb, filter, intensity, layoutSeed }. A sealed postcard's photo
   * is locked, like its note.
   */
  async function setMedia(momentId, media) {
    if (media.kind !== 'single' && media.kind !== 'strip')
      throw new Error("A photo is 'single' or 'strip'")
    return db.transaction('rw', db.moments, db.media, async () => {
      await editableMoment(momentId)
      await db.media.where('momentId').equals(momentId).delete()
      const row = { id: newId(), momentId, ...media }
      await db.media.put(row)
      return row
    })
  }

  /** Take a postcard's photo away (not once it is sealed). */
  async function removeMedia(momentId) {
    return db.transaction('rw', db.moments, db.media, async () => {
      await editableMoment(momentId)
      await db.media.where('momentId').equals(momentId).delete()
    })
  }

  // ---- song ----

  /**
   * Set or swap a postcard's song: `{ title, artist, source: 'own' | 'suggested' }`, or null to take
   * it off. A sealed postcard is locked.
   */
  async function setSong(momentId, song) {
    return db.transaction('rw', db.moments, async () => {
      const moment = await editableMoment(momentId)
      const clean = song && cleanSong(song)
      const next = {
        ...moment,
        songTitle: clean?.songTitle ?? null,
        songArtist: clean?.songArtist ?? null,
        songSource: clean ? (song.source === 'own' ? 'own' : 'suggested') : null,
        updatedAt: now(),
      }
      await db.moments.put(next)
      return next
    })
  }

  // ---- volumes ----

  const allVolumes = () => db.volumes.toArray()
  /** A volume's cover stickers, one picture sticker per slot. Works for any year, open or closed. */
  async function setCover(year, coverStickers) {
    return db.transaction('rw', db.volumes, async () => {
      const row = (await db.volumes.get(year)) ?? { year, coverStickers: [], closedAt: null }
      const next = { ...row, coverStickers: cleanCover(coverStickers) }
      await db.volumes.put(next)
      return next
    })
  }
  /**
   * Close the volumes of every finished year that has real stamps and has not been closed (the
   * closing ceremony, spec 6.10), once each. Returns the years closed. Demo stamps never close one.
   */
  async function closeVolumes(today, nowMs = now()) {
    return db.transaction('rw', db.moments, db.volumes, async () => {
      const real = (await db.moments.toArray()).filter((m) => m.demo !== true)
      const rows = await db.volumes.toArray()
      const closed = rows.filter((v) => v.closedAt != null).map((v) => v.year)
      const due = yearsToClose(real, today, closed)
      for (const year of due) {
        const row = rows.find((v) => v.year === year) ?? { year, coverStickers: [] }
        await db.volumes.put({ ...row, closedAt: nowMs })
      }
      return due
    })
  }

  // ---- rewards ----

  const allRewards = () => db.rewards.toArray()
  /**
   * Remember any reward earned since last time (golden stamp, streak sticker, complete month, month
   * pack), with when it was first earned. Worked out from real stamps only, never demo ones. Returns
   * the new ones, so a screen can say "New!".
   */
  async function syncRewards(today, nowMs = now()) {
    return db.transaction('rw', db.moments, db.rewards, async () => {
      const real = (await db.moments.toArray()).filter((m) => m.demo !== true)
      const have = new Set((await db.rewards.toArray()).map((r) => r.id))
      const fresh = earnedRewards(real, today)
        .filter((r) => !have.has(r.id))
        .map((r) => ({ ...r, at: nowMs, seen: false }))
      if (fresh.length) await db.rewards.bulkAdd(fresh)
      return fresh
    })
  }
  const markRewardsSeen = () => db.rewards.filter((r) => r.seen === false).modify({ seen: true })

  const mediaForMoment = (momentId) => db.media.where('momentId').equals(momentId).toArray()
  /** The photos of several postcards at once (a month's calendar, say). */
  const mediaForMoments = (ids) =>
    ids.length ? db.media.where('momentId').anyOf(ids).toArray() : Promise.resolve([])
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
  // "forget all my words" takes the combos too: they are words you taught
  const forgetAllWords = () =>
    db.transaction('rw', db.lexicon, db.combos, async () => {
      await db.lexicon.clear()
      await db.combos.clear()
    })

  // ---- combos: words that only count together ("rain" + "chai") ----

  const MAX_COMBOS = 200

  /** Every combo, newest first. Feed it to buildLexicon(rows, moods, combos). */
  async function getCombos() {
    return (await db.combos.toArray()).sort((a, b) => b.createdAt - a.createdAt)
  }

  /**
   * Teach a combo (see comboFromSelection / parseTyped in engine/teach.js): two to four words or
   * phrases that count only when ALL of them are in a note, towards a feeling or topic. Teaching the
   * same set of words again replaces what it meant, so a correction always wins. Returns the row.
   */
  async function saveCombo({ kind, target, parts, example }) {
    if (kind !== 'feeling' && kind !== 'topic')
      throw new Error('A combo is for a feeling or a topic.')
    if (!Array.isArray(parts) || parts.length < 2 || parts.length > 4)
      throw new Error('A combo needs two to four words.')
    const clean = parts.map((p) => ({ word: p?.word, parts: p?.parts ?? 1 }))
    if (!clean.every((p) => /^\p{L}{2,}$/u.test(p.word) && p.parts >= 1 && p.parts <= 5))
      throw new Error('Those words cannot be taught.')
    if (new Set(clean.map((p) => p.word)).size !== clean.length)
      throw new Error('A combo needs different words.')
    if (kind === 'topic' ? !topics[target] : !feelings[target] && !isMyMood(target))
      throw new Error('That is not a mood or topic.')
    return db.transaction('rw', db.combos, db.moods, async () => {
      if (isMyMood(target) && !(await db.moods.get(target)))
        throw new Error('That mood no longer exists.')
      const id = `${kind}:${clean
        .map((p) => p.word)
        .sort()
        .join('+')}`
      if (!(await db.combos.get(id)) && (await db.combos.count()) >= MAX_COMBOS)
        throw new Error('Your combo list is full. Remove some first.')
      const row = {
        id,
        kind,
        target,
        parts: clean,
        example: example ?? clean.map((p) => p.word).join(' + '),
        createdAt: now(),
      }
      await db.combos.put(row)
      return row
    })
  }

  const deleteCombo = (id) => db.combos.delete(id)

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
    return db.transaction('rw', db.moods, db.lexicon, db.combos, async () => {
      const words = await db.lexicon
        .where('id')
        .equals(id)
        .filter((w) => w.kind === 'feeling')
        .primaryKeys()
      await db.lexicon.bulkDelete(words)
      const combos = (await db.combos.toArray()).filter(
        (c) => c.kind === 'feeling' && c.target === id,
      )
      await db.combos.bulkDelete(combos.map((c) => c.id))
      await db.moods.delete(id)
      return words.length + combos.length
    })
  }

  return {
    getLexicon,
    teachWords,
    forgetWord,
    forgetAllWords,
    getCombos,
    saveCombo,
    deleteCombo,
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
    setLook,
    saveMedia,
    setMedia,
    removeMedia,
    mediaForMoment,
    mediaForMoments,
    setSong,
    allDecorations,
    allVolumes,
    setCover,
    closeVolumes,
    allRewards,
    syncRewards,
    markRewardsSeen,
    deleteMediaForMoment,
  }
}

export const queries = makeQueries(defaultDb)
