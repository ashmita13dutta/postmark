import { describe, expect, it } from 'vitest'
import { yearMonths } from '../src/lib/medley'
import { STORY, fitText, storyRows } from '../src/lib/shareImage'

describe('fitText', () => {
  it('leaves a short line alone and cuts a long one with an ellipsis', () => {
    expect(fitText('Tum Hi Ho', 26)).toBe('Tum Hi Ho')
    expect(fitText('  Kabira  ', 26)).toBe('Kabira')
    const cut = fitText('Good Riddance (Time of Your Life)', 20)
    expect(cut).toHaveLength(20)
    expect(cut.endsWith('…')).toBe(true)
    expect(fitText(null, 10)).toBe('')
  })
})

describe('storyRows', () => {
  const stamps = [
    { day: '2026-03-01', songTitle: 'Good Riddance (Time of Your Life)', songArtist: 'Green Day' },
    { day: '2026-04-01', songTitle: 'Kabira', songArtist: null },
  ]
  const rows = storyRows(yearMonths(2026, stamps))

  it('has twelve lines, January first, each with a short month name', () => {
    expect(rows).toHaveLength(12)
    expect(rows[0]).toMatchObject({ month: 1, label: 'Jan', has: false, title: '', artist: '' })
    expect(rows[11].label).toBe('Dec')
  })

  it('carries the song of a month, cut to fit', () => {
    expect(rows[2].has).toBe(true)
    expect(rows[2].title.length).toBeLessThanOrEqual(26)
    expect(rows[2].title.endsWith('…')).toBe(true)
    expect(rows[2].artist).toBe('Green Day')
    expect(rows[3]).toMatchObject({ title: 'Kabira', artist: '', has: true })
  })

  it('is a tall story picture', () => {
    expect(STORY.height / STORY.width).toBeCloseTo(16 / 9, 1)
  })
})
