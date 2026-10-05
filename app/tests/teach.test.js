import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { makeQueries } from '../src/db/queries'
import { PostmarkDB } from '../src/db/schema'
import { buildLexicon, detectMood } from '../src/engine/mood'
import { entriesFromSelection, suggestSelection, teachableTokens } from '../src/engine/teach'
import { setNow } from '../src/lib/clock'

const ctx = { hour: 15, month: 10 }
const mood = (text, lexicon) => detectMood({ text, ...ctx, lexicon })

describe('teaching the engine: the personal lexicon', () => {
  it('a taught word changes how a note is read', () => {
    const note = 'The seminar was absolute chaplaincy'
    expect(mood(note).feeling).not.toBe('bored')
    const lexicon = [{ word: 'chaplaincy', kind: 'feeling', id: 'bored', parts: 1 }]
    const r = mood(note, lexicon)
    expect(r.feeling).toBe('bored')
    expect(r.taught).toEqual(['chaplaincy'])
    expect(r.source.feeling).toBe('words')
  })

  it('a taught word beats the built-in meaning', () => {
    // "quiet" is built in as peaceful; this person means something sadder by it
    expect(mood('so quiet today').feeling).toBe('peaceful')
    const lexicon = [{ word: 'quiet', kind: 'feeling', id: 'sad', parts: 1 }]
    expect(mood('so quiet today', lexicon).feeling).toBe('sad')
  })

  it('a taught phrase works, and wins over the single words inside it', () => {
    const lexicon = [{ word: 'passedaway', kind: 'feeling', id: 'sad', parts: 2 }]
    const r = mood('Grandpa passed away last night', lexicon)
    expect(r.feeling).toBe('sad')
    expect(r.taught).toEqual(['passed away'])
  })

  it('a taught word also matches its usual forms, but a single word only', () => {
    const lexicon = [{ word: 'zonk', kind: 'feeling', id: 'tired', parts: 1 }]
    expect(mood('feeling zonked', lexicon).feeling).toBe('tired')
    expect(mood('so much zonking', lexicon).feeling).toBe('tired')
    const phrase = buildLexicon([{ word: 'passedaway', kind: 'feeling', id: 'sad', parts: 2 }])
    expect(phrase.has('passedaways')).toBe(false)
  })

  it('a form you taught exactly is not overwritten by the form of another word', () => {
    const lexicon = buildLexicon([
      { word: 'cook', kind: 'topic', id: 'cooking', parts: 1 },
      { word: 'cooked', kind: 'feeling', id: 'proud', parts: 1 },
    ])
    expect(lexicon.get('cooked').id).toBe('proud')
    expect(lexicon.get('cooking').id).toBe('cooking') // a form of "cook"
  })

  it('a taught topic word sets the topic', () => {
    const r = mood('long afternoon with my gizmo', [
      { word: 'gizmo', kind: 'topic', id: 'tech', parts: 1 },
    ])
    expect(r.topic).toBe('tech')
    expect(r.topicWords).toContain('gizmo')
  })

  it('negation still applies to taught words', () => {
    const lexicon = [{ word: 'zesty', kind: 'feeling', id: 'joyful', parts: 1 }]
    expect(mood('I felt zesty', lexicon).feeling).toBe('joyful')
    expect(mood('I did not feel zesty', lexicon).feeling).toBe('disappointed')
  })

  it('ignores bad entries instead of breaking', () => {
    const lexicon = [
      { word: 'nope', kind: 'feeling', id: 'not-a-feeling', parts: 1 },
      { word: '', kind: 'feeling', id: 'sad' },
      null,
      { word: 'fine', kind: 'topic', id: 'also-not-real' },
    ]
    expect(() => mood('a fine day', lexicon)).not.toThrow()
    expect(buildLexicon(lexicon).size).toBe(0)
  })

  it('an empty or missing lexicon changes nothing', () => {
    const note = 'Rain at Elgin crossing, taxi would not start'
    expect(mood(note, [])).toEqual(mood(note))
    expect(mood(note).taught).toEqual([])
  })

  it('accepts a prebuilt lexicon (what the app passes)', () => {
    const lex = buildLexicon([{ word: 'chaplaincy', kind: 'feeling', id: 'bored', parts: 1 }])
    expect(mood('absolute chaplaincy', lex).feeling).toBe('bored')
  })
})

describe('teachableTokens / suggestSelection / entriesFromSelection', () => {
  const note = "Aaj I had a soft skills class. Itna bekaar. Didn't enjoy it!"
  const tokens = teachableTokens(note)

  it('splits a note into words as typed, with sentences, and flags what is already known', () => {
    expect(tokens.map((t) => t.text)).toEqual([
      'Aaj',
      'I',
      'had',
      'a',
      'soft',
      'skills',
      'class',
      'Itna',
      'bekaar',
      "Didn't",
      'enjoy',
      'it',
    ])
    const by = Object.fromEntries(tokens.map((t) => [t.word, t]))
    expect(by.bekaar.recognized).toBe(true) // built in (bored)
    expect(by.skills.recognized).toBe(true) // a learning word
    expect(by.itna.recognized).toBe(true) // a known intensifier
    expect(by.didnt.word).toBe('didnt')
    expect(by.i.stop).toBe(true)
    expect(by.aaj.stop).toBe(true)
    expect(by.bekaar.sentence).toBeGreaterThan(by.class.sentence)
  })

  it('suggests only words that are unknown and not filler', () => {
    const t = teachableTokens('Aaj the seminar was absolutely chaplaincy bhai')
    const words = suggestSelection(t).map((i) => t[i].word)
    expect(words).toEqual(
      ['seminar', 'absolutely', 'chaplaincy', 'bhai'].filter((w) => words.includes(w)),
    )
    expect(words).toContain('chaplaincy')
    expect(words).not.toContain('the')
    expect(words).not.toContain('aaj')
  })

  it('a taught word stops being suggested', () => {
    const lex = buildLexicon([{ word: 'chaplaincy', kind: 'feeling', id: 'bored', parts: 1 }])
    const t = teachableTokens('absolute chaplaincy', lex)
    expect(t.find((x) => x.word === 'chaplaincy').recognized).toBe(true)
  })

  it('single taps become words; neighbours in one sentence become a phrase', () => {
    const t = teachableTokens('He passed away. It was so sad')
    const idx = (w) => t.find((x) => x.word === w).index
    const entries = entriesFromSelection(
      t,
      [idx('passed'), idx('away'), idx('sad')],
      'feeling',
      'sad',
    )
    expect(entries.map((e) => [e.word, e.parts])).toEqual([
      ['passedaway', 2],
      ['sad', 1],
    ])
    expect(entries[0].example).toBe('passed away')
  })

  it('words either side of a full stop are not joined', () => {
    const t = teachableTokens('gone. alone')
    const entries = entriesFromSelection(t, [0, 1], 'feeling', 'sad')
    expect(entries.map((e) => e.word)).toEqual(['gone', 'alone'])
  })

  it('a lone filler word is skipped, but filler inside a phrase is kept', () => {
    const t = teachableTokens('that took me back')
    const idx = (w) => t.find((x) => x.word === w).index
    expect(entriesFromSelection(t, [idx('that')], 'feeling', 'nostalgic')).toEqual([])
    const phrase = entriesFromSelection(
      t,
      [idx('took'), idx('me'), idx('back')],
      'feeling',
      'nostalgic',
    )
    expect(phrase.map((e) => e.word)).toEqual(['tookmeback'])
  })

  it('caps a phrase at five words and rejects an unknown feeling or topic', () => {
    const t = teachableTokens('one two three four five six seven')
    const entries = entriesFromSelection(t, [0, 1, 2, 3, 4, 5, 6], 'feeling', 'sad')
    expect(entries.map((e) => e.parts)).toEqual([5, 2])
    expect(() => entriesFromSelection(t, [0], 'feeling', 'nope')).toThrow('Unknown feeling')
    expect(() => entriesFromSelection(t, [0], 'topic', 'nope')).toThrow('Unknown topic')
  })

  it('teaching from a tapped note fixes that note, end to end', () => {
    const note = 'Dadu left us at dawn and the house feels hollowed out'
    const t = teachableTokens(note)
    const sel = t.filter((x) => ['dadu', 'left', 'us'].includes(x.word)).map((x) => x.index)
    const entries = entriesFromSelection(t, sel, 'feeling', 'sad')
    expect(mood(note, entries).feeling).toBe('sad')
  })
})

let db
let q
let n = 0

describe('saving taught words', () => {
  beforeEach(() => {
    db = new PostmarkDB(`teach-${++n}`)
    q = makeQueries(db)
    setNow(new Date(2026, 9, 5, 12, 0).getTime())
  })
  afterEach(async () => {
    setNow(null)
    await db.delete()
  })

  const entry = (word, id = 'bored', extra = {}) => ({
    word,
    kind: 'feeling',
    id,
    parts: 1,
    ...extra,
  })

  it('saves, lists newest first, and the engine can use the saved list', async () => {
    await q.teachWords([entry('bekaarish')])
    setNow(new Date(2026, 9, 5, 13, 0).getTime())
    await q.teachWords([entry('zonk', 'tired', { example: 'zonk' })])
    const list = await q.getLexicon()
    expect(list.map((e) => e.word)).toEqual(['zonk', 'bekaarish'])
    expect(mood('what a bekaarish evening', list).feeling).toBe('bored')
  })

  it('teaching a word again replaces what it meant (a correction wins)', async () => {
    await q.teachWords([entry('quiet', 'peaceful')])
    await q.teachWords([entry('quiet', 'sad')])
    const list = await q.getLexicon()
    expect(list).toHaveLength(1)
    expect(list[0].id).toBe('sad')
  })

  it('forgets one word or all of them', async () => {
    await q.teachWords([entry('aaa'), entry('bbb'), entry('ccc')])
    await q.forgetWord('bbb')
    expect((await q.getLexicon()).map((e) => e.word).sort()).toEqual(['aaa', 'ccc'])
    await q.forgetAllWords()
    expect(await q.getLexicon()).toEqual([])
  })

  it('refuses malformed entries instead of storing junk', async () => {
    const saved = await q.teachWords([
      entry('ok'),
      { word: 'two words', kind: 'feeling', id: 'sad' },
      { word: 'x', kind: 'feeling', id: 'sad' },
      { word: 'digits123', kind: 'feeling', id: 'sad' },
      { word: 'nokind', kind: 'mood', id: 'sad' },
      { word: 'noid', kind: 'feeling' },
    ])
    expect(saved.map((e) => e.word)).toEqual(['ok'])
    expect(await q.teachWords([])).toEqual([])
  })

  it('stops at a sensible limit', async () => {
    const big = Array.from({ length: 3001 }, (_, i) =>
      entry(`w${String.fromCharCode(97 + (i % 26))}${'q'.repeat(1 + Math.floor(i / 26))}`),
    )
    await expect(q.teachWords(big)).rejects.toThrow('full')
    expect(await q.getLexicon()).toEqual([])
  })
})

describe('upgrading an existing database to schema v2', () => {
  it('keeps the stamps people already have and adds the lexicon table', async () => {
    const name = `upgrade-${++n}`
    // a phone that installed the app when it was version 1
    const old = new Dexie(name)
    old.version(1).stores({ moments: 'id, &day, stampNo, sealedUntil, openedAt', settings: 'key' })
    await old
      .table('moments')
      .add({ id: 'm1', day: '2026-09-24', stampNo: 1, note: 'kept', sealedUntil: 1 })
    await old.table('settings').put({ key: 'homeCity', value: 'Kolkata' })
    old.close()

    // the new app opens it
    const upgraded = new PostmarkDB(name)
    await upgraded.open()
    expect((await upgraded.moments.get('m1')).note).toBe('kept')
    expect((await upgraded.settings.get('homeCity')).value).toBe('Kolkata')
    await upgraded.lexicon.put({
      word: 'hello',
      kind: 'feeling',
      id: 'joyful',
      parts: 1,
      createdAt: 1,
    })
    expect(await upgraded.lexicon.count()).toBe(1)
    await upgraded.delete()
  })
})
