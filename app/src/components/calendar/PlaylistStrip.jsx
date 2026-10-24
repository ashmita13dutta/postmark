import { useMemo } from 'react'
import { songLabel } from '../../engine/songs'
import { monthPlaylist, stepAround } from '../../lib/slideshow'
import SongLine from '../song/SongLine'
import './playlist.css'

/**
 * The Calendar's playlist strip (spec 8.5): a ring for each day of the month that has a song, in date
 * order. Tap one to see its song and a way to hear it; the day lights up in the grid. "Next day"
 * steps through them like a queue. Nothing plays here: songs open as a search on Spotify or YouTube.
 * Only months that have been delivered show one, so a sealed month keeps its songs a surprise.
 *  - moments:  the month's stamps
 *  - nowMs:    the current time, to know what is delivered
 *  - playing:  the day being shown, or null
 *  - onPlay:   called with a day
 */
export default function PlaylistStrip({ moments, nowMs, playing, onPlay }) {
  const list = useMemo(
    () => monthPlaylist(moments.filter((m) => nowMs >= m.sealedUntil)),
    [moments, nowMs],
  )
  if (!list.length) return null
  const at = list.findIndex((m) => m.day === playing)
  const current = at >= 0 ? list[at] : null
  const step = (by) => onPlay(list[stepAround(at, by, list.length)].day)

  return (
    <section className="playlist" aria-label="This month's songs">
      <h2>This month&apos;s songs</h2>
      <ul className="playlist__rings">
        {list.map((m) => (
          <li key={m.day}>
            <button
              className={`playlist__ring${m.day === playing ? ' on' : ''}`}
              aria-pressed={m.day === playing}
              aria-label={`${Number(m.day.slice(8))}: ${songLabel(m.songTitle, m.songArtist)}`}
              onClick={() => onPlay(m.day)}
            >
              {Number(m.day.slice(8))}
            </button>
          </li>
        ))}
      </ul>
      {current ? (
        <div className="playlist__now" role="status">
          <SongLine moment={current} />
          {list.length > 1 && (
            <span className="playlist__step">
              <button onClick={() => step(-1)}>Previous day</button>
              <button onClick={() => step(1)}>Next day</button>
            </span>
          )}
        </div>
      ) : (
        <button className="playlist__play" onClick={() => onPlay(list[0].day)}>
          Play the month
        </button>
      )}
    </section>
  )
}
