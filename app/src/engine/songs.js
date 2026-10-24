/**
 * The song engine (spec 7.3), pure: suggest three songs for a day from the curated list, tidy a
 * song someone typed, and make the links that open it. Nothing is played inside the app and no
 * music service is called: a song opens as a search on Spotify or YouTube.
 */
import songData from '../data/songs.json'
import { normalize } from './city'
import { seededRng } from '../lib/rng'

const FEELING_WEIGHT = 3
const TOPIC_WEIGHT = 2
const CHANCE = 1.2 // how much luck can lift a song, so the same day does not always give the same three
const SAME_LANGUAGE = 0.8 // taken off a song whose language is already among the suggestions

/** A steady key for a song, so the same song typed two ways is counted once. */
export const songKey = (title, artist) => `${normalize(title)}|${normalize(artist)}`

/** "Title — Artist" (or just the title when there is no artist). */
export const songLabel = (title, artist) => (artist ? `${title} — ${artist}` : title)

/**
 * Three songs for a day. Songs that share the day's feeling score most, then its topic, then a
 * little chance (steady for the same day and `round`, so a re-roll is `round + 1`). The three differ
 * in language where it can. `skip` is a list of songKeys to leave out (what is already showing).
 * @returns {{ title: string, artist: string, lang: string, moods: string[], topics?: string[] }[]}
 */
export function suggestSongs(
  { feeling, topic, day = '', round = 0, skip = [] },
  count = 3,
  songs = songData.songs,
) {
  const rnd = seededRng(`songs:${day}:${round}`)
  const left = new Set(skip)
  const scored = songs
    .filter((s) => !left.has(songKey(s.title, s.artist)))
    .map((song) => ({
      song,
      score:
        (feeling && song.moods.includes(feeling) ? FEELING_WEIGHT : 0) +
        (topic && song.topics?.includes(topic) ? TOPIC_WEIGHT : 0) +
        rnd() * CHANCE,
    }))
    .sort((a, b) => b.score - a.score)

  // take the best one at a time, marking down songs in a language that is already taken
  const picked = []
  const langs = new Set()
  while (picked.length < count && scored.length) {
    scored.forEach((s) => {
      s.adjusted = s.score - (langs.has(s.song.lang) ? SAME_LANGUAGE : 0)
    })
    scored.sort((a, b) => b.adjusted - a.adjusted)
    const [best] = scored.splice(0, 1)
    picked.push(best.song)
    langs.add(best.song.lang)
  }
  return picked
}

/**
 * What to keep for a song someone typed: { songTitle, songArtist }, tidied, or null when there is no
 * title. The artist is optional.
 */
export function cleanSong({ title, artist }) {
  const tidy = (text, max) =>
    String(text ?? '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, max)
  const songTitle = tidy(title, 80)
  if (!songTitle) return null
  return { songTitle, songArtist: tidy(artist, 60) || null }
}

/** Links that open the song as a search: { spotify, youtube }. */
export function playLinks(title, artist) {
  const q = encodeURIComponent([title, artist].filter(Boolean).join(' '))
  return {
    spotify: `https://open.spotify.com/search/${q}`,
    youtube: `https://www.youtube.com/results?search_query=${q}`,
  }
}

/** The curated song a title and artist mean, or null (a song typed by hand). */
export function findSong(title, artist, songs = songData.songs) {
  const key = songKey(title, artist)
  return songs.find((s) => songKey(s.title, s.artist) === key) ?? null
}
