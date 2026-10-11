import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_FRAME,
  DEFAULT_PAPER,
  FRAMES,
  PAPERS,
  clampLook,
  fillColors,
  findFrame,
  findPaper,
  frameStyle,
  hasFrame,
  paperStyle,
} from '../src/data/papers'
import { SealedError, makeQueries } from '../src/db/queries'
import { PostmarkDB } from '../src/db/schema'
import { setNow } from '../src/lib/clock'

const palette = [
  { hex: '#AA0000', name: 'a' },
  { hex: '#00BB00', name: 'b' },
  { hex: '#0000CC', name: 'c' },
  { hex: '#DDDD00', name: 'd' },
  { hex: '#EE00EE', name: 'e' },
]

describe('papers.json (yours to edit)', () => {
  it('gives every paper and frame a unique simple id and a name', () => {
    for (const list of [PAPERS, FRAMES]) {
      expect(new Set(list.map((x) => x.id)).size).toBe(list.length)
      for (const item of list) {
        expect(item.id, 'id').toMatch(/^[a-z0-9-]+$/)
        expect(item.label, `label of ${item.id}`).toBeTruthy()
        expect(Array.isArray(item.keywords ?? []), `keywords of ${item.id}`).toBe(true)
      }
    }
  })

  it('has papers with a background, a grain from 0 to 1 and no stray color slots', () => {
    for (const p of PAPERS) {
      expect(typeof p.background, `background of ${p.id}`).toBe('string')
      expect(p.background.length).toBeGreaterThan(3)
      if ('grain' in p) {
        expect(p.grain).toBeGreaterThanOrEqual(0)
        expect(p.grain).toBeLessThanOrEqual(1)
      }
      if ('lines' in p) expect(typeof p.lines).toBe('boolean')
      // {c0} to {c4} are the five palette colors; anything else in braces is a typo
      for (const [slot] of p.background.matchAll(/\{[^}]*\}/g)) expect(slot).toMatch(/^\{c[0-4]\}$/)
    }
  })

  it('has frames that are either a band or a line, with sizes in pixels', () => {
    for (const f of FRAMES) {
      if (!hasFrame(f)) continue
      expect(
        Boolean(f.band) !== Boolean(f.border),
        `${f.id} needs a band or a border, not both`,
      ).toBe(true)
      if (f.band) expect(f.width, `width of ${f.id}`).toBeGreaterThan(0)
      expect(f.inset ?? 0, `inset of ${f.id}`).toBeGreaterThanOrEqual(0)
      // the note sits 16 px from the top and 18 from the sides: a frame must stay clear of it
      expect((f.inset ?? 0) + (f.band ? f.width : parseFloat(f.border)), f.id).toBeLessThanOrEqual(
        15,
      )
    }
  })

  it('starts a postcard on plain cream with no frame, as it always looked', () => {
    expect(DEFAULT_PAPER).toBe('cream')
    expect(findPaper(DEFAULT_PAPER).background).toBe('#fdf8ec') // --card-warm
    expect(DEFAULT_FRAME).toBe('none')
    expect(hasFrame(findFrame(DEFAULT_FRAME))).toBe(false)
  })
})

describe('using the day’s colors', () => {
  it('fills {c0} to {c4} with the palette, as many times as they appear', () => {
    expect(fillColors('{c0} {c2}40 {c0}', palette)).toBe('#AA0000 #0000CC40 #AA0000')
    expect(fillColors('{c4}', palette)).toBe('#EE00EE')
  })

  it('uses the plain paper colors when there is no five-color palette', () => {
    expect(fillColors('{c0}', undefined)).toBe('#EFE7D2')
    expect(fillColors('{c4}', [])).toBe('#B0A488')
  })

  it('lets a mood paper change with the postcard’s palette', () => {
    const today = findPaper('today')
    const other = palette.map((c, i) => ({ ...c, hex: `#0${i}0${i}0${i}` }))
    expect(paperStyle(today, palette).background).toContain('#AA0000')
    expect(paperStyle(today, palette).background).not.toBe(paperStyle(today, other).background)
    expect(paperStyle(today, palette).background).not.toMatch(/\{c/)
  })
})

describe('what a paper and a frame look like', () => {
  it('passes the grain on as a CSS variable, none by default', () => {
    expect(paperStyle({ background: '#fff', grain: 0.4 }, palette)['--grain']).toBe(0.4)
    expect(paperStyle({ background: '#fff' }, palette)['--grain']).toBe(0)
  })

  it('draws a band as a padded ring of background, and a line as a border', () => {
    expect(frameStyle({ band: 'red', width: 9, inset: 0 })).toEqual({
      inset: 0,
      padding: 9,
      background: 'red',
    })
    expect(frameStyle({ border: '2px dashed red', inset: 9, radius: 6 })).toEqual({
      inset: 9,
      border: '2px dashed red',
      borderRadius: 6,
    })
  })

  it('falls back to the first paper and frame for an id it does not know', () => {
    expect(findPaper('gone').id).toBe(DEFAULT_PAPER)
    expect(findPaper(undefined).id).toBe(DEFAULT_PAPER)
    expect(findFrame('gone').id).toBe(DEFAULT_FRAME)
  })
})

describe('clampLook', () => {
  it('keeps known ids, turns unknown ones into the default, and leaves out what is not given', () => {
    expect(clampLook({ paper: 'kraft' })).toEqual({ paper: 'kraft' })
    expect(clampLook({ frame: 'airmail' })).toEqual({ frame: 'airmail' })
    expect(clampLook({ paper: 'nope', frame: 'nope' })).toEqual({
      paper: DEFAULT_PAPER,
      frame: DEFAULT_FRAME,
    })
    expect(clampLook({})).toEqual({})
  })

  it('ignores anything that is not a look', () => {
    expect(clampLook({ paper: 'kraft', note: 'hacked', sealedAt: 1 })).toEqual({ paper: 'kraft' })
  })
})

describe('saving a postcard’s paper and frame', () => {
  let db
  let q
  let n = 0
  let moment
  beforeEach(async () => {
    db = new PostmarkDB(`papers-${++n}`)
    q = makeQueries(db)
    setNow(new Date('2026-09-24T21:00').getTime())
    moment = await q.saveMoment('2026-09-24', { note: 'x' })
  })
  afterEach(async () => {
    setNow(null)
    await db.delete()
  })

  it('stores the choice on the postcard and keeps it', async () => {
    const saved = await q.setLook(moment.id, { paper: 'kraft', frame: 'airmail' })
    expect(saved).toMatchObject({ paper: 'kraft', frame: 'airmail', note: 'x' })
    expect(await q.getMoment(moment.id)).toMatchObject({ paper: 'kraft', frame: 'airmail' })
  })

  it('changes one thing at a time', async () => {
    await q.setLook(moment.id, { paper: 'kraft' })
    await q.setLook(moment.id, { frame: 'gold' })
    expect(await q.getMoment(moment.id)).toMatchObject({ paper: 'kraft', frame: 'gold' })
  })

  it('does not lose the look when the note is edited afterwards', async () => {
    await q.setLook(moment.id, { paper: 'aged' })
    await q.saveMoment('2026-09-24', { note: 'changed' })
    expect(await q.getMoment(moment.id)).toMatchObject({ paper: 'aged', note: 'changed' })
  })

  it('repairs an unknown id instead of storing it', async () => {
    const saved = await q.setLook(moment.id, { paper: 'does-not-exist' })
    expect(saved.paper).toBe(DEFAULT_PAPER)
  })

  it('leaves an old postcard, saved before papers existed, looking as it did', async () => {
    expect(moment.paper).toBeUndefined()
    expect(findPaper(moment.paper).id).toBe(DEFAULT_PAPER)
    expect(findFrame(moment.frame).id).toBe(DEFAULT_FRAME)
  })

  it('is locked once the postcard is sealed, except for a demo postcard', async () => {
    await q.sealMoment(moment.id, { color: '#B14126', emblem: 'heart' })
    await expect(q.setLook(moment.id, { paper: 'kraft' })).rejects.toBeInstanceOf(SealedError)
    await db.moments.update(moment.id, { demo: true })
    expect((await q.setLook(moment.id, { paper: 'kraft' })).paper).toBe('kraft')
  })

  it('says so when there is no such postcard', async () => {
    await expect(q.setLook('missing', { paper: 'kraft' })).rejects.toThrow(/No such moment/)
  })
})
