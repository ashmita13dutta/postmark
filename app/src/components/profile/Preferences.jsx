import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { queries } from '../../db/queries'
import { MAX_DELIVERY_DAY, MIN_DELIVERY_DAY } from '../../lib/dates'
import { ordinal } from '../../lib/profile'
import './profile.css'

const DAYS = Array.from(
  { length: MAX_DELIVERY_DAY - MIN_DELIVERY_DAY + 1 },
  (_, i) => MIN_DELIVERY_DAY + i,
)

/**
 * You > Preferences. Only what really does something: the day each month's postcards arrive (every
 * postcard still waiting is re-timed), and whether the stamp reveal plays its animation.
 */
export default function Preferences() {
  const settings = useLiveQuery(() => queries.getSettings(), [], null)
  const [error, setError] = useState(null)
  if (!settings) return null

  const change = (key, value) => queries.setSetting(key, value).catch((e) => setError(e.message))

  return (
    <section className="prefs" aria-label="Preferences">
      <h2>Preferences</h2>
      <label className="prefs__row">
        <span>
          Postcards arrive on the
          <small>
            {ordinal(settings.deliveryDay)} of next month. Changing it re-times the ones still
            waiting.
          </small>
        </span>
        <select
          value={settings.deliveryDay}
          onChange={(e) => change('deliveryDay', Number(e.target.value))}
          aria-label="Delivery day of the month"
        >
          {DAYS.map((d) => (
            <option key={d} value={d}>
              {ordinal(d)}
            </option>
          ))}
        </select>
      </label>
      <label className="prefs__row">
        <span>
          Stamp reveal animation
          <small>The colors pouring in when you stamp a day. Off shows the finished stamp.</small>
        </span>
        <input
          type="checkbox"
          role="switch"
          checked={settings.revealAnimation}
          onChange={(e) => change('revealAnimation', e.target.checked)}
        />
      </label>
      {error && (
        <p className="prefs__error" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}
