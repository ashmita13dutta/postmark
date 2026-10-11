import { describe, expect, it } from 'vitest'
import {
  PACKS,
  canOutline,
  canTone,
  findSticker,
  isInk,
  kindOf,
  searchStickers,
} from '../src/data/stickers'
import { MAX_WORD_LENGTH, WORDS, findWord, wordLayout } from '../src/data/words'

describe('words.json (yours to edit)', () => {
  it('gives every word a unique simple id, some text, a look and a color', () => {
    expect(new Set(WORDS.map((w) => w.id)).size).toBe(WORDS.length)
    for (const w of WORDS) {
      expect(w.id, 'id').toMatch(/^[a-z0-9-]+$/)
      expect(w.text?.trim(), `text of ${w.id}`).toBeTruthy()
      expect(['script', 'label'], `look of ${w.id}`).toContain(w.look)
      expect(w.color, `color of ${w.id}`).toMatch(/^#[0-9A-F]{6}$/i)
      expect(Array.isArray(w.keywords ?? []), `keywords of ${w.id}`).toBe(true)
    }
  })

  it('keeps every word short enough to read, in the tray and on the card', () => {
    for (const w of WORDS) expect(w.text.length, w.id).toBeLessThanOrEqual(MAX_WORD_LENGTH)
  })

  it('keeps label colors dark enough for the cream letters on them (contrast 4.5 to 1)', () => {
    // WCAG relative luminance, so "dark enough" means what accessibility checkers mean by it
    const luminance = (hex) => {
      const [r, g, b] = [1, 3, 5]
        .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
        .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
      return 0.2126 * r + 0.7152 * g + 0.0722 * b
    }
    const cream = luminance('#FDF8EC')
    for (const w of WORDS.filter((x) => x.look === 'label')) {
      const contrast = (cream + 0.05) / (luminance(w.color) + 0.05)
      expect(
        contrast,
        `${w.id} (${w.color}) is too light for cream letters`,
      ).toBeGreaterThanOrEqual(4.5)
    }
  })
})

describe('how big a word is drawn', () => {
  const script = { id: 'a', text: 'hello', look: 'script', color: '#B14126' }

  it('gets wider with more letters, and always has room around them', () => {
    const short = wordLayout({ ...script, text: 'hi' })
    const long = wordLayout({ ...script, text: 'hello there' })
    expect(long.width).toBeGreaterThan(short.width)
    expect(short.width).toBeGreaterThan(short.textWidth)
    expect(short.height).toBeGreaterThan(short.fontSize)
  })

  it('writes a label in capitals and a script word as typed', () => {
    expect(wordLayout({ ...script, look: 'label', text: 'chai time' }).text).toBe('CHAI TIME')
    expect(wordLayout({ ...script, text: 'Miss You' }).text).toBe('Miss You')
  })

  it('treats a look it does not know as handwriting, and an empty word as one letter wide', () => {
    expect(wordLayout({ ...script, look: 'neon' }).look).toBe('script')
    expect(wordLayout({ ...script, text: '' }).textWidth).toBeGreaterThan(0)
  })

  it('is stable: the same word always gets the same box', () => {
    expect(wordLayout(WORDS[0])).toEqual(wordLayout(WORDS[0]))
  })
})

describe('words in the sticker tray', () => {
  const pack = PACKS.find((p) => p.id === 'words')

  it('has a Words tab with one sticker for each word, in the order of words.json', () => {
    expect(pack?.label).toBe('Words')
    expect(pack.items.map((i) => i.id)).toEqual(WORDS.map((w) => `word:${w.id}`))
    expect(pack.items.map((i) => i.label)).toEqual(WORDS.map((w) => w.text))
  })

  it('lets a postcard find each word again by its id', () => {
    for (const w of WORDS) {
      expect(findSticker(`word:${w.id}`)?.label).toBe(w.text)
      expect(findWord(w.id)).toBe(w)
      expect(kindOf(`word:${w.id}`)).toBe('word')
    }
    expect(findWord('gone')).toBeUndefined()
    expect(findSticker('word:gone')).toBeUndefined()
  })

  it('takes the white edge like a doodle, but is not ink and has no tone', () => {
    expect(canOutline('word:hello')).toBe(true)
    expect(canTone('word:hello')).toBe(false)
    expect(isInk('word:hello')).toBe(false)
  })

  it('is found by search: by its text, by a keyword, and by the pack name', () => {
    expect(searchStickers('miss you')[0].id).toBe('word:miss-you')
    expect(searchStickers('monsoon').map((s) => s.id)).toContain('word:rain')
    expect(searchStickers('bangla').map((s) => s.id)).toEqual(
      expect.arrayContaining(['word:ki-khobor', 'word:bhalo-theko', 'word:adda']),
    )
    expect(searchStickers('words').length).toBeGreaterThanOrEqual(WORDS.length)
  })
})
