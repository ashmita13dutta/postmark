import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SealedError, makeQueries } from '../src/db/queries'
import { PostmarkDB } from '../src/db/schema'
import { setNow } from '../src/lib/clock'
import { yearStats } from '../src/lib/album'

const at = (iso) => new Date(iso).getTime()
const PALETTE = ['#111111', '#222222', '#333333', '#444444', '#555555'].map((hex, i) => ({
  hex,
  name: `c${i}`,
}))

let db
let q
let n = 0

beforeEach(() => {
  db = new PostmarkDB(`songs-${++n}`)
  q = makeQueries(db)
  setNow(at('2026-09-24T21:00'))
})
afterEach(async () => {
  setNow(null)
  await db.delete()
})

describe('a stamp keeps its song', () => {
  it('saves the song with the stamp, and where it came from', async () => {
    const m = await q.saveMoment('2026-09-24', {
      note: 'x',
      palette: PALETTE,
      songTitle: 'Tum Hi Ho',
      songArtist: 'Arijit Singh',
      songSource: 'suggested',
    })
    expect(m).toMatchObject({
      songTitle: 'Tum Hi Ho',
      songArtist: 'Arijit Singh',
      songSource: 'suggested',
    })
  })

  it('swaps and removes a song until the postcard is sealed', async () => {
    const m = await q.saveMoment('2026-09-24', { note: 'x', palette: PALETTE })
    const swapped = await q.setSong(m.id, {
      title: '  Kabira ',
      artist: 'Tochi Raina',
      source: 'suggested',
    })
    expect(swapped).toMatchObject({
      songTitle: 'Kabira',
      songArtist: 'Tochi Raina',
      songSource: 'suggested',
    })
    const own = await q.setSong(m.id, { title: 'My song', artist: '', source: 'own' })
    expect(own).toMatchObject({ songTitle: 'My song', songArtist: null, songSource: 'own' })
    const none = await q.setSong(m.id, null)
    expect(none).toMatchObject({ songTitle: null, songArtist: null, songSource: null })
    // a song with no title is no song
    expect(
      (await q.setSong(m.id, { title: '  ', artist: 'x', source: 'own' })).songTitle,
    ).toBeNull()

    await q.sealMoment(m.id, { color: '#B14126', emblem: 'rose' })
    await expect(q.setSong(m.id, { title: 'Late', source: 'own' })).rejects.toBeInstanceOf(
      SealedError,
    )
  })

  it('checks the song preference', async () => {
    expect(await q.getSetting('songModeDefault')).toBe('suggested')
    await q.setSetting('songModeDefault', 'own')
    expect(await q.getSetting('songModeDefault')).toBe('own')
    await expect(q.setSetting('songModeDefault', 'spotify')).rejects.toThrow()
  })
})

describe('the song of the year', () => {
  const stamp = (day, songTitle, songArtist = null) => ({
    day,
    songTitle,
    songArtist,
    palette: [],
    feeling: null,
    topic: null,
  })

  it('counts a song once however it was typed, and names the most chosen', () => {
    const moments = [
      stamp('2026-03-01', 'Tum Hi Ho', 'Arijit Singh'),
      stamp('2026-03-02', ' tum hi ho ', 'ARIJIT SINGH'),
      stamp('2026-03-03', 'Kabira', 'Tochi Raina'),
      stamp('2026-03-04', null),
      stamp('2025-12-31', 'Kabira', 'Tochi Raina'), // another year
    ]
    expect(yearStats(2026, moments, '2026-03-10').topSong).toEqual({
      title: 'Tum Hi Ho',
      artist: 'Arijit Singh',
      count: 2,
    })
  })

  it('has none when no stamp has a song', () => {
    expect(yearStats(2026, [stamp('2026-03-01', null)], '2026-03-10').topSong).toBeNull()
  })
})
