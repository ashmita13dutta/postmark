import { describe, expect, it } from 'vitest'
import { feelings } from '../src/data/feelings.json'
import { detectMood } from '../src/engine/mood'
import { HEAD } from '../src/engine/reader/head'
import { readNote } from '../src/engine/readNote'

const base = { day: '2026-10-08', hour: 15, month: 10 }
const FEELING_IDS = Object.keys(feelings)
const unit = (hot) => Array.from({ length: HEAD.dim }, (_, i) => (i === hot ? 1 : 0))

// what the reader hands over: a probability for each of head.feelings, mostly on one feeling
function reading(feeling, p = 0.9) {
  const rest = (1 - p) / (HEAD.feelings.length - 1)
  return {
    vector: unit(5),
    probs: HEAD.feelings.map((f) => (f === feeling ? p : rest)),
  }
}

const NOTE = 'Walked home through the market at golden hour'

describe('readNote without the reader (the built-in method)', () => {
  it('reads exactly as the keyword engine does', () => {
    const r = readNote({ ...base, text: 'So happy today, shopping with Riya!' })
    const mood = detectMood({ text: 'So happy today, shopping with Riya!', hour: 15, month: 10 })
    expect(r.guess.source).toBe('words')
    expect(r.guess.feeling).toBe(mood.feeling)
    expect(r.feeling).toBe(mood.feeling)
    expect(r.energy).toBe(mood.energy)
    expect(r.corrected).toEqual({ feeling: false, topic: false })
  })

  it('lists the engine’s own guess first, then any others it considered', () => {
    const r = readNote({ ...base, text: 'So happy today, shopping with Riya!' })
    expect(r.guess.ranked[0].id).toBe(r.guess.feeling)
    expect(new Set(r.guess.ranked.map((x) => x.id)).size).toBe(r.guess.ranked.length)
  })

  it('ignores a reading when there is no note', () => {
    const r = readNote({ ...base, text: '   ', reader: reading('sad') })
    expect(r.guess.source).toBe('words')
  })
})

describe('readNote with the reader', () => {
  it('lets the reader decide the feeling', () => {
    const r = readNote({ ...base, text: NOTE, reader: reading('sad') })
    expect(r.guess.source).toBe('reader')
    expect(r.guess.feeling).toBe('sad')
    expect(r.feeling).toBe('sad')
    expect(r.corrected.feeling).toBe(false)
    expect(r.built.colors).toHaveLength(5)
  })

  it('still takes the topic and color words from the keyword engine', () => {
    const withReader = readNote({ ...base, text: NOTE, reader: reading('sad') })
    const without = readNote({ ...base, text: NOTE })
    expect(withReader.topic).toBe(without.topic)
    expect(withReader.mood.tints).toEqual(without.mood.tints)
  })

  it('ranks every feeling with a probability', () => {
    const r = readNote({ ...base, text: NOTE, reader: reading('proud') })
    expect(r.guess.ranked).toHaveLength(FEELING_IDS.length)
    expect(r.guess.ranked[0]).toMatchObject({ id: 'proud' })
    expect(r.guess.ranked[0].p).toBeGreaterThan(0.8)
  })

  it('lets a correction beat the reader, and remembers what the reader said', () => {
    const r = readNote({
      ...base,
      text: NOTE,
      reader: reading('sad'),
      override: { feeling: 'joyful' },
    })
    expect(r.feeling).toBe('joyful')
    expect(r.guess.feeling).toBe('sad')
    expect(r.corrected.feeling).toBe(true)
  })

  it('treats a correction that matches the reader as no correction', () => {
    const r = readNote({
      ...base,
      text: NOTE,
      reader: reading('sad'),
      override: { feeling: 'sad' },
    })
    expect(r.corrected.feeling).toBe(false)
  })

  it('ignores a correction to a feeling that does not exist', () => {
    const r = readNote({
      ...base,
      text: NOTE,
      reader: reading('sad'),
      override: { feeling: 'mystified' },
    })
    expect(r.feeling).toBe('sad')
  })

  it('gives words you taught extra weight when the reader is unsure', () => {
    const lexicon = [{ word: 'chaplaincy', kind: 'feeling', id: 'bored', parts: 1 }]
    const text = 'The seminar was absolute chaplaincy'
    const unsure = { vector: unit(5), probs: HEAD.feelings.map(() => 1 / HEAD.feelings.length) }
    expect(readNote({ ...base, text, reader: unsure }).feeling).not.toBe('bored')
    expect(readNote({ ...base, text, reader: unsure, lexicon }).feeling).toBe('bored')
  })

  it('follows an earlier correction of a near-identical note', () => {
    const near = reading('sad', 0.6)
    const corrections = [{ vector: near.vector, feeling: 'proud' }]
    expect(readNote({ ...base, text: NOTE, reader: near }).feeling).toBe('sad')
    expect(readNote({ ...base, text: NOTE, reader: near, corrections }).feeling).toBe('proud')
  })

  describe('how bright the stamp is', () => {
    const energy = (feeling, p, text, extra = {}) =>
      readNote({ ...base, text, reader: reading(feeling, p), ...extra }).energy

    it('is vivid for a loud feeling the reader is sure of', () => {
      expect(energy('joyful', 0.9, 'A good day')).toBe('vivid')
    })
    it('is soft for a loud feeling the reader is unsure of', () => {
      expect(energy('joyful', 0.3, 'A good day')).toBe('soft')
    })
    it('is vivid again when the note is shouted', () => {
      expect(energy('joyful', 0.3, 'A good day!')).toBe('vivid')
    })
    it('is always soft for a quiet feeling', () => {
      expect(energy('peaceful', 0.9, 'A good day!')).toBe('soft')
    })
    it('is soft once you have corrected the feeling', () => {
      expect(energy('joyful', 0.9, 'A good day', { override: { feeling: 'angry' } })).toBe('soft')
    })
  })
})
