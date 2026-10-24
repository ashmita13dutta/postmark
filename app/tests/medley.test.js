import { describe, expect, it } from 'vitest'
import { medleyQueue, yearMonths } from '../src/lib/medley'

const m = (day, songTitle = null, songArtist = null) => ({ day, songTitle, songArtist })

describe('yearMonths', () => {
  it('always has twelve months, January first', () => {
    const months = yearMonths(2026, [])
    expect(months).toHaveLength(12)
    expect(months[0]).toMatchObject({ month: 1, key: '2026-01', stamps: 0, song: null })
    expect(months[11].key).toBe('2026-12')
  })

  it('gives each month the song chosen most often in it', () => {
    const months = yearMonths(2026, [
      m('2026-03-01', 'Kabira', 'Tochi Raina'),
      m('2026-03-02', 'Tum Hi Ho', 'Arijit Singh'),
      m('2026-03-03', 'tum hi ho', 'arijit singh'),
      m('2026-04-01', 'Kabira', 'Tochi Raina'),
    ])
    expect(months[2].song).toEqual({ title: 'Tum Hi Ho', artist: 'Arijit Singh', count: 2 })
    expect(months[3].song).toEqual({ title: 'Kabira', artist: 'Tochi Raina', count: 1 })
    expect(months[2].stamps).toBe(3)
  })

  it('lets the earliest song win a tie, whatever order the stamps come in', () => {
    const stamps = [m('2026-05-09', 'B song', 'B'), m('2026-05-02', 'A song', 'A')]
    expect(yearMonths(2026, stamps)[4].song.title).toBe('A song')
    expect(yearMonths(2026, [...stamps].reverse())[4].song.title).toBe('A song')
  })

  it('ignores stamps from other years and stamps with no song', () => {
    const months = yearMonths(2026, [m('2025-03-01', 'Old'), m('2026-03-01')])
    expect(months[2].song).toBeNull()
    expect(months[2].stamps).toBe(1)
  })
})

describe('medleyQueue', () => {
  it('is the months that have a song, in order', () => {
    const months = yearMonths(2026, [m('2026-09-01', 'S', 'x'), m('2026-02-01', 'F', 'y')])
    expect(medleyQueue(months).map((x) => x.month)).toEqual([2, 9])
    expect(medleyQueue(yearMonths(2026, []))).toEqual([])
  })
})
