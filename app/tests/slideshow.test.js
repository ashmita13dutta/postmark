import { describe, expect, it } from 'vitest'
import { monthPlaylist, slideshowOrder, stepAround } from '../src/lib/slideshow'

const m = (day, songTitle = null) => ({ id: day, day, songTitle })
const days = ['2026-09-03', '2026-09-01', '2026-09-20', '2026-09-12', '2026-09-30', '2026-09-07']

describe('slideshowOrder', () => {
  it('is by day when not shuffled, whatever order they come in', () => {
    const order = slideshowOrder(
      days.map((d) => m(d)),
      false,
    )
    expect(order.map((x) => x.day)).toEqual([...days].sort())
  })

  it('shuffles without losing or repeating a postcard', () => {
    const order = slideshowOrder(
      days.map((d) => m(d)),
      true,
      '2026-09',
    )
    expect(order).toHaveLength(days.length)
    expect(order.map((x) => x.day).sort()).toEqual([...days].sort())
  })

  it('shuffles the same way for the same month, and differently for another', () => {
    const list = Array.from({ length: 20 }, (_, i) =>
      m(`2026-09-${String(i + 1).padStart(2, '0')}`),
    )
    const a = slideshowOrder(list, true, '2026-09').map((x) => x.day)
    expect(slideshowOrder([...list].reverse(), true, '2026-09').map((x) => x.day)).toEqual(a)
    expect(slideshowOrder(list, true, '2026-10').map((x) => x.day)).not.toEqual(a)
    expect(a).not.toEqual([...a].sort())
  })

  it('does not change the list it was given', () => {
    const list = days.map((d) => m(d))
    const copy = [...list]
    slideshowOrder(list, true, 'x')
    slideshowOrder(list, false)
    expect(list).toEqual(copy)
  })

  it('handles an empty month', () => {
    expect(slideshowOrder([], true, 'x')).toEqual([])
  })
})

describe('monthPlaylist', () => {
  it('keeps only postcards with a song, in date order', () => {
    const list = [m('2026-09-20', 'B'), m('2026-09-02'), m('2026-09-01', 'A')]
    expect(monthPlaylist(list).map((x) => x.songTitle)).toEqual(['A', 'B'])
    expect(monthPlaylist([m('2026-09-01')])).toEqual([])
  })
})

describe('stepAround', () => {
  it('goes round both ways', () => {
    expect(stepAround(0, -1, 5)).toBe(4)
    expect(stepAround(4, 1, 5)).toBe(0)
    expect(stepAround(2, 1, 5)).toBe(3)
    expect(stepAround(0, 1, 0)).toBe(0)
  })
})
