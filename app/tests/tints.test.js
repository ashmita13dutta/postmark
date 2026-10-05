import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import tintData from '../src/data/tints.json'
import { feelings } from '../src/data/feelings.json'
import { makeQueries } from '../src/db/queries'
import { PostmarkDB } from '../src/db/schema'
import { buildLexicon, detectMood } from '../src/engine/mood'
import { buildPalette } from '../src/engine/palette'
import { entriesFromSelection, teachableTokens } from '../src/engine/teach'
import { hexToOklab } from '../src/lib/color'

const bluish = (hex) => {
  const l = hexToOklab(hex)
  const h = ((Math.atan2(l.b, l.a) * 180) / Math.PI + 360) % 360
  return Math.hypot(l.a, l.b) > 0.05 && h >= 215 && h <= 290
}
const read = (text) => detectMood({ text, hour: 8, month: 4 })
const stamp = (text, seed = 'd') => {
  const m = read(text)
  return buildPalette({ ...m, seed, hour: 8, month: 4 })
}

describe('tints.json', () => {
  it('has valid colors, names and joined lowercase words', () => {
    const seen = new Set()
    for (const t of tintData.tints) {
      expect(t.color).toMatch(/^#[0-9A-F]{6}$/)
      expect(t.name.length).toBeGreaterThan(2)
      expect(seen.has(t.name)).toBe(false)
      seen.add(t.name)
      for (const w of t.words) expect(w).toMatch(/^\p{Ll}+$/u)
    }
  })
})

describe('reading colors from a note', () => {
  it('"morning breeze" asks for bright blue, however it is phrased', () => {
    for (const text of [
      'Soft morning breeze today',
      'Such a breezy morning',
      'a fresh breeze at dawn',
    ]) {
      const m = read(text)
      expect(m.tints[0], text).toBe('#3AA0F0')
    }
  })
  it('a phrase is strong; a lone mention is not', () => {
    expect(read('morning breeze, lovely').tintStrong).toBe(true)
    expect(read('there was a breeze').tintStrong).toBe(false)
  })
  it('negation turns it off', () => {
    expect(read('Lazy day, no breeze at all').tints).toEqual([])
  })
  it('a note with no color words has none', () => {
    expect(read('Finished my taxes').tints).toEqual([])
  })
})

describe('the stamp follows the color', () => {
  const notes = [
    'Woke up to a breezy morning and just felt peaceful',
    'Soft morning breeze, so happy today!',
    'Missed him on a breezy morning',
    'Exam stress but the morning breeze helped',
  ]
  it.each(notes)('is mostly blue: %s', (text) => {
    const p = stamp(text)
    expect(p.tinted).toBe(true)
    expect(p.colors.filter((c) => bluish(c.hex)).length).toBeGreaterThanOrEqual(3)
  })
  it('stays five distinct colors and keeps the mood', () => {
    for (const text of notes) {
      const p = stamp(text)
      expect(p.colors).toHaveLength(5)
      expect(new Set(p.colors.map((c) => c.hex)).size).toBe(5)
    }
    expect(read(notes[2]).feeling).toBe('sad')
  })
  it('stays inside the feeling look envelope', () => {
    for (const text of notes) {
      const m = read(text)
      const p = buildPalette({ ...m, seed: 'd', hour: 8, month: 4 })
      const [, hi] = feelings[m.feeling].look.chroma
      const mean =
        p.colors.reduce((s, c) => {
          const l = hexToOklab(c.hex)
          return s + Math.hypot(l.a, l.b)
        }, 0) / 5
      expect(mean).toBeLessThanOrEqual(hi + 0.02)
    }
  })
})

describe('colors you teach', () => {
  it('a taught word brings its color, and beats the built-in', () => {
    const text = 'Wearing my chai coloured scarf'
    const tokens = teachableTokens(text, buildLexicon([]))
    const idx = tokens.filter((t) => t.word === 'scarf').map((t) => t.index)
    const entries = entriesFromSelection(tokens, idx, 'tint', '#E91E63')
    const lex = buildLexicon(entries)
    expect(detectMood({ text, hour: 9, month: 4, lexicon: lex }).tints[0]).toBe('#E91E63')
    expect(detectMood({ text, hour: 9, month: 4 }).tints[0]).not.toBe('#E91E63')
  })
  it('rejects a bad color', () => {
    const tokens = teachableTokens('scarf', buildLexicon([]))
    expect(() => entriesFromSelection(tokens, [0], 'tint', 'pink')).toThrow()
  })
  it('a word can mean a feeling and a color at once, and each is forgotten alone', async () => {
    const q = makeQueries(new PostmarkDB(`t${Math.random()}`))
    await q.teachWords([
      { word: 'scarf', kind: 'feeling', id: 'content' },
      { word: 'scarf', kind: 'tint', id: '#e91e63' },
    ])
    let rows = await q.getLexicon()
    expect(rows).toHaveLength(2)
    expect(rows.every((r) => r.word === 'scarf')).toBe(true)
    const colorRow = rows.find((r) => r.kind === 'tint')
    expect(colorRow.id).toBe('#E91E63')
    await q.forgetWord(colorRow.key)
    rows = await q.getLexicon()
    expect(rows.map((r) => r.kind)).toEqual(['feeling'])
  })
})
