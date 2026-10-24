/**
 * Backup: everything you have made, in one `.zip` you keep, and a way to bring it back.
 *
 * The zip holds `data.json` (every table, with the app's format and schema version) and any photos
 * or cut-outs as separate files. Nothing here talks to a network. Demo postcards (the testing tools
 * on You) are test data and are never saved. Importing MERGES by day: a day you already have is
 * kept unless you ask for the backup's version, and nothing else is ever overwritten.
 *
 * Built from a db instance, like db/queries.js, so tests can use an isolated database.
 */
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import { now } from './clock'
import { parseDay } from './dates'
import { SCHEMA_VERSION, db as defaultDb } from '../db/schema'

/** Bump when the layout of the zip changes in a way an older app cannot read. */
export const BACKUP_FORMAT = 1

/** Every table, and the field that identifies a row in it. */
const KEYS = {
  moments: 'id',
  decorations: 'id',
  seals: 'momentId',
  media: 'id',
  drawings: 'momentId',
  customStickers: 'id',
  unlocks: 'id',
  rewards: 'id',
  calendarStickers: 'id',
  redeliveries: 'monthKey',
  volumes: 'year',
  settings: 'key',
  lexicon: 'word',
  moods: 'id',
  combos: 'id',
  corrections: 'id',
}
/** Tables whose rows belong to one postcard (by `momentId`) and travel with it. */
const CHILDREN = ['decorations', 'seals', 'media', 'drawings']
const FILL_MISSING = Object.keys(KEYS).filter(
  (t) => t !== 'moments' && t !== 'redeliveries' && !CHILDREN.includes(t),
)

/** A problem with a backup file, worded for the person who picked it. */
export class BackupError extends Error {
  constructor(message) {
    super(message)
    this.name = 'BackupError'
  }
}

const newId = () => globalThis.crypto.randomUUID()
const isBlob = (v) => typeof Blob !== 'undefined' && v instanceof Blob

/** Replace each Blob in a row by a pointer to a file in the zip, and collect the files. */
async function stripBlobs(table, row, files) {
  const out = { ...row }
  const put = async (path, blob) => {
    files[path] = [new Uint8Array(await blob.arrayBuffer()), { level: 0 }] // photos are compressed already
    return { $file: path, type: blob.type }
  }
  for (const [key, value] of Object.entries(row)) {
    const base = `${table}/${row[KEYS[table]]}/${key}`
    if (isBlob(value)) out[key] = await put(base, value)
    // a list of pictures (the originals kept while a postcard can still be changed)
    else if (Array.isArray(value) && value.length && value.every(isBlob))
      out[key] = await Promise.all(value.map((b, i) => put(`${base}/${i}`, b)))
  }
  return out
}

/** The reverse: turn pointers back into Blobs. */
function reviveBlobs(row, files) {
  const out = { ...row }
  const one = (ref) => {
    const bytes = files[ref.$file]
    if (!bytes) throw new BackupError('The backup is missing a photo it mentions.')
    return new Blob([bytes], { type: ref.type ?? '' })
  }
  const isRef = (v) => v && typeof v === 'object' && typeof v.$file === 'string'
  for (const [key, value] of Object.entries(row)) {
    if (isRef(value)) out[key] = one(value)
    else if (Array.isArray(value) && value.length && value.every(isRef)) out[key] = value.map(one)
  }
  return out
}

export function makeBackup(db) {
  /**
   * Everything worth keeping, as a zip. Returns { bytes, counts, first, last }.
   * Demo postcards are left out; a postcard delivered early by the testing tools goes back to its
   * real delivery date, unopened, exactly as "Remove demo postcards" would leave it.
   */
  async function exportBackup() {
    const files = {}
    const moments = (await db.moments.toArray())
      .filter((m) => m.demo !== true)
      .map(({ earlySealedUntil, ...m }) =>
        earlySealedUntil != null ? { ...m, sealedUntil: earlySealedUntil, openedAt: null } : m,
      )
    const kept = new Set(moments.map((m) => m.id))

    const tables = { moments }
    for (const table of Object.keys(KEYS)) {
      if (table === 'moments') continue
      let rows = await db[table].toArray()
      if (CHILDREN.includes(table)) rows = rows.filter((r) => kept.has(r.momentId))
      if (table === 'redeliveries')
        rows = rows.filter((r) => r.momentId == null || kept.has(r.momentId))
      tables[table] = await Promise.all(rows.map((r) => stripBlobs(table, r, files)))
    }
    const days = moments.map((m) => m.day).sort()
    const data = {
      app: 'postmark',
      format: BACKUP_FORMAT,
      schemaVersion: SCHEMA_VERSION,
      exportedAt: now(),
      tables,
    }
    const bytes = zipSync({ 'data.json': strToU8(JSON.stringify(data)), ...files })
    return {
      bytes,
      first: days[0] ?? null,
      last: days[days.length - 1] ?? null,
      counts: Object.fromEntries(Object.entries(tables).map(([t, rows]) => [t, rows.length])),
    }
  }

  /** What is in a backup that is already on this phone and what is new. Changes nothing. */
  async function summarize({ data }) {
    // a demo postcard is only test data: a real postcard from the backup simply takes its day
    const mine = new Map(
      (await db.moments.toArray()).filter((m) => m.demo !== true).map((m) => [m.day, m]),
    )
    const incoming = usableMoments(data)
    const clashes = incoming.filter((m) => mine.has(m.day)).map((m) => m.day)
    const days = incoming.map((m) => m.day).sort()
    return {
      stamps: incoming.length,
      added: incoming.length - clashes.length,
      clashes,
      first: days[0] ?? null,
      last: days[days.length - 1] ?? null,
      exportedAt: data.exportedAt ?? null,
    }
  }

  /**
   * Bring a parsed backup in. `replaceClashes` decides what happens on a day that is on both: false
   * keeps yours, true takes the backup's version of that day. Everything else (words, moods,
   * settings and so on) is only added when missing, never overwritten.
   * @returns {{ added: number, replaced: number, kept: number, skipped: number }}
   */
  async function importBackup({ data, files }, { replaceClashes = false } = {}) {
    const incoming = usableMoments(data)
    const skipped = (data.tables.moments?.length ?? 0) - incoming.length
    const result = { added: 0, replaced: 0, kept: 0, skipped }
    // revived before the transaction: building Blobs is not database work
    const revived = {}
    for (const table of [...CHILDREN, ...FILL_MISSING])
      revived[table] = (data.tables[table] ?? []).map((r) => reviveBlobs(r, files))

    await db.transaction(
      'rw',
      Object.keys(KEYS).map((t) => db[t]),
      async () => {
        const byDay = new Map((await db.moments.toArray()).map((m) => [m.day, m]))
        const takenIds = new Set(await db.moments.toCollection().primaryKeys())
        const idMap = new Map() // the backup's postcard id -> the id it has here

        for (const m of incoming) {
          let mine = byDay.get(m.day)
          if (mine?.demo === true) {
            await removeMoment(mine.id)
            takenIds.delete(mine.id)
            mine = undefined
          }
          if (mine && !replaceClashes) {
            result.kept++
            continue
          }
          if (mine) {
            await removeMoment(mine.id)
            takenIds.delete(mine.id)
            result.replaced++
          } else result.added++
          const id = takenIds.has(m.id) ? newId() : m.id
          takenIds.add(id)
          idMap.set(m.id, id)
          await db.moments.add({ ...m, id })
        }

        // what belongs to the postcards that came in
        for (const table of CHILDREN) {
          const rows = revived[table].filter((r) => idMap.has(r.momentId))
          for (const r of rows) {
            const row = { ...r, momentId: idMap.get(r.momentId) }
            if (table === 'decorations' || table === 'media') {
              if (await db[table].get(row.id)) row.id = newId()
            }
            await db[table].put(row)
          }
        }

        // where a postcard was chosen to arrive "delayed in transit", if this month has no choice yet
        for (const r of data.tables.redeliveries ?? []) {
          if (await db.redeliveries.get(r.monthKey)) continue
          if (r.momentId == null) await db.redeliveries.put(r)
          else if (idMap.has(r.momentId))
            await db.redeliveries.put({ ...r, momentId: idMap.get(r.momentId) })
        }

        for (const table of FILL_MISSING) {
          const have = new Set(await db[table].toCollection().primaryKeys())
          const fresh = revived[table].filter((r) => !have.has(r[KEYS[table]]))
          if (fresh.length) await db[table].bulkAdd(fresh)
        }
      },
    )
    return result
  }

  async function removeMoment(id) {
    for (const table of CHILDREN) await db[table].where('momentId').equals(id).delete()
    for (const r of await db.redeliveries.toArray())
      if (r.momentId === id) await db.redeliveries.delete(r.monthKey)
    await db.moments.delete(id)
  }

  return { exportBackup, summarize, importBackup }
}

/** The postcards in a backup that look right: a real day, an id, five palette colors. */
function usableMoments(data) {
  const out = []
  const seen = new Set()
  for (const m of data.tables.moments ?? []) {
    try {
      parseDay(m.day)
    } catch {
      continue
    }
    if (typeof m.id !== 'string' || seen.has(m.day)) continue
    if (!Array.isArray(m.palette) || m.palette.length !== 5) continue
    seen.add(m.day)
    out.push(m)
  }
  return out
}

/**
 * Open the bytes of a backup file and check them. Throws a BackupError with a message fit to show.
 * @returns {{ data: object, files: Record<string, Uint8Array> }}
 */
export function parseBackup(bytes) {
  let files
  try {
    files = unzipSync(bytes)
  } catch {
    throw new BackupError(
      'That file is not a Postmark backup. Pick the .zip you saved from Postmark.',
    )
  }
  if (!files['data.json']) throw new BackupError('That zip is not a Postmark backup.')
  let data
  try {
    data = JSON.parse(strFromU8(files['data.json']))
  } catch {
    throw new BackupError('The backup is damaged: its data could not be read.')
  }
  if (data?.app !== 'postmark' || typeof data.tables !== 'object' || data.tables === null)
    throw new BackupError('That zip is not a Postmark backup.')
  if (!Number.isInteger(data.format) || data.format > BACKUP_FORMAT)
    throw new BackupError(
      'This backup was made by a newer version of Postmark. Reload the app to update it, then try again.',
    )
  return { data, files }
}

/** A file name for a new backup: postmark-backup-2026-10-15.zip */
export function backupFileName(ms = now()) {
  const d = new Date(ms)
  const pad = (n) => String(n).padStart(2, '0')
  return `postmark-backup-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.zip`
}

export const backup = makeBackup(defaultDb)
