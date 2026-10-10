import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { feelings } from '../src/data/feelings.json'
import { makeQueries } from '../src/db/queries'
import { PostmarkDB } from '../src/db/schema'
import { buildLexicon, detectMood } from '../src/engine/mood'
import {
  MAX_LABEL,
  MAX_MOODS,
  buildMoods,
  cleanMood,
  isMyMood,
  moodBuilt,
  moodLabel,
} from '../src/engine/moods'
import { HEAD } from '../src/engine/reader/head'
import { readNote } from '../src/engine/readNote'
import { entriesFromSelection, teachableTokens } from '../src/engine/teach'

const base = { day: '2026-10-08', hour: 15, month: 10 }
const COLORS = ['#2A3B4C', '#5B7FA3', '#C9A66B', '#E8D8B4', '#F6EFE0']
const row = (extra = {}) => ({
  id: 'my:ab12cd34',
  label: 'Wandering',
  colors: COLORS.map((hex) => ({ hex, name: 'x' })),
  createdAt: 1,
  ...extra,
})
const word = (w, id = 'my:ab12cd34', extra = {}) => ({
  word: w,
  kind: 'feeling',
  id,
  parts: 1,
  ...extra,
})

describe('buildMoods and labels', () => {
  it('keeps good rows, uppercases colors, and skips rows that are not right', () => {
    const moods = buildMoods([
      row({ colors: COLORS.map((hex) => ({ hex: hex.toLowerCase(), name: 'n' })) }),
      row({ id: 'joyful' }), // not one of yours
      row({ id: 'my:nolabel', label: '' }),
      row({ id: 'my:four', colors: COLORS.slice(0, 4).map((hex) => ({ hex, name: 'n' })) }),
      row({ id: 'my:badhex', colors: ['#12', ...COLORS.slice(1)].map((hex) => ({ hex })) }),
    ])
    expect([...moods.keys()]).toEqual(['my:ab12cd34'])
    expect(moods.get('my:ab12cd34').colors[0].hex).toBe('#2A3B4C')
  })

  it('recognises your ids and never mistakes a built-in feeling for one', () => {
    expect(isMyMood('my:ab12cd34')).toBe(true)
    expect(Object.keys(feelings).some(isMyMood)).toBe(false)
    expect(isMyMood(undefined)).toBe(false)
  })

  it('shows a built-in name, one of yours, or a plain fallback', () => {
    const moods = buildMoods([row()])
    expect(moodLabel('joyful', moods)).toBe('Joyful')
    expect(moodLabel('my:ab12cd34', moods)).toBe('Wandering')
    expect(moodLabel('my:deleted', moods)).toBe('A mood you made')
  })
})

describe('cleanMood', () => {
  const mine = buildMoods([row()])

  it('tidies the name and names the five colors', () => {
    const m = cleanMood({ label: '  Rainy   chai  ', colors: COLORS.map((c) => c.toLowerCase()) })
    expect(m.label).toBe('Rainy chai')
    expect(m.colors.map((c) => c.hex)).toEqual(COLORS)
    expect(m.colors.every((c) => c.name)).toBe(true)
    expect(new Set(m.colors.map((c) => c.name)).size).toBe(5)
  })

  it('explains what is wrong with the name', () => {
    expect(() => cleanMood({ label: '  ', colors: COLORS })).toThrow(/name/)
    expect(() => cleanMood({ label: 'x'.repeat(MAX_LABEL + 1), colors: COLORS })).toThrow(/up to/)
    expect(() => cleanMood({ label: 'joyful', colors: COLORS })).toThrow(/built-in/)
    expect(() => cleanMood({ label: 'wandering', colors: COLORS }, mine)).toThrow(/already have/)
  })

  it('lets a mood keep its own name when it is edited', () => {
    expect(cleanMood({ label: 'Wandering', colors: COLORS }, mine, 'my:ab12cd34').label).toBe(
      'Wandering',
    )
  })

  it('needs exactly five valid colors', () => {
    expect(() => cleanMood({ label: 'Calm-ish', colors: COLORS.slice(0, 4) })).toThrow(/5 colors/)
    expect(() => cleanMood({ label: 'Calm-ish', colors: [...COLORS.slice(1), 'blue'] })).toThrow(
      /5 colors/,
    )
  })
})

describe('reading a note with a mood of yours', () => {
  const moods = buildMoods([row()])
  const lexicon = buildLexicon([word('ghurni')], moods)

  it('only knows words taught to a mood that exists', () => {
    expect(detectMood({ text: 'ghurni all day', ...base, lexicon }).feeling).toBe('my:ab12cd34')
    const without = buildLexicon([word('ghurni')]) // the mood was deleted
    expect(detectMood({ text: 'ghurni all day', ...base, lexicon: without }).feeling).not.toBe(
      'my:ab12cd34',
    )
  })

  it('makes your mood the reading, with exactly your five colors', () => {
    const r = readNote({ ...base, text: 'ghurni all day', lexicon, moods })
    expect(r.feeling).toBe('my:ab12cd34')
    expect(r.guess).toMatchObject({ feeling: 'my:ab12cd34', source: 'mine' })
    expect(r.guess.ranked[0].id).toBe('my:ab12cd34')
    expect(r.built.colors.map((c) => c.hex)).toEqual(COLORS)
    expect(r.built.mine).toBe(true)
    expect(r.energy).toBe('soft')
    expect(r.corrected.feeling).toBe(false)
  })

  it('gives the same colors on any day, hour or month', () => {
    const a = readNote({ ...base, text: 'ghurni all day', lexicon, moods })
    const b = readNote({
      ...base,
      day: '2027-02-14',
      hour: 2,
      month: 2,
      text: 'ghurni',
      lexicon,
      moods,
    })
    expect(b.built.colors).toEqual(a.built.colors)
  })

  it('beats the reader, which has never heard of it', () => {
    const probs = HEAD.feelings.map((f) => (f === 'sad' ? 0.9 : 0.1 / (HEAD.feelings.length - 1)))
    const reader = { vector: Array.from({ length: HEAD.dim }, (_, i) => (i === 3 ? 1 : 0)), probs }
    const r = readNote({ ...base, text: 'ghurni all day', lexicon, moods, reader })
    expect(r.guess.source).toBe('mine')
    expect(r.feeling).toBe('my:ab12cd34')
    // the reader's own favorites are still there to choose from
    expect(r.guess.ranked.map((a) => a.id)).toContain('sad')
  })

  it('loses to much stronger built-in feeling words in the same note', () => {
    const r = readNote({
      ...base,
      text: 'ghurni, but then I got the offer and I was so happy, thrilled and joyful!',
      lexicon,
      moods,
    })
    expect(r.feeling).toBe('joyful')
    expect(r.built.mine).toBeUndefined()
  })

  it('can be chosen by hand, and an unknown or deleted one is ignored', () => {
    const picked = readNote({
      ...base,
      text: 'a plain walk home',
      moods,
      override: { feeling: 'my:ab12cd34' },
    })
    expect(picked.feeling).toBe('my:ab12cd34')
    expect(picked.corrected.feeling).toBe(true)
    expect(picked.built.colors.map((c) => c.hex)).toEqual(COLORS)

    const gone = readNote({
      ...base,
      text: 'a plain walk home',
      override: { feeling: 'my:ab12cd34' },
    })
    expect(gone.feeling).toBe(gone.guess.feeling)
    expect(feelings[gone.feeling]).toBeTruthy()
  })

  it('leaves notes without a mood of yours exactly as they were', () => {
    const text = 'So happy today, shopping with Riya!'
    const plain = readNote({ ...base, text })
    const withMoods = readNote({ ...base, text, lexicon, moods })
    expect(withMoods.feeling).toBe(plain.feeling)
    expect(withMoods.built.colors).toEqual(plain.built.colors)
  })

  it('moodBuilt copies the colors so editing the stamp never edits the mood', () => {
    const mood = moods.get('my:ab12cd34')
    const built = moodBuilt(mood)
    built.colors[0].hex = '#000000'
    expect(mood.colors[0].hex).toBe('#2A3B4C')
  })
})

describe('teaching words to a mood of yours', () => {
  const moods = buildMoods([row()])

  it('turns the words you tap into entries for that mood', () => {
    const tokens = teachableTokens('ghurni bhalo lagche', new Map())
    const entries = entriesFromSelection(tokens, [0, 1, 2], 'feeling', 'my:ab12cd34', moods)
    expect(entries).toEqual([
      {
        word: 'ghurnibhalolagche',
        kind: 'feeling',
        id: 'my:ab12cd34',
        parts: 3,
        example: 'ghurni bhalo lagche',
      },
    ])
  })

  it('refuses a mood that is not there', () => {
    const tokens = teachableTokens('ghurni', new Map())
    expect(() => entriesFromSelection(tokens, [0], 'feeling', 'my:ab12cd34')).toThrow(/Unknown/)
  })
})

describe('saving moods', () => {
  let db
  let q
  let n = 0
  beforeEach(() => {
    db = new PostmarkDB(`moods-${++n}`)
    q = makeQueries(db)
  })
  afterEach(async () => {
    await db.delete()
  })

  const input = (label = 'Wandering') => ({ label, colors: COLORS })

  it('makes a mood with an id of its own, tidy colors and names', async () => {
    const m = await q.saveMood(input())
    expect(m.id).toMatch(/^my:[0-9a-f]{8}$/)
    expect(m.colors).toHaveLength(5)
    expect((await q.getMoods()).map((x) => x.label)).toEqual(['Wandering'])
    expect(buildMoods(await q.getMoods()).has(m.id)).toBe(true)
  })

  it('refuses a clash with a built-in name, or a second one with the same name', async () => {
    await expect(q.saveMood(input('Sad'))).rejects.toThrow(/built-in/)
    await q.saveMood(input())
    await expect(q.saveMood(input('wandering'))).rejects.toThrow(/already have/)
    expect(await db.moods.count()).toBe(1)
  })

  it('changes a mood in place and keeps its words', async () => {
    const m = await q.saveMood(input())
    await q.teachWords([word('ghurni', m.id)])
    const renamed = await q.saveMood({
      id: m.id,
      label: 'Drifting',
      colors: COLORS.slice().reverse(),
    })
    expect(renamed).toMatchObject({ id: m.id, createdAt: m.createdAt, label: 'Drifting' })
    expect(renamed.colors[0].hex).toBe(COLORS[4])
    expect(await db.moods.count()).toBe(1)
    expect(await db.lexicon.count()).toBe(1)
    await expect(q.saveMood({ id: 'my:nope', ...input('Other') })).rejects.toThrow(/no longer/)
  })

  it('stops at the limit', async () => {
    for (let i = 0; i < MAX_MOODS; i++) await q.saveMood(input(`Mood ${i}`))
    await expect(q.saveMood(input('One too many'))).rejects.toThrow(/up to/)
  })

  it('teaches words to a mood, and not to one that is gone', async () => {
    const m = await q.saveMood(input())
    const saved = await q.teachWords([word('ghurni', m.id)])
    expect(saved).toHaveLength(1)
    await expect(q.teachWords([word('ghurni', 'my:ffffffff')])).rejects.toThrow(/no longer exists/)
    expect(await db.lexicon.count()).toBe(1)
  })

  it('deleting a mood takes its words with it and leaves every other word alone', async () => {
    const a = await q.saveMood(input('Wandering'))
    const b = await q.saveMood(input('Cosy chaos'))
    await q.teachWords([
      word('ghurni', a.id),
      word('adda', a.id),
      word('bhalo', b.id),
      word('bekaar', 'bored'),
      { word: 'rickshaw', kind: 'topic', id: 'travel', parts: 1 },
    ])
    expect(await q.deleteMood(a.id)).toBe(2)
    expect((await q.getMoods()).map((x) => x.id)).toEqual([b.id])
    expect((await q.getLexicon()).map((w) => w.word).sort()).toEqual([
      'bekaar',
      'bhalo',
      'rickshaw',
    ])
  })

  it('a postcard keeps its colors when its mood is deleted', async () => {
    const m = await q.saveMood(input())
    const moods = buildMoods(await q.getMoods())
    const r = readNote({ ...base, text: 'x', moods, override: { feeling: m.id } })
    const card = await q.saveMoment('2026-10-08', {
      note: 'x',
      feeling: r.feeling,
      topic: r.topic,
      palette: r.built.colors,
    })
    await q.deleteMood(m.id)
    const kept = await q.getMoment(card.id)
    expect(kept.feeling).toBe(m.id)
    expect(kept.palette.map((c) => c.hex)).toEqual(COLORS)
    expect(moodLabel(kept.feeling, buildMoods(await q.getMoods()))).toBe('A mood you made')
  })
})
