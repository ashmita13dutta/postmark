/**
 * Dexie (IndexedDB) schema. Everything lives on the device.
 *
 * Shapes (plain objects, documented here because this project is JavaScript):
 *
 *  moments          { id, day, stampNo, note, city, lat, lon, songTitle, songArtist,
 *                     songSource: 'own'|'suggested'|null,
 *                     palette: [{hex, name} x5], paletteSource: 'moment'|'photo'|'manual',
 *                     feeling, topic, sealedUntil, openedAt, sealedAt, createdAt, updatedAt }
 *  media            { id, momentId, kind: 'single'|'strip', blob, thumb,
 *                     filter: 'none'|'vintage'|'vibrant', intensity, layoutSeed }
 *  decorations      { id, momentId, stickerId, x, y, rotation, scale, side: 'back'|'front', z }
 *  drawings         { momentId, strokes: [{color, width, points}] }   counts as ONE decoration
 *  seals            { momentId, color, emblem: 'heart'|'star'|'moon'|'initial', initial? }
 *  customStickers   { id, blob, createdFrom: 'manual'|'auto', createdAt }
 *  unlocks          { id, packId, unlockedBy: 'city'|'month'|'streak'|'start', at }
 *  rewards          { id, kind: 'golden-stamp'|'complete-month'|'streak-sticker', monthKey?, at }
 *  calendarStickers { id, monthKey, stickerId?, label?, x, y }
 *  redeliveries     { monthKey, momentId }                  delayed-in-transit pick, fixed per month
 *  volumes          { year, coverStickers, closedAt }
 *  settings         { key, value }
 *  corrections      { id (the day), text, vector: number[384], guess, feeling, createdAt }
 *                   a note you told the app it had read wrong: the note, its embedding from the
 *                   on-device reader, what the app guessed, and the feeling you chose. One per day.
 *                   Later near-identical notes follow it; it is also real, labelled data.
 *  moods            { id ('my:' + 8 characters), label, colors: [{hex, name} x5], createdAt }
 *                   a feeling you made up. Words taught to it are lexicon rows with kind 'feeling'
 *                   and this id; a postcard keeps the id as its `feeling` and its own five colors.
 *  lexicon          { word, kind: 'feeling'|'topic', id, parts, example, createdAt }   words you taught
 *                   `word` is the word or phrase written joined ("bekaar", "passedaway"); one row
 *                   per word, so teaching a word again replaces what it meant before.
 *
 * `day` is a local-calendar 'YYYY-MM-DD'; every other time is epoch ms.
 */
import Dexie from 'dexie'

export const SCHEMA_VERSION = 4

export class PostmarkDB extends Dexie {
  constructor(name = 'postmark') {
    super(name)
    // Version the schema from day one. To change it, add a NEW this.version(n) below with an
    // upgrade function. Never edit a published version.
    this.version(1).stores({
      moments: 'id, &day, stampNo, sealedUntil, openedAt',
      media: 'id, momentId',
      decorations: 'id, momentId',
      drawings: 'momentId',
      seals: 'momentId',
      customStickers: 'id',
      unlocks: 'id, packId',
      rewards: 'id, kind, monthKey',
      calendarStickers: 'id, monthKey',
      redeliveries: 'monthKey',
      volumes: 'year',
      settings: 'key',
    })
    // v2: the words you teach the mood engine. Only the new table is listed; the rest carry over.
    this.version(2).stores({
      lexicon: 'word, kind, id',
    })
    // v3: notes you corrected, kept for the on-device reader. Only the new table is listed.
    this.version(3).stores({
      corrections: 'id, createdAt',
    })
    // v4: the moods you make up. Only the new table is listed.
    this.version(4).stores({
      moods: 'id, createdAt',
    })
  }
}

export const db = new PostmarkDB()
