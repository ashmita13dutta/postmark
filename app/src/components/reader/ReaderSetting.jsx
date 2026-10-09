import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { queries } from '../../db/queries'
import { startReader, stopReader } from '../../engine/reader/client'
import { readerSupported } from '../../engine/reader/support'
import { useReader } from '../../engine/reader/useReader'
import './reader.css'

/** The note reader's switch on You, plus a way to take your corrected notes with you. */
export default function ReaderSetting() {
  const reader = useReader()
  const setting = useLiveQuery(() => queries.getSetting('smartReading'), [])
  const corrections = useLiveQuery(() => queries.getCorrections(), [], [])
  const [copied, setCopied] = useState(false)
  if (setting === undefined) return null

  const on = setting === 'on'
  let line = 'Off. Notes are read the built-in way.'
  if (!readerSupported())
    line = 'This browser cannot run the reader, so notes are read the built-in way.'
  else if (on && reader.status === 'ready')
    line = 'On. Notes are read on your phone, and never leave it.'
  else if (on && reader.status === 'loading') line = 'Getting the reader…'
  else if (on && reader.status === 'error')
    line = 'Couldn’t get the reader. Notes are read the built-in way.'
  else if (on) line = 'On. Opening the reader…'

  // [note, feeling you chose, "*"]: the same shape as the test notes in tests/corpus/
  async function copyNotes() {
    const rows = corrections.map((c) => [c.text, c.feeling, '*'])
    const text = `${JSON.stringify(rows, null, 1)}`
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      window.prompt('Copy your corrected notes:', text)
    }
  }

  return (
    <section className="reader-setting" aria-label="Smarter note reading">
      <h2>Smarter note reading</h2>
      <p>{line}</p>
      <div className="reader-setting__actions">
        {readerSupported() &&
          (on ? (
            <button
              onClick={async () => {
                stopReader()
                await queries.setSetting('smartReading', 'off')
              }}
            >
              Turn off
            </button>
          ) : (
            <button
              className="primary"
              onClick={async () => {
                await queries.setSetting('smartReading', 'on')
                startReader()
              }}
            >
              Turn on (about 50 MB, once)
            </button>
          ))}
        {on && reader.status === 'error' && (
          <button className="primary" onClick={() => startReader()}>
            Try again
          </button>
        )}
      </div>
      {corrections.length > 0 && (
        <>
          <p style={{ marginTop: 14 }}>
            {corrections.length} {corrections.length === 1 ? 'note' : 'notes'} you corrected. They
            are kept on this phone, and a near-identical note will follow your choice.
          </p>
          <div className="reader-setting__actions">
            <button onClick={copyNotes}>{copied ? 'Copied' : 'Copy them'}</button>
            <button onClick={() => queries.forgetCorrections()}>Forget them</button>
          </div>
        </>
      )}
    </section>
  )
}
