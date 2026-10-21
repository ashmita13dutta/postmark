import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { queries } from '../../db/queries'
import { now } from '../../lib/clock'
import { dayKey } from '../../lib/dates'
import { dailyReminder, deliveryReminder } from '../../lib/ics'
import { downloadBlob } from '../../lib/platform'
import './profile.css'

const asFile = (text) => new Blob([text], { type: 'text/calendar;charset=utf-8' })

/**
 * You > Reminders. A web app cannot ring while it is closed, so a reminder is a calendar event: tap
 * to download it, open it, and your phone's Calendar repeats it for you.
 */
export default function Reminders() {
  const settings = useLiveQuery(() => queries.getSettings(), [], null)
  const [message, setMessage] = useState(null)
  const [time, setTime] = useState(null) // null until you touch it: show the saved one
  if (!settings) return null
  const shownTime = time ?? settings.reminderTime ?? '21:00'

  function monthly() {
    downloadBlob(
      asFile(
        deliveryReminder({
          deliveryDay: settings.deliveryDay,
          today: dayKey(now()),
          nowMs: now(),
        }),
      ),
      'postmark-delivery-day.ics',
    )
    setMessage('Open the file you just downloaded and add it to your calendar.')
  }

  async function daily() {
    try {
      await queries.setSetting('reminderTime', shownTime)
      downloadBlob(
        asFile(dailyReminder({ time: shownTime, today: dayKey(now()), nowMs: now() })),
        'postmark-daily-reminder.ics',
      )
      setMessage('Open the file you just downloaded and add it to your calendar.')
    } catch (err) {
      setMessage(err.message)
    }
  }

  return (
    <section className="prefs" aria-label="Reminders">
      <h2>Reminders</h2>
      <p className="prefs__intro">
        A web app cannot send a reminder while it is closed, so these are calendar events. Add one
        and your phone’s Calendar does the reminding.
      </p>
      <div className="prefs__row prefs__row--stack">
        <span>
          Postcards have arrived
          <small>Every month on the {settings.deliveryDay}, at 9 in the morning.</small>
        </span>
        <button onClick={monthly}>Download</button>
      </div>
      <div className="prefs__row prefs__row--stack">
        <span>
          Stamp your day
          <small>Every day at</small>
        </span>
        <input
          type="time"
          value={shownTime}
          onChange={(e) => setTime(e.target.value)}
          aria-label="Time of the daily reminder"
        />
        <button onClick={daily}>Download</button>
      </div>
      {message && (
        <p className="prefs__note" role="status">
          {message}
        </p>
      )}
    </section>
  )
}
