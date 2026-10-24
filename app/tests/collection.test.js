import { describe, expect, it } from 'vitest'
import { PACKS } from '../src/data/stickers'
import { collectionStats } from '../src/lib/collection'

const packs = [
  {
    id: 'cozy',
    label: 'Cozy',
    kind: 'image',
    items: [
      { id: 'img:cozy/candle', label: 'Candle' },
      { id: 'img:cozy/mug', label: 'Mug' },
    ],
  },
  { id: 'tape', label: 'Tape', kind: 'drawn', items: [{ id: 'tape:1', label: 'Gingham' }] },
]
const put = (momentId, stickerId) => ({ momentId, stickerId })

describe('collectionStats', () => {
  it('counts every pack and sticker, even with nothing used', () => {
    const s = collectionStats(packs, [])
    expect(s.stickers).toBe(3)
    expect(s.used).toBe(0)
    expect(s.postcards).toBe(0)
    expect(s.top).toBeNull()
    expect(s.packs.map((p) => [p.id, p.count, p.used])).toEqual([
      ['cozy', 2, 0],
      ['tape', 1, 0],
    ])
  })

  it('counts uses per pack, postcards decorated and the sticker used most', () => {
    const s = collectionStats(packs, [
      put('a', 'img:cozy/mug'),
      put('a', 'img:cozy/mug'),
      put('b', 'img:cozy/mug'),
      put('b', 'img:cozy/candle'),
      put('b', 'tape:1'),
    ])
    expect(s.used).toBe(5)
    expect(s.postcards).toBe(2)
    expect(s.packs[0].used).toBe(4)
    expect(s.packs[1].used).toBe(1)
    expect(s.top).toEqual({ id: 'img:cozy/mug', label: 'Mug', packLabel: 'Cozy', count: 3 })
  })

  it('ignores stickers from packs that no longer exist', () => {
    const s = collectionStats(packs, [put('a', 'img:gone/old'), put('a', 'tape:1')])
    expect(s.used).toBe(1)
    expect(s.top.id).toBe('tape:1')
  })

  it('lists the months that featured a pack, newest first', () => {
    const s = collectionStats(
      packs,
      [],
      [
        { kind: 'month-pack', packId: 'cozy', monthKey: '2026-07', name: 'Homebody' },
        { kind: 'month-pack', packId: 'cozy', monthKey: '2026-09', name: 'Family ties' },
        { kind: 'complete-month', monthKey: '2026-09' },
        { kind: 'month-pack', packId: 'nowhere', monthKey: '2026-08', name: 'Lost' },
      ],
    )
    expect(s.packs[0].months).toEqual([
      { monthKey: '2026-09', name: 'Family ties' },
      { monthKey: '2026-07', name: 'Homebody' },
    ])
    expect(s.packs[1].months).toEqual([])
  })

  it('works on the real packs', () => {
    const s = collectionStats(PACKS, [])
    expect(s.packs).toHaveLength(PACKS.length)
    expect(s.stickers).toBeGreaterThan(300)
    expect(s.packs.every((p) => p.count > 0)).toBe(true)
  })
})
