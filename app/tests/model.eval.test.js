// Scores the note reader against the built-in keyword method on a file of labelled notes.
// Skipped unless you ask for it, so `npm test` never needs the model:
//
//   npm run evaluate:model -- path/to/notes.json
//
// The file is either { "notes": [[text, feeling, topic], ...] } like tests/corpus/*.json, or just
// the list of rows that "Copy them" on the You screen gives you: [[text, feeling, "*"], ...].
// A feeling is one name, a list of acceptable names, or "*".
//
// The head has been trained on every set in tests/corpus/, so scoring one of THOSE is not honest.
// Use notes it has not seen, such as your own corrected notes, kept in tests/corpus/real.json.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { describe as summarise, rankIds, scoreRanked } from '../scripts/model/metrics.mjs'
import { detectMood } from '../src/engine/mood'
import { FEELING_IDS, HEAD, headProbs } from '../src/engine/reader/head'

const file = process.env.EVAL_FILE

describe.skipIf(!file)('the note reader on your notes', () => {
  it('scores both methods', async () => {
    const raw = JSON.parse(readFileSync(file, 'utf8'))
    const notes = Array.isArray(raw) ? raw : raw.notes
    expect(notes.length).toBeGreaterThan(0)

    // loaded here, not at the top: it pulls in the whole Node model runtime, which a normal test
    // run (where this test is skipped) should never pay for
    const { createNodeEmbedder } = await import('../scripts/model/embedder.mjs')
    const embedder = await createNodeEmbedder()
    const vectors = await embedder.embedAll(notes.map((n) => n[0]))

    const reader = (i) => rankIds(headProbs(vectors[i]), HEAD.feelings)
    const words = (i) => {
      const mood = detectMood({ text: notes[i][0], hour: 15, month: 10 })
      return [
        mood.feeling,
        ...mood.scores.feelings.map(([id]) => id).filter((id) => id !== mood.feeling),
      ]
    }
    const a = scoreRanked(notes, reader)
    const b = scoreRanked(notes, words)

    const lines = [
      `notes scored: ${file}`,
      `reader        ${summarise(a)}`,
      `keyword only  ${summarise(b)}`,
      '',
      "where the reader missed (what you wanted, then the reader's top three):",
    ]
    notes.forEach((n, i) => {
      const accepted = Array.isArray(n[1]) ? n[1] : [n[1]]
      if (accepted.includes('*') || accepted.includes(reader(i)[0])) return
      lines.push(`  ${accepted.join('/')}  <-  ${reader(i).slice(0, 3).join(', ')}   | ${n[0]}`)
    })
    const report = lines.join('\n')
    mkdirSync(new URL('../.cache/', import.meta.url), { recursive: true })
    writeFileSync(new URL('../.cache/last-model-eval.txt', import.meta.url), `${report}\n`)
    expect(FEELING_IDS.length).toBe(16)
  }, 600000)
})
