import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { queries } from '../../db/queries'
import { now } from '../../lib/clock'
import { dayKey } from '../../lib/dates'
import { cleanName, profileStats, sinceLabel } from '../../lib/profile'
import Stamp from '../stamp/Stamp'
import './profile.css'

const NO_ROWS = []

/**
 * You > the postmaster card, styled like a vintage postal ID: your name, home city and when you
 * joined, with the numbers that say how you are doing. Name and city save when you leave the box.
 */
export default function PostmasterCard() {
  const settings = useLiveQuery(() => queries.getSettings(), [], null)
  // the boxes start from the saved values, so wait for them before showing the card
  if (!settings) return null
  return <Card settings={settings} />
}

function Card({ settings }) {
  const moments = useLiveQuery(() => queries.allMoments(), [], NO_ROWS)
  const stats = useMemo(() => profileStats(moments, dayKey(now())), [moments])
  // the newest real stamp is the picture on the card; a blank one until there is a stamp
  const latest = useMemo(
    () => moments.filter((m) => m.demo !== true).sort((a, b) => (a.day < b.day ? 1 : -1))[0],
    [moments],
  )

  const [name, setName] = useState(settings.name ?? '')
  const [city, setCity] = useState(settings.homeCity ?? '')

  const save = (key, value) => queries.setSetting(key, value)

  return (
    <section className="postmaster" aria-label="Postmaster card">
      <div className="postmaster__head">
        <span>Postmark</span>
        <span>Postal ID</span>
      </div>
      <div className="postmaster__body">
        <Stamp
          colors={latest ? latest.palette.map((c) => c.hex) : undefined}
          seed={latest?.day ?? 'postmaster'}
          width={78}
          small
          label={latest ? 'Your latest stamp' : 'A blank stamp'}
        />
        <div className="postmaster__fields">
          <label>
            <span className="lbl">Postmaster</span>
            <input
              type="text"
              value={name}
              maxLength={30}
              placeholder="Your name"
              autoComplete="off"
              onChange={(e) => setName(e.target.value)}
              onBlur={() => {
                const clean = cleanName(name)
                setName(clean)
                save('name', clean)
              }}
            />
          </label>
          <label>
            <span className="lbl">Home city</span>
            <input
              type="text"
              value={city}
              maxLength={40}
              placeholder="Where you post from"
              autoComplete="off"
              onChange={(e) => setCity(e.target.value)}
              onBlur={() => {
                const clean = cleanName(city)
                setCity(clean)
                save('homeCity', clean || null)
              }}
            />
          </label>
          <p className="postmaster__since">
            <span className="lbl">Member since</span>
            {stats.memberSince ? sinceLabel(stats.memberSince) : 'your first stamp'}
          </p>
        </div>
      </div>
      <ul className="postmaster__counts" aria-label="Your numbers">
        <li>
          <b>{stats.stamps}</b>
          <span>{stats.stamps === 1 ? 'stamp' : 'stamps'}</span>
        </li>
        <li>
          <b>{stats.longestStreak}</b>
          <span>longest streak</span>
        </li>
        <li>
          <b>{stats.currentStreak}</b>
          <span>streak now</span>
        </li>
        {stats.cities > 0 && (
          <li>
            <b>{stats.cities}</b>
            <span>{stats.cities === 1 ? 'city' : 'cities'}</span>
          </li>
        )}
      </ul>
    </section>
  )
}
