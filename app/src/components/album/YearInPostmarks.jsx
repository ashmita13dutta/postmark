import { useMemo, useState } from 'react'
import { playLinks, songLabel } from '../../engine/songs'
import { medleyQueue, yearMonths } from '../../lib/medley'
import { MONTHS } from './bands'

/**
 * "Year in postmarks": twelve rings, one for each month, with the song that month had most. Tap a ring
 * to see its song; "Play the medley" steps through the months one song at a time. Nothing plays
 * here: each song opens as a search on Spotify or YouTube. The month being shown glows in the quilt
 * (`onGlow` is told which). Renders nothing until some stamp has a song.
 */
export default function YearInPostmarks({ year, moments, onGlow }) {
  const months = useMemo(() => yearMonths(year, moments), [year, moments])
  const queue = useMemo(() => medleyQueue(months), [months])
  const [at, setAt] = useState(null) // the month number being shown
  if (!queue.length) return null

  const show = (month) => {
    setAt(month)
    onGlow?.(month)
  }
  const now = months.find((m) => m.month === at)
  const place = queue.findIndex((m) => m.month === at)
  const step = (by) => show(queue[(place + by + queue.length) % queue.length].month)

  return (
    <section className="ypm" aria-label={`${year} in postmarks`}>
      <h2>Year in postmarks</h2>
      <ul className="ypm__rings">
        {months.map((m) => (
          <li key={m.key}>
            <button
              className={`ypm__ring${m.month === at ? ' on' : ''}${m.song ? '' : ' none'}`}
              disabled={!m.song}
              aria-pressed={m.month === at}
              aria-label={`${MONTHS[m.month - 1]}${m.song ? `: ${songLabel(m.song.title, m.song.artist)}` : ', no song'}`}
              onClick={() => show(m.month)}
            >
              {MONTHS[m.month - 1].slice(0, 3)}
            </button>
          </li>
        ))}
      </ul>
      {now?.song ? (
        <div className="ypm__now" role="status">
          <small>{MONTHS[now.month - 1]}</small>
          <b>♪ {songLabel(now.song.title, now.song.artist)}</b>
          <span>
            <a
              href={playLinks(now.song.title, now.song.artist).spotify}
              target="_blank"
              rel="noreferrer"
            >
              Spotify
            </a>
            <a
              href={playLinks(now.song.title, now.song.artist).youtube}
              target="_blank"
              rel="noreferrer"
            >
              YouTube
            </a>
          </span>
          {queue.length > 1 && (
            <span className="ypm__step">
              <button onClick={() => step(-1)}>Previous month</button>
              <button onClick={() => step(1)}>Next month</button>
            </span>
          )}
        </div>
      ) : (
        <button className="ypm__play" onClick={() => show(queue[0].month)}>
          Play the medley
        </button>
      )}
    </section>
  )
}
