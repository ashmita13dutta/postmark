/**
 * Playing a month, pure: "Play my month" in the Mailbox (a slideshow of the month's postcards, each
 * with its song) and the Calendar's playlist strip (the month's songs in date order). Nothing plays
 * in the app; each song opens as a search on Spotify or YouTube.
 */
import { seededRng } from './rng'

/**
 * The postcards in the order to show them: by day, or shuffled. The shuffle is steady for the same
 * `seed` (the month), so showing it twice gives the same order, and it never loses or repeats one.
 */
export function slideshowOrder(moments, shuffle, seed = '') {
  const list = [...moments].sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0))
  if (!shuffle) return list
  const rnd = seededRng(`slideshow:${seed}`)
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[list[i], list[j]] = [list[j], list[i]]
  }
  return list
}

/** The month's postcards that have a song, in date order: the playlist. */
export const monthPlaylist = (moments) =>
  slideshowOrder(
    moments.filter((m) => m.songTitle),
    false,
  )

/** The place after `index` in a list of `length`, going round to the start (`by` can be -1). */
export const stepAround = (index, by, length) => (length ? (index + by + length) % length : 0)
