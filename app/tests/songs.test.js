import { describe, expect, it } from 'vitest'
import { feelings } from '../src/data/feelings.json'
import songData from '../src/data/songs.json'
import { topics } from '../src/data/topics.json'
import {
  cleanSong,
  findSong,
  playLinks,
  songKey,
  songLabel,
  suggestSongs,
} from '../src/engine/songs'

const { songs } = songData

describe('the songs list', () => {
  it('is about 150 songs, in Bengali, Hindi and English', () => {
    expect(songs.length).toBeGreaterThanOrEqual(140)
    expect(songs.length).toBeLessThanOrEqual(190)
    for (const lang of ['bn', 'hi', 'en']) {
      expect(songs.filter((s) => s.lang === lang).length, lang).toBeGreaterThanOrEqual(15)
    }
  })

  it('has a title, an artist and a known language for every song, none twice', () => {
    const seen = new Set()
    for (const s of songs) {
      expect(s.title, JSON.stringify(s)).toBeTruthy()
      expect(s.artist, s.title).toBeTruthy()
      expect(['bn', 'hi', 'en'], s.title).toContain(s.lang)
      const key = songKey(s.title, s.artist)
      expect(seen.has(key), `${s.title} appears twice`).toBe(false)
      seen.add(key)
    }
  })

  it('only uses feelings and topics the app knows', () => {
    for (const s of songs) {
      expect(s.moods.length, s.title).toBeGreaterThan(0)
      for (const m of s.moods) expect(feelings[m], `${s.title}: ${m}`).toBeTruthy()
      for (const t of s.topics ?? []) expect(topics[t], `${s.title}: ${t}`).toBeTruthy()
    }
  })

  it('has several songs for every feeling, so a suggestion is never thin', () => {
    for (const id of Object.keys(feelings)) {
      expect(songs.filter((s) => s.moods.includes(id)).length, id).toBeGreaterThanOrEqual(4)
    }
  })

  it('has songs about the weather the city is known for', () => {
    expect(songs.filter((s) => s.topics?.includes('rain')).length).toBeGreaterThanOrEqual(8)
  })
})

describe('suggestSongs', () => {
  it('gives three different songs', () => {
    const three = suggestSongs({ feeling: 'joyful', day: '2026-09-24' })
    expect(three).toHaveLength(3)
    expect(new Set(three.map((s) => songKey(s.title, s.artist))).size).toBe(3)
  })

  it('favours the day feeling and topic', () => {
    for (const day of ['2026-09-24', '2026-09-25', '2026-09-26', '2026-10-01']) {
      const picks = suggestSongs({ feeling: 'sad', topic: 'rain', day })
      // each is a sad song or a rain song; most are both
      for (const s of picks)
        expect(s.moods.includes('sad') || s.topics?.includes('rain')).toBe(true)
    }
    const rainy = suggestSongs({ feeling: 'peaceful', topic: 'rain', day: '2026-09-24' })
    expect(rainy.some((s) => s.topics?.includes('rain'))).toBe(true)
  })

  it('is steady for a day and changes with a re-roll', () => {
    const a = suggestSongs({ feeling: 'nostalgic', topic: 'home', day: '2026-09-24', round: 0 })
    const again = suggestSongs({ feeling: 'nostalgic', topic: 'home', day: '2026-09-24', round: 0 })
    expect(again).toEqual(a)
    const rolled = suggestSongs({
      feeling: 'nostalgic',
      topic: 'home',
      day: '2026-09-24',
      round: 1,
    })
    expect(rolled).not.toEqual(a)
  })

  it('leaves out what is already showing', () => {
    const first = suggestSongs({ feeling: 'loving', day: '2026-09-24' })
    const skip = first.map((s) => songKey(s.title, s.artist))
    const next = suggestSongs({ feeling: 'loving', day: '2026-09-24', skip })
    for (const s of next) expect(skip).not.toContain(songKey(s.title, s.artist))
  })

  it('mixes languages where it can', () => {
    const langs = new Set()
    for (const day of ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05']) {
      const three = suggestSongs({ feeling: 'joyful', day })
      expect(new Set(three.map((s) => s.lang)).size).toBeGreaterThanOrEqual(2)
      three.forEach((s) => langs.add(s.lang))
    }
    expect(langs.size).toBeGreaterThanOrEqual(2)
  })

  it('still suggests when the day has no feeling or topic yet', () => {
    expect(suggestSongs({ day: '2026-09-24' })).toHaveLength(3)
    expect(suggestSongs({ feeling: null, topic: null, day: '2026-09-24' })).toHaveLength(3)
  })

  it('gives fewer only when the list is that short', () => {
    expect(suggestSongs({ day: 'x' }, 3, songs.slice(0, 2))).toHaveLength(2)
  })
})

describe('cleanSong, songLabel, playLinks, findSong', () => {
  it('tidies a typed song and needs a title', () => {
    expect(cleanSong({ title: '  Tum   Hi Ho ', artist: ' Arijit Singh ' })).toEqual({
      songTitle: 'Tum Hi Ho',
      songArtist: 'Arijit Singh',
    })
    expect(cleanSong({ title: 'Instrumental', artist: '  ' })).toEqual({
      songTitle: 'Instrumental',
      songArtist: null,
    })
    expect(cleanSong({ title: '   ', artist: 'Someone' })).toBeNull()
    expect(cleanSong({ title: 'x'.repeat(200) }).songTitle).toHaveLength(80)
  })

  it('writes a song as one line', () => {
    expect(songLabel('Tum Hi Ho', 'Arijit Singh')).toBe('Tum Hi Ho — Arijit Singh')
    expect(songLabel('Tum Hi Ho', null)).toBe('Tum Hi Ho')
  })

  it('makes search links, with the words made safe', () => {
    const { spotify, youtube } = playLinks("Singin' in the Rain", 'Gene Kelly')
    expect(spotify).toBe("https://open.spotify.com/search/Singin'%20in%20the%20Rain%20Gene%20Kelly")
    expect(youtube).toBe(
      "https://www.youtube.com/results?search_query=Singin'%20in%20the%20Rain%20Gene%20Kelly",
    )
    expect(playLinks('A & B', null).spotify).toBe('https://open.spotify.com/search/A%20%26%20B')
  })

  it('knows a curated song however it was typed', () => {
    expect(findSong('tum hi ho', 'ARIJIT SINGH').title).toBe('Tum Hi Ho')
    expect(findSong('A song nobody listed', 'Nobody')).toBeNull()
  })
})
