import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { demo } from '../../db/demo'
import { parseDay } from '../../lib/dates'
import './demo.css'

const NO_STATUS = { demo: 0, own: 0, early: 0 }
const NO_LIST = []

// "12 Sep 2026", from a 'YYYY-MM-DD' day
const shortDay = (day) => {
  const { y, m, d } = parseDay(day)
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/**
 * Testing tools on You: skip the waiting. Demo postcards and "open today's postcard now" let you try
 * the Mailbox, the opening ritual and the year-ago letter in seconds, and "Make your own" lets you
 * write a postcard to try the note reader, mood, palette and stickers. Nothing here touches your
 * real stamps except delivering today's early, which "Remove" puts back.
 */
export default function DemoTools() {
  const status = useLiveQuery(() => demo.status(), [], NO_STATUS)
  const postcards = useLiveQuery(() => demo.list(), [], NO_LIST)
  const [message, setMessage] = useState(null)
  const [busy, setBusy] = useState(false)

  async function run(action, describe) {
    setBusy(true)
    try {
      setMessage({ ok: true, text: describe(await action()), mailbox: true })
    } catch (err) {
      setMessage({ ok: false, text: err.message })
    } finally {
      setBusy(false)
    }
  }

  const addText = ({ added }) =>
    `Added ${added} sample postcards: a month of unopened ones, a letter from a year ago, and an old opened one. The ones you made yourself were kept.`
  const todayText = (result) =>
    ({
      delivered: 'Today’s postcard has been delivered. Open it in the Mailbox.',
      already: 'Today’s postcard is already delivered. Open it in the Mailbox.',
      unsealed: 'Seal today’s postcard first (Stamp it, then Seal & send), then come back.',
      none: 'There is no stamp for today yet. Stamp and seal one, then come back.',
    })[result]
  const removeText = ({ removed, restored }) =>
    `Removed ${removed} demo postcards${restored ? ` and put ${restored} postcard back to its real delivery date` : ''}.`

  return (
    <details className="demo">
      <summary>Testing tools</summary>
      <p className="demo__intro">
        Skip the waiting. Real postcards arrive on the 1st of next month; these let you try the
        Mailbox and the opening ritual right now, or make a postcard yourself to test a note, its
        mood and colors, and stickers.
      </p>
      <div className="demo__actions">
        <Link to="/you/demo">Make your own demo postcard</Link>
        <button disabled={busy} onClick={() => run(() => demo.addPostcards(), addText)}>
          {status.demo > 0 ? 'Reset the sample postcards' : 'Add sample postcards'}
        </button>
        <button disabled={busy} onClick={() => run(() => demo.deliverToday(), todayText)}>
          Open today’s postcard now
        </button>
        <button
          className="demo__remove"
          disabled={busy || (status.demo === 0 && status.early === 0)}
          onClick={() => run(() => demo.removeDemo(), removeText)}
        >
          Remove demo postcards
        </button>
      </div>
      <p className="demo__status">
        {status.demo} demo postcards
        {status.own > 0 ? ` (${status.own} made by you)` : ''}
        {status.early > 0 ? `, ${status.early} delivered early` : ''}
      </p>
      {postcards.length > 0 && (
        <details className="demo__postcards" open={status.own > 0}>
          <summary>See and change them</summary>
          <ul className="demo__list" aria-label="Demo postcards">
            {postcards.map((p) => (
              <li key={p.id}>
                <time dateTime={p.day}>{shortDay(p.day)}</time>
                <span>
                  {p.own && <em>Yours · </em>}
                  {p.note}
                </span>
                <div>
                  <Link
                    to={`/you/demo/${p.id}/stickers`}
                    aria-label={`Stickers for ${shortDay(p.day)}`}
                  >
                    Stickers
                  </Link>
                  <Link
                    to={`/you/demo/${p.id}`}
                    aria-label={`Change the note from ${shortDay(p.day)}`}
                  >
                    Note &amp; mood
                  </Link>
                  <button
                    disabled={busy}
                    aria-label={`Delete the demo postcard from ${shortDay(p.day)}`}
                    onClick={() =>
                      run(
                        () => demo.removeOne(p.id),
                        () => 'Deleted that demo postcard.',
                      )
                    }
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </details>
      )}
      {message && (
        <p className={message.ok ? 'demo__msg' : 'demo__msg demo__msg--err'} role="status">
          {message.text}{' '}
          {message.ok && message.mailbox && <Link to="/mailbox">Go to the Mailbox</Link>}
        </p>
      )}
    </details>
  )
}
