import 'fake-indexeddb/auto'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import packData from '../src/data/sticker-packs.json'
import {
  DEFAULT_STYLE,
  IMAGE_FORMATS,
  PACKS,
  STICKERS,
  TONES,
  TRAY_TABS,
  canOutline,
  canTone,
  findSticker,
  kindOf,
  searchStickers,
} from '../src/data/stickers'
import { makeQueries } from '../src/db/queries'
import { PostmarkDB } from '../src/db/schema'
import { makeStickerPrefs } from '../src/db/stickerPrefs'
import { setNow } from '../src/lib/clock'
import { clampPlacement } from '../src/lib/decor'
import { MAX_RECENT, pushRecent, toggleFavorite } from '../src/lib/stickerPrefs'

describe('the sticker catalog', () => {
  const all = PACKS.flatMap((p) => p.items)

  it('gives every sticker a unique id and a known kind', () => {
    expect(new Set(all.map((s) => s.id)).size).toBe(all.length)
    for (const s of all) expect(['img', 'stamp', 'tape', 'doodle']).toContain(kindOf(s.id))
  })

  it('keeps the older tab and sticker lists in step with the packs', () => {
    expect(TRAY_TABS.map((t) => t.id)).toEqual(PACKS.map((p) => p.id))
    expect(Object.keys(STICKERS)).toEqual(PACKS.map((p) => p.id))
  })

  it('knows which sticker is which, and which looks apply', () => {
    expect(findSticker('doodle:heart')?.label).toBe('Heart')
    expect(findSticker('img:gone/forever')).toBeUndefined()
    expect(canOutline('doodle:heart')).toBe(true)
    expect(canOutline('img:a/b')).toBe(true)
    expect(canOutline('stamp:fragile')).toBe(false)
    expect(canOutline('tape:0')).toBe(false)
    expect(canTone('img:a/b')).toBe(true)
    expect(canTone('doodle:heart')).toBe(false)
  })

  it('has tones that are a plain "original" plus color ramps', () => {
    expect(new Set(TONES.map((t) => t.id)).size).toBe(TONES.length)
    expect(TONES[0]).toMatchObject({ id: 'original', ramp: null })
    for (const tone of TONES.slice(1)) {
      expect(tone.ramp).toHaveLength(4)
      for (const color of tone.ramp) expect(color).toMatch(/^#[0-9A-F]{6}$/i)
    }
    expect(TONES.map((t) => t.id)).toContain(DEFAULT_STYLE.tone)
  })
})

describe('sticker-packs.json (yours to edit)', () => {
  it('lists packs and stickers that are well formed', () => {
    const packIds = new Set()
    for (const pack of packData.packs) {
      expect(pack.id, 'pack id').toMatch(/^[a-z0-9-]+$/)
      expect(packIds.has(pack.id), `pack ${pack.id} listed twice`).toBe(false)
      packIds.add(pack.id)
      expect(pack.label, `label of pack ${pack.id}`).toBeTruthy()
      const files = new Set()
      for (const s of pack.stickers) {
        const where = `${pack.id}/${s.file}`
        expect(s.file, where).toMatch(/^[a-z0-9-]+$/)
        expect(files.has(s.file), `${where} listed twice`).toBe(false)
        files.add(s.file)
        expect(s.label, `label of ${where}`).toBeTruthy()
        expect(Array.isArray(s.keywords ?? []), `keywords of ${where}`).toBe(true)
        expect(s.w, `width of ${where}`).toBeGreaterThan(0)
        expect(s.h, `height of ${where}`).toBeGreaterThan(0)
      }
    }
  })

  it('names a known picture format and a true-or-false ink flag, when it names them at all', () => {
    for (const pack of packData.packs) {
      if ('ink' in pack) expect(typeof pack.ink, `ink of pack ${pack.id}`).toBe('boolean')
      for (const s of pack.stickers) {
        if ('ext' in s) expect(IMAGE_FORMATS, `ext of ${pack.id}/${s.file}`).toContain(s.ext)
      }
    }
  })

  it('has an image file for every sticker it lists', () => {
    for (const pack of packData.packs) {
      for (const s of pack.stickers) {
        const name = `${s.file}.${s.ext ?? 'png'}`
        const file = resolve(__dirname, '../public/stickers', pack.id, name)
        expect(existsSync(file), `missing public/stickers/${pack.id}/${name}`).toBe(true)
      }
    }
  })
})

describe('picture formats and ink packs', () => {
  const manifest = {
    about: '',
    packs: [
      {
        id: 'marks',
        label: 'Postal marks',
        ink: true,
        stickers: [
          { file: 'round', label: 'Round mark', w: 100, h: 100, ext: 'svg' },
          { file: 'airmail', label: 'Airmail', w: 200, h: 80, ext: 'webp' },
        ],
      },
      {
        id: 'fun',
        label: 'Fun',
        stickers: [
          { file: 'kite', label: 'Kite', w: 90, h: 120 },
          { file: 'frog', label: 'Frog', w: 90, h: 90, ext: 'svg' },
          { file: 'odd', label: 'Odd', w: 90, h: 90, ext: 'gif' },
        ],
      },
    ],
  }
  let cat

  beforeEach(async () => {
    vi.resetModules()
    vi.doMock('../src/data/sticker-packs.json', () => ({ default: manifest }))
    cat = await import('../src/data/stickers')
  })
  afterEach(() => {
    vi.doUnmock('../src/data/sticker-packs.json')
    vi.resetModules()
  })

  it('points each sticker at its own file type, PNG when none is given', () => {
    expect(cat.findSticker('img:marks/round').src).toBe('stickers/marks/round.svg')
    expect(cat.findSticker('img:marks/airmail').src).toBe('stickers/marks/airmail.webp')
    expect(cat.findSticker('img:fun/kite').src).toBe('stickers/fun/kite.png')
    expect(cat.findSticker('img:fun/frog').src).toBe('stickers/fun/frog.svg')
    // a type that is not one of ours is not trusted with a path
    expect(cat.findSticker('img:fun/odd').src).toBe('stickers/fun/odd.png')
  })

  it('presses stamps and a pack marked ink into the paper, and sticks everything else on', () => {
    expect(cat.isInk('stamp:fragile')).toBe(true)
    expect(cat.isInk('img:marks/round')).toBe(true)
    expect(cat.isInk('img:marks/airmail')).toBe(true)
    expect(cat.isInk('img:fun/kite')).toBe(false)
    expect(cat.isInk('doodle:heart')).toBe(false)
    expect(cat.isInk('tape:0')).toBe(false)
    expect(cat.isInk('img:gone/forever')).toBe(false)
  })

  it('gives ink no white edge and no tone, but pictures still get both', () => {
    expect(cat.canOutline('img:marks/round')).toBe(false)
    expect(cat.canTone('img:marks/round')).toBe(false)
    expect(cat.canOutline('img:fun/frog')).toBe(true)
    expect(cat.canTone('img:fun/frog')).toBe(true)
  })

  it('finds a stamp from an ink pack by searching for its pack', () => {
    expect(cat.searchStickers('postal').map((s) => s.id)).toEqual([
      'img:marks/round',
      'img:marks/airmail',
    ])
  })
})

describe('searching stickers', () => {
  const items = [
    { id: 'a', label: 'Heart', keywords: ['love'], packLabel: 'Doodles' },
    { id: 'b', label: 'Ribbon heart', keywords: ['valentine', 'bow'], packLabel: 'Sweet' },
    { id: 'c', label: 'Coffee cup', keywords: ['espresso', 'drink', 'heart'], packLabel: 'Café' },
    { id: 'd', label: 'Hearth rug', keywords: [], packLabel: 'Cozy' },
    { id: 'e', label: 'Pinecone', keywords: ['forest'], packLabel: 'Autumn' },
  ]
  const ids = (q) => searchStickers(q, items).map((s) => s.id)

  it('matches names, keywords and pack names', () => {
    expect(ids('espresso')).toEqual(['c'])
    expect(ids('sweet')).toEqual(['b']) // by pack
    expect(ids('forest')).toEqual(['e'])
  })

  it('ranks an exact name first, then an exact keyword, then a word inside a name, then a word start', () => {
    // a: the name is exactly "Heart"; c: "heart" is exactly a keyword; b: "heart" is a word inside
    // the name; d: it only starts a word ("Hearth")
    expect(ids('heart')).toEqual(['a', 'c', 'b', 'd'])
  })

  it('ranks a match in the name above the same match in a keyword, and keeps the list order on a tie', () => {
    // all four start a word; the three names tie and keep their order, the keyword match comes after
    expect(ids('hear')).toEqual(['a', 'b', 'd', 'c'])
  })

  it('needs every word you type to match something', () => {
    expect(ids('ribbon valentine')).toEqual(['b'])
    expect(ids('ribbon espresso')).toEqual([])
  })

  it('ignores case and extra spaces, and gives nothing for an empty search', () => {
    expect(ids('  PINE  ')).toEqual(['e'])
    expect(ids('')).toEqual([])
    expect(ids('   ')).toEqual([])
  })

  it('finds the real drawn stickers', () => {
    expect(searchStickers('heart')[0].id).toBe('doodle:heart')
    expect(searchStickers('fragile').map((s) => s.id)).toContain('stamp:fragile')
    expect(searchStickers('washi').length).toBeGreaterThanOrEqual(5)
  })
})

describe('recent and saved lists', () => {
  it('moves the newest to the front without repeats, and stops at the limit', () => {
    expect(pushRecent(['a', 'b', 'c'], 'c')).toEqual(['c', 'a', 'b'])
    expect(pushRecent([], 'x')).toEqual(['x'])
    const long = Array.from({ length: MAX_RECENT }, (_, i) => `s${i}`)
    const next = pushRecent(long, 'new')
    expect(next).toHaveLength(MAX_RECENT)
    expect(next[0]).toBe('new')
    expect(next).not.toContain(`s${MAX_RECENT - 1}`)
  })

  it('saves at the front and removes on a second tap', () => {
    expect(toggleFavorite(['a'], 'b')).toEqual(['b', 'a'])
    expect(toggleFavorite(['b', 'a'], 'b')).toEqual(['a'])
  })
})

describe('what the tray remembers', () => {
  let db
  let n = 0
  beforeEach(() => {
    db = new PostmarkDB(`stickerprefs-${++n}`)
  })
  afterEach(async () => {
    await db.delete()
  })

  it('starts empty, with the default look', async () => {
    expect(await makeStickerPrefs(db).getAll()).toEqual({
      recent: [],
      favorites: [],
      style: DEFAULT_STYLE,
    })
  })

  it('remembers recent stickers, newest first', async () => {
    const prefs = makeStickerPrefs(db)
    await prefs.used('doodle:heart')
    await prefs.used('doodle:star')
    await prefs.used('doodle:heart')
    expect((await prefs.getAll()).recent).toEqual(['doodle:heart', 'doodle:star'])
  })

  it('saves and un-saves favorites', async () => {
    const prefs = makeStickerPrefs(db)
    expect(await prefs.toggleSaved('doodle:sun')).toEqual(['doodle:sun'])
    expect(await prefs.toggleSaved('doodle:sun')).toEqual([])
  })

  it('remembers the look new stickers start with, one setting at a time', async () => {
    const prefs = makeStickerPrefs(db)
    await prefs.setStyle({ tone: 'cream' })
    await prefs.setStyle({ outline: false })
    expect((await prefs.getAll()).style).toEqual({ tone: 'cream', outline: false })
  })

  it('keeps it across a restart', async () => {
    await makeStickerPrefs(db).setStyle({ tone: 'rose' })
    expect((await makeStickerPrefs(db).getAll()).style.tone).toBe('rose')
  })
})

describe('a sticker’s look', () => {
  it('keeps a known tone and turns the edge into on or off', () => {
    expect(clampPlacement({ tone: 'cream', outline: 0 })).toEqual({ tone: 'cream', outline: false })
    expect(clampPlacement({ outline: true })).toEqual({ outline: true })
  })

  it('does not trust a tone it does not know', () => {
    expect(clampPlacement({ tone: 'neon' }).tone).toBe('original')
  })

  it('leaves the look alone when it is not given', () => {
    expect(clampPlacement({ x: 0.2 })).toEqual({ x: 0.2 })
  })
})

describe('saving a sticker’s look on a postcard', () => {
  let db
  let q
  let n = 0
  let moment
  beforeEach(async () => {
    db = new PostmarkDB(`stickerlook-${++n}`)
    q = makeQueries(db)
    setNow(new Date('2026-09-24T21:00').getTime())
    moment = await q.saveMoment('2026-09-24', { note: 'x' })
  })
  afterEach(async () => {
    setNow(null)
    await db.delete()
  })

  it('stores tone and edge with the sticker', async () => {
    const d = await q.addDecoration(moment.id, {
      stickerId: 'doodle:heart',
      tone: 'cocoa',
      outline: false,
    })
    expect(d).toMatchObject({ tone: 'cocoa', outline: false })
    expect((await q.decorationsFor(moment.id))[0]).toMatchObject({ tone: 'cocoa', outline: false })
  })

  it('changes the look later, and guards against a bad tone', async () => {
    const d = await q.addDecoration(moment.id, { stickerId: 'doodle:heart' })
    expect(d.tone).toBeUndefined() // older stickers have no look stored; the screen treats that as the default
    expect(await q.updateDecoration(d.id, { tone: 'sage' })).toMatchObject({ tone: 'sage' })
    expect(await q.updateDecoration(d.id, { tone: 'bogus' })).toMatchObject({ tone: 'original' })
    expect(await q.updateDecoration(d.id, { outline: true })).toMatchObject({ outline: true })
  })
})
