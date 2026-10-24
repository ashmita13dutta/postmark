import { useMemo, useState } from 'react'
import { cleanSong, playLinks, songKey, songLabel, suggestSongs } from '../../engine/songs'
import './song.css'

const LANG = { bn: 'Bengali', hi: 'Hindi', en: 'English' }

/**
 * Today's song (spec 7.3): "✦ Suggest from my moment" shows three songs that fit how the day felt, or
 * "Pick my song" takes a title and artist you type. Whatever is chosen shows as one line with a way
 * to hear it (a search on Spotify or YouTube; nothing plays in the app) and a way to take it off.
 *  - value:    { title, artist, source: 'own' | 'suggested' } or null
 *  - onChange: called with the same shape, or null
 *  - feeling, topic, day: the day's reading, which the suggestions follow
 *  - startMode: 'suggested' or 'own', which side opens first (the song preference)
 */
export default function SongPicker({ value, onChange, feeling, topic, day, startMode }) {
  const [mode, setMode] = useState(value?.source ?? startMode)
  const [round, setRound] = useState(0)
  const options = useMemo(
    () => suggestSongs({ feeling, topic, day, round }),
    [feeling, topic, day, round],
  )
  const [own, setOwn] = useState({
    title: value?.source === 'own' ? value.title : '',
    artist: value?.source === 'own' ? (value.artist ?? '') : '',
  })

  function typed(next) {
    setOwn(next)
    const clean = cleanSong(next)
    onChange(clean ? { title: clean.songTitle, artist: clean.songArtist, source: 'own' } : null)
  }
  const chosen = value && value.source === 'suggested' ? songKey(value.title, value.artist) : null

  return (
    <section className="song" aria-label="Song of the moment">
      <h2>Song of the moment</h2>
      <div className="palettemode" role="group" aria-label="How to choose a song">
        <button
          className={mode === 'suggested' ? 'on' : ''}
          aria-pressed={mode === 'suggested'}
          onClick={() => setMode('suggested')}
        >
          ✦ Suggest from my moment
        </button>
        <button
          className={mode === 'own' ? 'on' : ''}
          aria-pressed={mode === 'own'}
          onClick={() => setMode('own')}
        >
          Pick my song
        </button>
      </div>

      {mode === 'suggested' ? (
        <>
          <ul className="song__options" aria-label="Suggested songs">
            {options.map((s) => {
              const on = chosen === songKey(s.title, s.artist)
              return (
                <li key={songKey(s.title, s.artist)}>
                  <button
                    className={on ? 'on' : ''}
                    aria-pressed={on}
                    onClick={() =>
                      onChange(
                        on ? null : { title: s.title, artist: s.artist, source: 'suggested' },
                      )
                    }
                  >
                    <span>
                      <b>{s.title}</b>
                      <small>{s.artist}</small>
                    </span>
                    <em>{LANG[s.lang]}</em>
                  </button>
                </li>
              )
            })}
          </ul>
          <button className="song__more" onClick={() => setRound((r) => r + 1)}>
            Show other songs
          </button>
        </>
      ) : (
        <div className="song__own">
          <input
            type="text"
            value={own.title}
            maxLength={80}
            placeholder="Song"
            aria-label="Song title"
            autoComplete="off"
            onChange={(e) => typed({ ...own, title: e.target.value })}
          />
          <input
            type="text"
            value={own.artist}
            maxLength={60}
            placeholder="Artist (optional)"
            aria-label="Artist"
            autoComplete="off"
            onChange={(e) => typed({ ...own, artist: e.target.value })}
          />
        </div>
      )}

      {value && (
        <p className="song__now" role="status">
          <span>♪ {songLabel(value.title, value.artist)}</span>
          <small>{value.source === 'own' ? 'your pick' : '✦ suggested'}</small>
          <a href={playLinks(value.title, value.artist).spotify} target="_blank" rel="noreferrer">
            Spotify
          </a>
          <a href={playLinks(value.title, value.artist).youtube} target="_blank" rel="noreferrer">
            YouTube
          </a>
          <button
            onClick={() => {
              setOwn({ title: '', artist: '' })
              onChange(null)
            }}
          >
            Remove
          </button>
        </p>
      )}
      <p className="song__soon">
        Spotify liked songs: coming soon. Songs open as a search; nothing plays inside Postmark.
      </p>
    </section>
  )
}
