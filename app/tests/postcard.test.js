import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PostcardFullError, SealedError, makeQueries } from '../src/db/queries'
import { PostmarkDB } from '../src/db/schema'
import { setNow } from '../src/lib/clock'
import { DROP_TILT, MAX_DECORATIONS, clampPlacement, dropSpot, dropTilt } from '../src/lib/decor'

let db
let q
let n = 0
let moment

beforeEach(async () => {
  db = new PostmarkDB(`postcard-${++n}`)
  q = makeQueries(db)
  setNow(new Date('2026-09-24T21:00').getTime())
  moment = await q.saveMoment('2026-09-24', { note: 'x' })
})

afterEach(async () => {
  setNow(null)
  await db.delete()
})

describe('clampPlacement', () => {
  it('keeps the centre inside the card', () => {
    expect(clampPlacement({ x: -1, y: 4 })).toEqual({ x: 0, y: 1 })
  })
  it('limits size', () => {
    expect(clampPlacement({ scale: 0.01 }).scale).toBe(0.5)
    expect(clampPlacement({ scale: 99 }).scale).toBe(2.5)
  })
  it('wraps rotation into (-180, 180]', () => {
    expect(clampPlacement({ rotation: 190 }).rotation).toBe(-170)
    expect(clampPlacement({ rotation: -190 }).rotation).toBe(170)
    expect(clampPlacement({ rotation: 720 }).rotation).toBe(0)
    expect(clampPlacement({ rotation: 180 }).rotation).toBe(180)
  })
  it('only returns the fields it was given', () => {
    expect(clampPlacement({ x: 0.3 })).toEqual({ x: 0.3 })
  })
  it('replaces junk with the middle', () => {
    expect(clampPlacement({ x: NaN, scale: undefined, rotation: Infinity })).toEqual({
      x: 0.5,
      scale: 1,
      rotation: 0,
    })
  })
})

describe('dropTilt and dropSpot', () => {
  it('is stable for a key', () => {
    expect(dropTilt('a')).toBe(dropTilt('a'))
  })
  it('tilts a little to the left or a little more to the right, never outside -3 to 4 degrees', () => {
    const tilts = Array.from({ length: 400 }, (_, i) => dropTilt(`k${i}`))
    for (const t of tilts) {
      expect(t).toBeGreaterThanOrEqual(DROP_TILT.min)
      expect(t).toBeLessThan(DROP_TILT.max)
    }
    expect(DROP_TILT).toEqual({ min: -3, max: 4 })
    // spread over the whole range, and on both sides of upright
    expect(Math.min(...tilts)).toBeLessThan(-2.5)
    expect(Math.max(...tilts)).toBeGreaterThan(3.5)
    expect(tilts.filter((t) => t < 0).length).toBeGreaterThan(100)
    expect(tilts.filter((t) => t > 0).length).toBeGreaterThan(100)
  })
  it('takes its own range when asked', () => {
    expect(dropTilt('a', { min: 10, max: 11 })).toBeGreaterThanOrEqual(10)
    expect(dropTilt('a', { min: 10, max: 11 })).toBeLessThan(11)
  })
  it('lands near the middle', () => {
    for (let i = 0; i < 8; i++) {
      const { x, y } = dropSpot(i, `k${i}`)
      expect(x).toBeGreaterThanOrEqual(0.2)
      expect(x).toBeLessThanOrEqual(0.8)
      expect(y).toBeGreaterThanOrEqual(0.2)
      expect(y).toBeLessThanOrEqual(0.8)
    }
  })
})

describe('decorations', () => {
  it('adds a sticker on the back, on top of the last one', async () => {
    const a = await q.addDecoration(moment.id, { stickerId: 'doodle:heart', x: 0.3 })
    const b = await q.addDecoration(moment.id, { stickerId: 'tape:0' })
    expect(a).toMatchObject({ side: 'back', x: 0.3, y: 0.5, scale: 1, rotation: 0 })
    expect(b.z).toBeGreaterThan(a.z)
    expect((await q.decorationsFor(moment.id)).map((d) => d.stickerId)).toEqual([
      'doodle:heart',
      'tape:0',
    ])
  })

  it(`holds at most ${MAX_DECORATIONS}, then says the postcard is full`, async () => {
    for (let i = 0; i < MAX_DECORATIONS; i++) {
      await q.addDecoration(moment.id, { stickerId: 'doodle:star' })
    }
    await expect(q.addDecoration(moment.id, { stickerId: 'doodle:star' })).rejects.toBeInstanceOf(
      PostcardFullError,
    )
    expect(await q.decorationsFor(moment.id)).toHaveLength(MAX_DECORATIONS)
  })

  it('removing one makes room again', async () => {
    const ids = []
    for (let i = 0; i < MAX_DECORATIONS; i++) {
      ids.push((await q.addDecoration(moment.id, { stickerId: 'doodle:sun' })).id)
    }
    await q.removeDecoration(ids[0])
    await expect(q.addDecoration(moment.id, { stickerId: 'doodle:sun' })).resolves.toBeTruthy()
  })

  it('moves a sticker and clamps it, ignoring fields it should not touch', async () => {
    const a = await q.addDecoration(moment.id, { stickerId: 'doodle:heart' })
    const moved = await q.updateDecoration(a.id, {
      x: 2,
      rotation: 200,
      momentId: 'other',
      stickerId: 'hacked',
    })
    expect(moved).toMatchObject({
      x: 1,
      rotation: -160,
      momentId: moment.id,
      stickerId: 'doodle:heart',
    })
  })

  it('brings a sticker to the front when asked', async () => {
    const a = await q.addDecoration(moment.id, { stickerId: 'doodle:heart' })
    const b = await q.addDecoration(moment.id, { stickerId: 'doodle:star' })
    const lifted = await q.updateDecoration(a.id, { front: true })
    expect(lifted.z).toBeGreaterThan(b.z)
  })

  it('locks everything once the postcard is sealed', async () => {
    const a = await q.addDecoration(moment.id, { stickerId: 'doodle:heart' })
    await q.sealMoment(moment.id, { color: '#B14126', emblem: 'heart' })
    await expect(q.addDecoration(moment.id, { stickerId: 'x' })).rejects.toBeInstanceOf(SealedError)
    await expect(q.updateDecoration(a.id, { x: 0.1 })).rejects.toBeInstanceOf(SealedError)
    await expect(q.removeDecoration(a.id)).rejects.toBeInstanceOf(SealedError)
    expect(await q.decorationsFor(moment.id)).toHaveLength(1)
  })

  it('reads back the wax seal', async () => {
    expect(await q.getSeal(moment.id)).toBeUndefined()
    await q.sealMoment(moment.id, { color: '#3A5771', emblem: 'initial', initial: 'A' })
    expect(await q.getSeal(moment.id)).toMatchObject({ emblem: 'initial', initial: 'A' })
  })

  it('refuses an unknown postcard', async () => {
    await expect(q.addDecoration('nope', { stickerId: 'x' })).rejects.toThrow('No such moment')
  })
})
