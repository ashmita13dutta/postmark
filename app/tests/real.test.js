import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { feelings } from '../src/data/feelings.json'
import { parseNotes, readNotesFile, softRows } from '../scripts/model/real.mjs'

const ids = Object.keys(feelings)

describe('parseNotes', () => {
  it('reads the list that "Copy them" on You gives', () => {
    const { notes, skipped } = parseNotes(
      [
        ['Maa called, I miss home today', 'sad', '*'],
        ['Rain, chai and a good book', 'peaceful', '*'],
      ],
      ids,
    )
    expect(notes).toEqual([
      ['Maa called, I miss home today', 'sad', '*'],
      ['Rain, chai and a good book', 'peaceful', '*'],
    ])
    expect(skipped).toBe(0)
  })

  it('reads the format of the files in tests/corpus', () => {
    const { notes } = parseNotes(
      { notes: [['Finished the viva!', ['joyful', 'proud'], 'exams']] },
      ids,
    )
    expect(notes).toEqual([['Finished the viva!', ['joyful', 'proud'], 'exams']])
  })

  it('accepts "*" as a feeling and fills in a missing topic', () => {
    expect(parseNotes([['Anything goes', '*']], ids).notes).toEqual([['Anything goes', '*', '*']])
  })

  it('trims the text and leaves out rows that are not right, counting them', () => {
    const { notes, skipped } = parseNotes(
      [
        ['  padded  ', 'sad', '*'],
        ['', 'sad', '*'],
        ['   ', 'sad', '*'],
        ['unknown feeling', 'ecstatic', '*'],
        ['a mood of yours', 'my:ab12cd34', '*'],
        ['mixed list', ['sad', 'nope'], '*'],
        [42, 'sad', '*'],
        'not a row',
        null,
      ],
      ids,
    )
    expect(notes).toEqual([['padded', 'sad', '*']])
    expect(skipped).toBe(8)
  })

  it('copes with an empty or odd file', () => {
    expect(parseNotes([], ids)).toEqual({ notes: [], skipped: 0 })
    expect(parseNotes({}, ids)).toEqual({ notes: [], skipped: 0 })
    expect(parseNotes(undefined, ids)).toEqual({ notes: [], skipped: 0 })
  })
})

describe('readNotesFile', () => {
  const dir = mkdtempSync(join(tmpdir(), 'postmark-real-'))
  afterAll(() => rmSync(dir, { recursive: true, force: true }))

  it('reads a file from disk', () => {
    const file = join(dir, 'real.json')
    writeFileSync(file, JSON.stringify([['A note', 'content', '*']]))
    expect(readNotesFile(file, ids).notes).toEqual([['A note', 'content', '*']])
  })
})

describe('softRows', () => {
  const idx = (f) => ids.indexOf(f)
  const vec = (n) => [n, n + 1]

  it('makes one row per note, with all the weight on the feeling', () => {
    const { rows, used } = softRows([['a', 'sad', '*']], [vec(1)], ids)
    expect(rows).toHaveLength(1)
    expect(rows[0].x).toEqual(vec(1))
    expect(rows[0].y[idx('sad')]).toBe(1)
    expect(rows[0].y.reduce((a, b) => a + b, 0)).toBe(1)
    expect(used).toHaveLength(1)
  })

  it('shares the weight between several accepted feelings', () => {
    const { rows } = softRows([['a', ['sad', 'tired', 'bored', 'angry'], '*']], [vec(1)], ids)
    expect(rows[0].y[idx('sad')]).toBeCloseTo(0.25)
    expect(rows[0].y[idx('angry')]).toBeCloseTo(0.25)
    expect(rows[0].y.reduce((a, b) => a + b, 0)).toBeCloseTo(1)
  })

  it('leaves out notes that accept any feeling, and keeps the vectors lined up', () => {
    const { rows, used } = softRows(
      [
        ['skip me', '*', '*'],
        ['keep me', 'joyful', '*'],
        ['skip too', ['sad', '*'], '*'],
      ],
      [vec(1), vec(2), vec(3)],
      ids,
    )
    expect(used.map((n) => n[0])).toEqual(['keep me'])
    expect(rows).toHaveLength(1)
    expect(rows[0].x).toEqual(vec(2))
  })

  it('counts a note as many times as asked', () => {
    const { rows, used } = softRows([['a', 'sad', '*']], [vec(1)], ids, 3)
    expect(rows).toHaveLength(3)
    expect(used).toHaveLength(1) // still one note
  })
})
