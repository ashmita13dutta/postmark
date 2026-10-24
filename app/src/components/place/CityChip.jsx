import { useState } from 'react'
import { nearestCity, placeName, searchCities } from '../../engine/city'
import { currentPosition } from '../../lib/location'
import './place.css'

/**
 * "Posted from": the place that goes on today's postmark. A small chip that opens into a panel: use
 * the phone's location (asked only when you tap it, and only the city's name is kept), search the
 * list of cities, or type a place that is not listed.
 *  - value:    the place name, or null
 *  - onChange: called with a place name, or null for none
 *  - home:     your home city, offered as a one-tap choice
 */
export default function CityChip({ value, onChange, home }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState(null)
  const found = searchCities(query)
  const typed = placeName(query)
  const offerTyped = typed && !found.some((c) => c.name === typed)

  function choose(name) {
    onChange(name)
    setOpen(false)
    setQuery('')
    setNote(null)
  }

  async function useLocation() {
    setBusy(true)
    setNote(null)
    try {
      const { lat, lon } = await currentPosition()
      const match = nearestCity(lat, lon)
      if (match) choose(match.city.name)
      else setNote('No city on the list is near you. Search for one, or type the place.')
    } catch (err) {
      setNote(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="place" aria-label="Where you are">
      <button className="place__chip" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="place__label">Posted from</span>
        <b>{value ?? 'nowhere in particular'}</b>
        <span className="place__edit">{open ? 'Close' : 'Change'}</span>
      </button>

      {open && (
        <div className="place__panel">
          <button className="place__locate" disabled={busy} onClick={useLocation}>
            {busy ? 'Finding you…' : 'Use my location'}
          </button>
          <input
            type="search"
            className="place__search"
            value={query}
            maxLength={40}
            placeholder="Search a city, or type a place"
            aria-label="Search for a city"
            autoComplete="off"
            onChange={(e) => setQuery(e.target.value)}
          />
          <ul className="place__results" aria-label="Cities">
            {found.map((c) => (
              <li key={c.name}>
                <button onClick={() => choose(c.name)}>
                  {c.name}
                  <small>{c.country}</small>
                </button>
              </li>
            ))}
            {offerTyped && (
              <li>
                <button onClick={() => choose(typed)}>
                  Use “{typed}”<small>as typed</small>
                </button>
              </li>
            )}
          </ul>
          <div className="place__quick">
            {home && home !== value && <button onClick={() => choose(home)}>Home: {home}</button>}
            {value && <button onClick={() => choose(null)}>No place</button>}
          </div>
          {note && (
            <p className="place__note" role="status">
              {note}
            </p>
          )}
        </div>
      )}
    </section>
  )
}
