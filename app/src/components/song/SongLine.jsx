import { playLinks, songLabel } from '../../engine/songs'
import './song.css'

/**
 * A postcard's song as one line of ink, with a way to hear it. Nothing plays here: Spotify and YouTube
 * open as a search in a new tab (no music service is used). Renders nothing for a postcard with no song.
 *  - moment:  uses songTitle, songArtist and songSource
 *  - links:   show the Spotify and YouTube links (off for the front of a postcard, which flips on tap)
 *  - tagged:  add "your pick" or "✦ suggested"
 *  - onSwap:  if given and the song was suggested, shows a "Swap" button that calls it
 */
export default function SongLine({ moment, links = true, tagged = false, onSwap }) {
  if (!moment.songTitle) return null
  const { spotify, youtube } = playLinks(moment.songTitle, moment.songArtist)
  return (
    <p className="songline">
      <span className="songline__name">♪ {songLabel(moment.songTitle, moment.songArtist)}</span>
      {tagged && (
        <small className="songline__tag">
          {moment.songSource === 'own' ? 'your pick' : '✦ suggested'}
        </small>
      )}
      {links && (
        <span className="songline__links">
          <a href={spotify} target="_blank" rel="noreferrer">
            Spotify
          </a>
          <a href={youtube} target="_blank" rel="noreferrer">
            YouTube
          </a>
          {onSwap && moment.songSource === 'suggested' && <button onClick={onSwap}>Swap</button>}
        </span>
      )}
    </p>
  )
}
