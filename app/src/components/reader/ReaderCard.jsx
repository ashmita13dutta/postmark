import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect } from 'react'
import { queries } from '../../db/queries'
import { startReader } from '../../engine/reader/client'
import { readerSupported } from '../../engine/reader/support'
import { useReader } from '../../engine/reader/useReader'
import './reader.css'

const mb = (bytes) => Math.round(bytes / 1e6)

/**
 * Today's card for the on-device note reader. It asks once (a one-time download of about 50 MB),
 * shows the download, and offers a retry if it fails. When the reader is ready, or the browser
 * cannot run it, or you said no, it shows nothing and the screen is exactly as before.
 */
export default function ReaderCard() {
  const reader = useReader()
  // undefined while loading, then null (not asked yet), 'on' or 'off'
  const setting = useLiveQuery(() => queries.getSetting('smartReading'), [])

  // you already said yes: open the reader (from the browser's cache after the first time)
  useEffect(() => {
    if (setting === 'on' && reader.status === 'idle') startReader()
  }, [setting, reader.status])

  if (setting === undefined || !readerSupported()) return null

  if (setting === null) {
    return (
      <section className="reader" aria-label="Smarter note reading">
        <h2>Read my notes more carefully</h2>
        <p>
          A small reader that lives on your phone and understands what you wrote. It is a one-time
          download of about 50 MB, then it works offline. Your notes never leave your phone.
        </p>
        <div className="reader__actions">
          <button
            className="reader__yes"
            onClick={async () => {
              await queries.setSetting('smartReading', 'on')
              startReader()
            }}
          >
            Download
          </button>
          <button className="reader__no" onClick={() => queries.setSetting('smartReading', 'off')}>
            Not now
          </button>
        </div>
      </section>
    )
  }

  if (setting === 'on' && reader.status === 'loading') {
    const known = reader.total > 0
    return (
      <section className="reader reader--quiet" aria-label="Getting the reader" role="status">
        <p>
          {known
            ? `Getting the reader… ${mb(reader.loaded)} of ${mb(reader.total)} MB`
            : 'Opening the reader…'}
        </p>
        <div
          className={known ? 'reader__bar' : 'reader__bar reader__bar--wait'}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={known ? reader.total : undefined}
          aria-valuenow={known ? reader.loaded : undefined}
          aria-label="Reader download"
        >
          <i style={known ? { width: `${(100 * reader.loaded) / reader.total}%` } : undefined} />
        </div>
      </section>
    )
  }

  if (setting === 'on' && reader.status === 'error') {
    return (
      <section className="reader" aria-label="The reader could not start">
        <p>Couldn’t get the reader just now. Your notes are still read the built-in way.</p>
        <div className="reader__actions">
          <button className="reader__yes" onClick={() => startReader()}>
            Try again
          </button>
        </div>
      </section>
    )
  }

  return null
}
