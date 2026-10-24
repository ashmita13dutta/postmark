/**
 * "Year in postmarks" (spec 8.7), pure: one song for each month of a year, the one chosen most
 * often that month (the earliest if two tie), and the queue of those songs in month order.
 */
import { songKey } from '../engine/songs'

/**
 * Twelve entries, January first: { month: 1..12, key: 'YYYY-MM', stamps, song }. `song` is
 * { title, artist, count } or null when no stamp that month has a song.
 */
export function yearMonths(year, moments) {
  return Array.from({ length: 12 }, (_, i) => {
    const key = `${year}-${String(i + 1).padStart(2, '0')}`
    const mine = moments
      .filter((m) => m.day.startsWith(`${key}-`))
      .sort((a, b) => (a.day < b.day ? -1 : 1))
    const counts = new Map()
    for (const m of mine) {
      if (!m.songTitle) continue
      const k = songKey(m.songTitle, m.songArtist)
      const seen = counts.get(k)
      counts.set(k, {
        title: seen?.title ?? m.songTitle,
        artist: seen?.artist ?? m.songArtist ?? null,
        count: (seen?.count ?? 0) + 1,
      })
    }
    // Map keeps the order songs first appeared in, so on a tie the earliest wins
    const song = [...counts.values()].reduce((a, b) => (!a || b.count > a.count ? b : a), null)
    return { month: i + 1, key, stamps: mine.length, song }
  })
}

/** The months that have a song, in order: the medley. */
export const medleyQueue = (months) => months.filter((m) => m.song)
