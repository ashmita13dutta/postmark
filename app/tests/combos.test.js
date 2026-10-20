import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { makeQueries } from '../src/db/queries'
import { PostmarkDB } from '../src/db/schema'
import { buildLexicon, detectMood } from '../src/engine/mood'
import { buildMoods } from '../src/engine/moods'
import { readNote } from '../src/engine/readNote'
import { comboFromSelection, parseTyped, teachableTokens } from '../src/engine/teach'
import { explainReading } from '../src/engine/why'

const ctx = { hour: 15, month: 10 }
const COLORS = ['#2A3B4C', '#5B7FA3', '#C9A66B', '#E8D8B4', '#F6EFE0']
const moods = buildMoods([
  {
    id: 'my:ab12cd34',
    label: 'Cosy chaos',
    colors: COLORS.map((hex) => ({ hex, name: 'x' })),
    createdAt: 1,
  },
])
const combo = (words, target = 'my:ab12cd34', extra = {}) => ({
  kind: 'feeling',
  target,
  parts: words.map((w) => ({ word: w, parts: 1 })),
  ...extra,
})
const lex = (combos, m = moods, entries = []) => buildLexicon(entries, m, combos)
const mood = (text, lexicon) => detectMood({ text, ...ctx, lexicon })

describe('a combo only counts when all of its words are in the note', () => {
  const lexicon = lex([combo(['rain', 'chai'])])

  it('fires when both words are there, in any order and far apart', () => {
    expect(mood('Rain all day, and then a long evening with my chai.', lexicon).feeling).toBe(
      'my:ab12cd34',
    )
    expect(mood('Chai first thing. Rain by noon.', lexicon).feeling).toBe('my:ab12cd34')
  })

  it('does nothing when a word is missing', () => {
    expect(mood('Rain all day.', lexicon).feeling).not.toBe('my:ab12cd34')
    expect(mood('A long evening with my chai.', lexicon).feeling).not.toBe('my:ab12cd34')
  })

  it('counts a word that is negated as not there', () => {
    expect(mood('No rain today, just chai.', lexicon).feeling).not.toBe('my:ab12cd34')
  })

  it('matches the usual forms of a single word', () => {
    expect(mood('It rained and I made chai.', lexicon).feeling).toBe('my:ab12cd34')
  })

  it('lists the combo among the words you taught that counted', () => {
    const m = mood('Rain and chai.', lexicon)
    expect(m.taught).toContain('rain + chai')
    expect(m.taughtFeelings).toContain('my:ab12cd34')
  })

  it('uses the way you typed it as its name', () => {
    const named = lex([combo(['rain', 'chai'], 'my:ab12cd34', { example: 'Rain + Chai' })])
    expect(mood('rain and chai', named).taught).toContain('Rain + Chai')
  })

  it('matches a phrase part only as that exact phrase', () => {
    const phrase = lex([
      {
        kind: 'feeling',
        target: 'my:ab12cd34',
        parts: [
          { word: 'bhalolagche', parts: 2 },
          { word: 'chai', parts: 1 },
        ],
      },
    ])
    expect(mood('Bhalo lagche today, with chai.', phrase).feeling).toBe('my:ab12cd34')
    expect(mood('Bhalo chai, lagche late.', phrase).feeling).not.toBe('my:ab12cd34')
  })
})

describe('how much a combo counts for', () => {
  it('beats the words it is made of when they were taught separately', () => {
    const separate = [
      { word: 'rain', kind: 'feeling', id: 'peaceful', parts: 1 },
      { word: 'chai', kind: 'feeling', id: 'joyful', parts: 1 },
    ]
    const both = lex([combo(['rain', 'chai'])], moods, separate)
    expect(mood('Rain and chai.', lex([], moods, separate)).feeling).not.toBe('my:ab12cd34')
    expect(mood('Rain and chai.', both).feeling).toBe('my:ab12cd34')
  })

  it('does not swamp a note full of strong built-in feeling words', () => {
    const lexicon = lex([combo(['rain', 'chai'])])
    const text = 'Rain and chai, but then I got the offer and I was so happy, thrilled and joyful!'
    expect(mood(text, lexicon).feeling).toBe('joyful')
  })

  it('can point at a built-in feeling or a topic', () => {
    const toFeeling = lex([combo(['rain', 'chai'], 'sad')])
    expect(mood('Rain and chai.', toFeeling).feeling).toBe('sad')
    const toTopic = lex([{ kind: 'topic', target: 'exams', parts: combo(['rain', 'chai']).parts }])
    expect(mood('Rain and chai.', toTopic).topic).toBe('exams')
  })
})

describe('combos that cannot be used are left out', () => {
  it('needs two or more parts', () => {
    expect(mood('Rain and chai.', lex([combo(['rain'])])).feeling).not.toBe('my:ab12cd34')
  })

  it('needs its target to exist', () => {
    const gone = lex([combo(['rain', 'chai'], 'my:deadbeef')])
    expect(mood('Rain and chai.', gone).feeling).not.toBe('my:deadbeef')
    const noMoods = buildLexicon([], undefined, [combo(['rain', 'chai'])])
    expect(mood('Rain and chai.', noMoods).feeling).not.toBe('my:ab12cd34')
    expect(lex([combo(['rain', 'chai'], 'nonsense')]).combos).toHaveLength(0)
  })

  it('does not disturb notes when there are none', () => {
    const text = 'So happy today, shopping with Riya!'
    expect(mood(text, lex([])).feeling).toBe(mood(text).feeling)
    expect(buildLexicon([]).combos).toEqual([])
  })
})

describe('reading a note with a combo to one of your moods', () => {
  it('makes it the reading, with exactly your colors, and says why', () => {
    const lexicon = lex([combo(['rain', 'chai'], 'my:ab12cd34', { example: 'rain + chai' })])
    const text = 'Rain all day, chai in a clay cup.'
    const r = readNote({ day: '2026-10-08', ...ctx, text, lexicon, moods })
    expect(r.feeling).toBe('my:ab12cd34')
    expect(r.built.colors.map((c) => c.hex)).toEqual(COLORS)
    const why = explainReading({ r, text, moods })
    expect(why.headline).toBe('Cosy chaos: your word “rain + chai” brings it on.')
    expect(why.lines).toContain('Words you taught that counted: “rain + chai”.')
  })
})

describe('combos from tapped words', () => {
  const tokens = teachableTokens('Rain all day, chai in a clay cup, Dadu', new Map())
  const at = (w) => tokens.find((t) => t.word === w).index

  it('turns two separate taps into one combo', () => {
    const c = comboFromSelection(tokens, [at('rain'), at('chai')], 'feeling', 'my:ab12cd34', moods)
    expect(c).toEqual({
      kind: 'feeling',
      target: 'my:ab12cd34',
      parts: [
        { word: 'rain', parts: 1 },
        { word: 'chai', parts: 1 },
      ],
      example: 'Rain + chai',
    })
  })

  it('keeps neighbouring taps together as one phrase', () => {
    const c = comboFromSelection(tokens, [at('rain'), at('clay'), at('cup')], 'topic', 'exams')
    expect(c.parts).toEqual([
      { word: 'rain', parts: 1 },
      { word: 'claycup', parts: 2 },
    ])
  })

  it('needs two separate runs, and not for a color', () => {
    expect(comboFromSelection(tokens, [at('rain')], 'feeling', 'sad')).toBeNull()
    expect(comboFromSelection(tokens, [at('clay'), at('cup')], 'feeling', 'sad')).toBeNull()
    expect(comboFromSelection(tokens, [at('rain'), at('chai')], 'tint', '#112233')).toBeNull()
  })

  it('refuses more than four parts', () => {
    const many = teachableTokens('rain chai. mist. fog. dew. smog.', new Map())
    expect(
      comboFromSelection(
        many,
        many.map((t) => t.index),
        'feeling',
        'sad',
      ),
    ).toBeNull()
  })
})

describe('words typed straight into a mood', () => {
  const parse = (text) => parseTyped(text, 'feeling', 'my:ab12cd34', moods)

  it('takes words separated by commas, and phrases, and combos', () => {
    const { entries, combos, skipped } = parse('ghurni, bhalo lagche, Rain + chai')
    expect(entries.map((e) => [e.word, e.parts, e.example])).toEqual([
      ['ghurni', 1, 'ghurni'],
      ['bhalolagche', 2, 'bhalo lagche'],
    ])
    expect(combos).toHaveLength(1)
    expect(combos[0].parts.map((p) => p.word)).toEqual(['rain', 'chai'])
    expect(combos[0].example).toBe('Rain + chai')
    expect(skipped).toEqual([])
    expect(entries.every((e) => e.kind === 'feeling' && e.id === 'my:ab12cd34')).toBe(true)
  })

  it('also splits on new lines and semicolons', () => {
    expect(parse('ghurni;adda\nphuchka').entries.map((e) => e.word)).toEqual([
      'ghurni',
      'adda',
      'phuchka',
    ])
  })

  it('leaves out filler, empties and over-long phrases, and says which', () => {
    const { entries, skipped } = parse('the, , ghurni, one two three four five six')
    expect(entries.map((e) => e.word)).toEqual(['ghurni'])
    expect(skipped).toEqual(['the', 'one two three four five six'])
  })

  it('skips a combo that is missing a side, or repeats a word', () => {
    expect(parse('rain + ').combos).toEqual([])
    expect(parse('rain + the').skipped).toEqual(['rain + the'])
    expect(parse('rain + rain').skipped).toEqual(['rain + rain'])
    expect(parse('a + b + c + d + e').skipped).toHaveLength(1)
  })

  it('works for text that is not a string', () => {
    expect(parseTyped(undefined, 'feeling', 'sad')).toEqual({
      entries: [],
      combos: [],
      skipped: [],
    })
  })
})

describe('saving combos', () => {
  let db
  let q
  let n = 0
  beforeEach(() => {
    db = new PostmarkDB(`combos-${++n}`)
    q = makeQueries(db)
  })
  afterEach(async () => {
    await db.delete()
  })

  const parts = (...words) => words.map((word) => ({ word, parts: 1 }))

  it('saves a combo for a built-in feeling or a topic', async () => {
    const a = await q.saveCombo({ kind: 'feeling', target: 'sad', parts: parts('rain', 'chai') })
    const b = await q.saveCombo({ kind: 'topic', target: 'exams', parts: parts('rain', 'chai') })
    expect(a.id).not.toBe(b.id)
    expect(a.example).toBe('rain + chai')
    expect((await q.getCombos()).map((c) => c.id).sort()).toEqual([a.id, b.id].sort())
  })

  it('replaces what a set of words meant, in any order', async () => {
    await q.saveCombo({ kind: 'feeling', target: 'sad', parts: parts('rain', 'chai') })
    const again = await q.saveCombo({
      kind: 'feeling',
      target: 'joyful',
      parts: parts('chai', 'rain'),
    })
    const all = await q.getCombos()
    expect(all).toHaveLength(1)
    expect(all[0]).toMatchObject({ id: again.id, target: 'joyful' })
  })

  it('refuses what cannot be taught', async () => {
    const save = (x) =>
      q.saveCombo({ kind: 'feeling', target: 'sad', parts: parts('rain', 'chai'), ...x })
    await expect(save({ kind: 'tint' })).rejects.toThrow(/feeling or a topic/)
    await expect(save({ parts: parts('rain') })).rejects.toThrow(/two to four/)
    await expect(save({ parts: parts('a', 'b', 'c', 'd', 'e') })).rejects.toThrow(/two to four/)
    await expect(save({ parts: parts('rain', 'rain') })).rejects.toThrow(/different/)
    await expect(save({ parts: parts('rain', 'x') })).rejects.toThrow(/cannot be taught/)
    await expect(save({ parts: parts('rain', 'ch4i') })).rejects.toThrow(/cannot be taught/)
    await expect(save({ target: 'nonsense' })).rejects.toThrow(/not a mood or topic/)
    await expect(save({ kind: 'topic', target: 'sad' })).rejects.toThrow(/not a mood or topic/)
    expect(await db.combos.count()).toBe(0)
  })

  it('only teaches a mood of yours that still exists', async () => {
    const m = await q.saveMood({ label: 'Cosy chaos', colors: COLORS })
    await q.saveCombo({ kind: 'feeling', target: m.id, parts: parts('rain', 'chai') })
    await expect(
      q.saveCombo({ kind: 'feeling', target: 'my:ffffffff', parts: parts('mist', 'fog') }),
    ).rejects.toThrow(/no longer exists/)
  })

  it('deleting a mood takes its combos and words with it, and no one else’s', async () => {
    const m = await q.saveMood({ label: 'Cosy chaos', colors: COLORS })
    await q.saveCombo({ kind: 'feeling', target: m.id, parts: parts('rain', 'chai') })
    await q.saveCombo({ kind: 'feeling', target: 'sad', parts: parts('mist', 'fog') })
    await q.teachWords([{ word: 'ghurni', kind: 'feeling', id: m.id, parts: 1 }])
    expect(await q.deleteMood(m.id)).toBe(2)
    expect((await q.getCombos()).map((c) => c.target)).toEqual(['sad'])
    expect(await db.lexicon.count()).toBe(0)
  })

  it('forgetting all words forgets the combos too', async () => {
    await q.saveCombo({ kind: 'feeling', target: 'sad', parts: parts('rain', 'chai') })
    await q.teachWords([{ word: 'ghurni', kind: 'feeling', id: 'sad', parts: 1 }])
    await q.forgetAllWords()
    expect(await db.combos.count()).toBe(0)
    expect(await db.lexicon.count()).toBe(0)
  })

  it('forgets one combo', async () => {
    const c = await q.saveCombo({ kind: 'feeling', target: 'sad', parts: parts('rain', 'chai') })
    await q.deleteCombo(c.id)
    expect(await q.getCombos()).toEqual([])
  })
})
