import { useLiveQuery } from 'dexie-react-hooks'
import { useRef, useState } from 'react'
import { queries } from '../../db/queries'
import { BackupError, backup, backupFileName, parseBackup } from '../../lib/backup'
import { now } from '../../lib/clock'
import { parseDay } from '../../lib/dates'
import { share } from '../../lib/platform'
import './backup.css'

const REMIND_AFTER_DAYS = 30
const DAY_MS = 86_400_000

// "3 Jan 2026", from a 'YYYY-MM-DD' day or a timestamp
const shown = (v) => {
  const date =
    typeof v === 'number' ? new Date(v) : (({ y, m, d }) => new Date(y, m - 1, d))(parseDay(v))
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

/**
 * You > Back up your stamps. Your stamps live only on this phone, so this saves them as one file you
 * keep somewhere safe, and brings such a file back. Importing shows what is in the file first and
 * never replaces a day you already have unless you choose to.
 */
export default function BackupCard() {
  const stamps = useLiveQuery(
    async () => (await queries.allMoments()).filter((m) => m.demo !== true).length,
    [],
    0,
  )
  const lastBackupAt = useLiveQuery(() => queries.getSetting('lastBackupAt'), [], null)
  const [message, setMessage] = useState(null) // { ok, text }
  const [pending, setPending] = useState(null) // { parsed, summary, name }
  const [busy, setBusy] = useState(false)
  const picker = useRef(null)

  const overdue =
    stamps > 0 && (lastBackupAt == null || now() - lastBackupAt > REMIND_AFTER_DAYS * DAY_MS)

  async function save() {
    setBusy(true)
    setMessage(null)
    try {
      const out = await backup.exportBackup()
      const name = backupFileName()
      const file = new File([out.bytes], name, { type: 'application/zip' })
      const result = await share({ title: 'Postmark backup', files: [file] })
      if (result === 'cancelled' || result === 'unsupported') return
      await queries.setSetting('lastBackupAt', now())
      setMessage({
        ok: true,
        text: out.counts.moments
          ? `Saved ${plural(out.counts.moments, 'stamp')} (${shown(out.first)} to ${shown(out.last)}) as ${name}. Keep it somewhere safe, like Files or an email to yourself.`
          : `Saved ${name}. There are no stamps in it yet.`,
      })
    } catch (err) {
      setMessage({ ok: false, text: err.message })
    } finally {
      setBusy(false)
    }
  }

  async function pick(e) {
    const file = e.target.files?.[0]
    e.target.value = '' // so the same file can be picked again
    if (!file) return
    setBusy(true)
    setMessage(null)
    setPending(null)
    try {
      const parsed = parseBackup(new Uint8Array(await file.arrayBuffer()))
      setPending({ parsed, summary: await backup.summarize(parsed), name: file.name })
    } catch (err) {
      setMessage({
        ok: false,
        text: err instanceof BackupError ? err.message : 'Could not read that file.',
      })
    } finally {
      setBusy(false)
    }
  }

  async function bringIn(replaceClashes) {
    setBusy(true)
    try {
      const r = await backup.importBackup(pending.parsed, { replaceClashes })
      const bits = [
        r.added && `added ${plural(r.added, 'stamp')}`,
        r.replaced && `replaced ${plural(r.replaced, 'day')} with the backup’s`,
        r.kept && `kept your version of ${plural(r.kept, 'day')}`,
        r.skipped && `left out ${plural(r.skipped, 'damaged stamp')}`,
      ].filter(Boolean)
      setMessage({
        ok: true,
        text: bits.length
          ? `Done: ${bits.join(', ')}.`
          : 'Done. There was nothing new in that backup.',
      })
      setPending(null)
    } catch (err) {
      setMessage({
        ok: false,
        text:
          err instanceof BackupError
            ? err.message
            : 'The import did not finish, so nothing was changed.',
      })
    } finally {
      setBusy(false)
    }
  }

  const s = pending?.summary
  return (
    <section className="backup" aria-label="Back up your stamps">
      <h2>Back up your stamps</h2>
      <p>
        Your stamps live only on this phone. A backup is one file you keep somewhere safe. Postcards
        from the testing tools are never included.
      </p>
      <p className={overdue ? 'backup__status backup__status--due' : 'backup__status'}>
        {plural(stamps, 'stamp')} ·{' '}
        {lastBackupAt == null ? 'never backed up' : `last backup ${shown(lastBackupAt)}`}
        {overdue && ' · time for a new one'}
      </p>

      <div className="backup__actions">
        <button className="backup__primary" disabled={busy} onClick={save}>
          Save a backup
        </button>
        <button disabled={busy} onClick={() => picker.current?.click()}>
          Bring a backup back
        </button>
        <input
          ref={picker}
          type="file"
          accept=".zip,application/zip"
          hidden
          onChange={pick}
          aria-label="Choose a Postmark backup file"
        />
      </div>

      {s && (
        <div className="backup__found" role="group" aria-label="What is in this backup">
          <p>
            <b>{pending.name}</b> has {plural(s.stamps, 'stamp')}
            {s.first && ` (${shown(s.first)} to ${shown(s.last)})`}
            {s.exportedAt && `, saved ${shown(s.exportedAt)}`}.{' '}
            {s.added === s.stamps
              ? 'All of them are new to this phone.'
              : s.added === 0
                ? 'None of them are new to this phone.'
                : `${s.added} ${s.added === 1 ? 'is' : 'are'} new to this phone.`}
          </p>
          {s.clashes.length > 0 && (
            <p>
              {plural(s.clashes.length, 'day')} {s.clashes.length === 1 ? 'is' : 'are'} on both.
              Your version is kept unless you choose otherwise.
            </p>
          )}
          <div className="backup__actions">
            <button className="backup__primary" disabled={busy} onClick={() => bringIn(false)}>
              {s.clashes.length ? 'Add the new ones, keep mine' : 'Bring them in'}
            </button>
            {s.clashes.length > 0 && (
              <button className="backup__danger" disabled={busy} onClick={() => bringIn(true)}>
                Use the backup’s version of {plural(s.clashes.length, 'shared day')}
              </button>
            )}
            <button disabled={busy} onClick={() => setPending(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {message && (
        <p className={message.ok ? 'backup__msg' : 'backup__msg backup__msg--err'} role="status">
          {message.text}
        </p>
      )}
    </section>
  )
}
