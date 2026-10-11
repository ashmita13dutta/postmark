import { describe, expect, it } from 'vitest'
import { buildLexicon } from '../src/engine/mood'
import { buildMoods } from '../src/engine/moods'
import { HEAD } from '../src/engine/reader/head'
import { readNote } from '../src/engine/readNote'
import { explainReading, quoted } from '../src/engine/why'

const base = { day: '2026-10-08', hour: 15, month: 10 }
const unit = (hot) => Array.from({ length: HEAD.dim }, (_, i) => (i === hot ? 1 : 0))
const reading = (feeling, p = 0.82) => ({
  vector: unit(5),
  probs: HEAD.feelings.map((f) => (f === feeling ? p : (1 - p) / (HEAD.feelings.length - 1))),
})
const COLORS = ['#2A3B4C', '#5B7FA3', '#C9A66B', '#E8D8B4', '#F6EFE0']
const moods = buildMoods([
  {
    id: 'my:ab12cd34',
    label: 'Wandering',
    colors: COLORS.map((hex) => ({ hex, name: 'x' })),
    createdAt: 1,
  },
])
const lexicon = buildLexicon(
  [
    { word: 'ghurni', kind: 'feeling', id: 'my:ab12cd34', parts: 1, example: 'ghurni' },
    { word: 'quiet', kind: 'feeling', id: 'sad', parts: 1, example: 'quiet' },
  ],
  moods,
)

const why = (text, extra = {}) => {
  const r = readNote({ ...base, text, lexicon, moods, ...extra })
  return explainReading({ r, text, moods })
}

describe('quoted', () => {
  it('lists words the way you would say them', () => {
    expect(quoted([])).toBe('')
    expect(quoted(['happy'])).toBe('“happy”')
    expect(quoted(['happy', 'glad'])).toBe('“happy” and “glad”')
    expect(quoted(['a', 'b', 'c'])).toBe('“a”, “b” and “c”')
    expect(quoted(['a', 'b', 'c', 'd', 'e'])).toBe('“a”, “b”, “c” and 2 more')
    expect(quoted(['a', 'a', 'b'])).toBe('“a” and “b”')
  })
})

describe('why: the keyword reading', () => {
  it('names the feeling words that decided it', () => {
    const w = why('So happy today, shopping with Riya!')
    expect(w.headline).toBe('Joyful: from “happy”.')
  })

  it('says so when only the topic suggested a mood', () => {
    expect(why('Rain at the tram stop.').headline).toBe(
      'Peaceful: no feeling words, so the usual mood for rain.',
    )
  })

  it('says so when a bare “!” lifted it', () => {
    expect(why('Ran my first 5k!').headline).toBe(
      'Joyful: no feeling words, but the “!” lifts the usual mood for fitness.',
    )
  })

  it('says so when there was nothing to go on', () => {
    expect(why('zxqv wplk').headline).toBe(
      'Content: nothing in the note points to a feeling, so it starts from Content.',
    )
  })
})

describe('why: the topic', () => {
  it('names the topic words', () => {
    expect(why('So happy today, shopping with Riya!').lines).toContain(
      'About Shopping: from “shopping”.',
    )
  })

  it('explains a topic chosen without topic words', () => {
    expect(why('zxqv wplk').lines).toContain(
      'About Autumn: no topic words, so it went by the season.',
    )
    const night = why('zxqv wplk', { hour: 23 })
    expect(night.lines[0]).toMatch(/^About .+: no topic words, so it went by the time of day\.$/)
  })
})

describe('why: the colors', () => {
  it('says which word asked for a color, and how strongly', () => {
    const strong = why('A breezy morning, so happy!')
    expect(strong.lines).toContain(
      '“breezy morning” asked for Breezy Blue, so the stamp is built around it.',
    )
    const accent = why('Rain at the tram stop.')
    expect(accent.lines).toContain('“rain” added Rain Blue as an accent.')
  })

  it('mentions bright colors only when the stamp is vivid', () => {
    expect(why('So happy today!').lines).toContain('Bright colors, because the note sounds strong.')
    expect(why('Rain at the tram stop.').lines.join(' ')).not.toMatch(/Bright/)
  })
})

describe('why: words you taught', () => {
  it('lists the taught words that counted', () => {
    const w = why('so quiet today')
    expect(w.headline).toBe('Sad: from “quiet”.')
    expect(w.lines).toContain('Words you taught that counted: “quiet”.')
  })

  it('says nothing about taught words when none were used', () => {
    expect(why('So happy today!').lines.join(' ')).not.toMatch(/taught/)
  })
})

describe('why: a mood of yours', () => {
  it('credits your word and says the colors are exactly yours', () => {
    const w = why('Ghurni all day, no plans.')
    expect(w.headline).toBe('Wandering: your word “ghurni” brings it on.')
    expect(w.lines).toContain('The colors are exactly the five you chose for Wandering.')
    expect(w.lines).toContain('Words you taught that counted: “ghurni”.')
  })

  it('uses the plural for two words', () => {
    const more = buildLexicon(
      [
        { word: 'ghurni', kind: 'feeling', id: 'my:ab12cd34', parts: 1 },
        { word: 'adda', kind: 'feeling', id: 'my:ab12cd34', parts: 1 },
      ],
      moods,
    )
    const text = 'Ghurni and adda all day'
    const r = readNote({ ...base, text, lexicon: more, moods })
    expect(explainReading({ r, text, moods }).headline).toBe(
      'Wandering: your words “ghurni” and “adda” bring it on.',
    )
  })
})

describe('why: the on-device reader', () => {
  const NOTE = 'Walked home through the market at golden hour'

  it('gives its confidence', () => {
    expect(why(NOTE, { reader: reading('peaceful') }).headline).toBe(
      'Peaceful: read from the whole note, 82% sure.',
    )
  })

  it('says when a correction you made to a near-identical note backed it', () => {
    const w = why('Walked home', {
      reader: reading('peaceful'),
      corrections: [{ vector: unit(5), feeling: 'peaceful' }],
    })
    expect(w.headline).toContain('it matches a note you corrected before')
  })

  it('says when a word you taught agrees', () => {
    const w = why('so quiet today', { reader: reading('sad', 0.6) })
    expect(w.headline).toBe('Sad: read from the whole note, 60% sure; a word you taught agrees.')
  })

  it('gives the reader’s own confidence, not the score after a taught word was added', () => {
    // the taught word lifts "sad" well above 60% in the mix, but the reader itself said 60%
    const r = readNote({
      ...base,
      text: 'so quiet today',
      lexicon,
      moods,
      reader: reading('sad', 0.6),
    })
    expect(r.guess.ranked[0].p).toBeGreaterThan(0.9)
    expect(explainReading({ r, text: 'so quiet today', moods }).headline).toContain('60% sure')
  })

  it('says plainly when a word you taught outweighed the reader', () => {
    const w = why('so quiet today', { reader: reading('peaceful', 0.5) })
    expect(w.headline).toBe(
      'Sad: the reader leaned to Peaceful (50%), but a word you taught tipped it.',
    )
  })

  it('says plainly when a note you corrected outweighed the reader', () => {
    const w = why('Walked home', {
      reader: reading('peaceful', 0.5),
      corrections: [{ vector: unit(5), feeling: 'sad' }],
    })
    expect(w.headline).toBe(
      'Sad: the reader leaned to Peaceful (50%), but a note you corrected before tipped it.',
    )
  })

  it('does not claim memory or taught words when there were none', () => {
    const w = why(NOTE, { reader: reading('peaceful') })
    expect(w.headline).not.toMatch(/corrected|taught/)
  })

  it('a mood of yours still beats the reader, and says so', () => {
    const w = why('Ghurni all day', { reader: reading('sad', 0.9) })
    expect(w.headline).toBe('Wandering: your word “ghurni” brings it on.')
  })
})

describe('why: when you corrected it', () => {
  it('says what you chose and what the app had read, and why', () => {
    const w = why('So happy today!', { override: { feeling: 'sad' } })
    expect(w.headline).toBe('You chose Sad. The app read Joyful: from “happy”.')
  })

  it('says what you chose for the topic and what the app had read', () => {
    const w = why('So happy today!', { override: { topic: 'exams' } })
    expect(w.lines).toContain('You chose Exams & study as the topic; the app read Autumn.')
  })

  it('names a mood of yours that you picked', () => {
    const w = why('A plain walk home', { override: { feeling: 'my:ab12cd34' } })
    expect(w.headline).toMatch(/^You chose Wandering\. The app read /)
    expect(w.lines).toContain('The colors are exactly the five you chose for Wandering.')
  })
})
