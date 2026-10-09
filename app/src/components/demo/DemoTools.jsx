import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { demo } from '../../db/demo'
import './demo.css'

const NO_STATUS = { demo: 0, early: 0 }

/**
 * Testing tools on You: skip the waiting. Demo postcards and "open today's postcard now" let you try
 * the Mailbox, the opening ritual and the year-ago letter in seconds. Nothing here touches your real
 * stamps except delivering today's early, which "Remove" puts back.
 */
export default function DemoTools() {
  const status = useLiveQuery(() => demo.status(), [], NO_STATUS)
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
    `Added ${added} demo postcards: a month of unopened ones, a letter from a year ago, and an old opened one.`
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
        Mailbox and the opening ritual right now.
      </p>
      <div className="demo__actions">
        <button disabled={busy} onClick={() => run(() => demo.addPostcards(), addText)}>
          {status.demo > 0 ? 'Reset the demo postcards' : 'Add demo postcards'}
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
        {status.early > 0 ? `, ${status.early} delivered early` : ''}
      </p>
      {message && (
        <p className={message.ok ? 'demo__msg' : 'demo__msg demo__msg--err'} role="status">
          {message.text}{' '}
          {message.ok && message.mailbox && <Link to="/mailbox">Go to the Mailbox</Link>}
        </p>
      )}
    </details>
  )
}
