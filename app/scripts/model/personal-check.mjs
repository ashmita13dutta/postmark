// Would adding YOUR corrected notes make the note reader better at reading YOUR notes?
//
//   npm run check:personal -- path/to/real.json          (the file "Copy them" gives you on You)
//   npm run check:personal -- real.json --weights 1,3    how many times each of your notes counts
//   npm run check:personal -- real.json --folds 5
//   npm run check:personal -- real.json --sets dev,dev2     the standard sets to compare against
//
// It is honest by never scoring a note with a head that has seen it: your notes are split into
// folds, and each fold is read by a head trained on the standard corpus plus the OTHER folds. That
// is compared with the head as it ships now (the standard corpus only). Nothing is written. If it
// says your notes help, train for real with `npm run train:head -- --real <file> --real-weight N`.
//
// Needs the model (`npm run model`).
import { dirname, join, resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createNodeEmbedder } from './embedder.mjs'
import { folds, predict, train } from './lr.mjs'
import { describe, rankIds, scoreRanked } from './metrics.mjs'
import { parseNotes, readNotesFile, softRows } from './real.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`)
  return i === -1 ? fallback : (process.argv[i + 1] ?? fallback)
}
const target = process.argv[2]
if (!target || target.startsWith('--')) {
  console.log('Give your notes:  npm run check:personal -- path/to/real.json')
  console.log('(use "Copy them" on the You screen, and save what it copies as a .json file)')
  process.exit(1)
}

const SETS = arg('sets', 'dev,dev2,dev3,dev4,fresh4,fresh5').split(',')
const MIN_NOTES = 20
const k = Math.max(2, Math.round(Number(arg('folds', 5))))
const weights = arg('weights', '1,3')
  .split(',')
  .map((w) => Math.max(1, Math.round(Number(w))))
const lambda = 0.3
const feelingIds = Object.keys(
  JSON.parse(readFileSync(join(root, 'src/data/feelings.json'), 'utf8')).feelings,
)

const corpus = []
for (const set of SETS) {
  const file = JSON.parse(readFileSync(join(root, 'tests/corpus', `${set}.json`), 'utf8'))
  corpus.push(...parseNotes(file, feelingIds).notes)
}
const { notes: all, skipped } = readNotesFile(resolve(process.cwd(), target), feelingIds)
// a note that accepts anything has no right answer to be scored against
const mine = all.filter((n) => n[1] !== '*' && !(Array.isArray(n[1]) && n[1].includes('*')))
console.log(
  `${mine.length} of your notes${skipped ? ` (${skipped} rows skipped)` : ''}; ${corpus.length} standard notes`,
)
if (mine.length < MIN_NOTES) {
  console.log(
    `\nThat is too few to say anything honest. Come back with at least ${MIN_NOTES}, ideally 40 or more.`,
  )
  process.exit(0)
}

const embedder = await createNodeEmbedder()
const baseRows = softRows(corpus, await embedder.embedAll(corpus.map((n) => n[0])), feelingIds).rows
const myVectors = await embedder.embedAll(mine.map((n) => n[0]))

const rankedBy = (probsOf) => (i) => rankIds(probsOf(i), feelingIds)

// as it ships now: the standard corpus only
const now = train(baseRows, { lambda })
const scoreNow = scoreRanked(
  mine,
  rankedBy((i) => predict(now, myVectors[i])),
)

// with your notes: every note is read by a head that never saw it
const results = weights.map((w) => {
  const probs = new Array(mine.length)
  for (const held of folds(mine.length, k)) {
    const skip = new Set(held)
    const keep = mine.map((_, i) => i).filter((i) => !skip.has(i))
    const extra = softRows(
      keep.map((i) => mine[i]),
      keep.map((i) => myVectors[i]),
      feelingIds,
      w,
    ).rows
    const model = train([...baseRows, ...extra], { lambda })
    for (const i of held) probs[i] = predict(model, myVectors[i])
  }
  return {
    w,
    score: scoreRanked(
      mine,
      rankedBy((i) => probs[i]),
    ),
  }
})

console.log(`\nHow the reader reads notes it has not seen (${k}-fold, ${mine.length} notes):`)
console.log(`  as it is now           ${describe(scoreNow)}`)
for (const { w, score } of results)
  console.log(`  + your notes, x${String(w).padEnd(2)}      ${describe(score)}`)

// one fold's worth of luck: with this few notes, small differences mean nothing
const pct = (c) => (100 * c) / mine.length
const noise = Math.max(1, Math.round(50 / Math.sqrt(mine.length)))
const best = results.reduce((a, b) => (b.score.exact > a.score.exact ? b : a))
const gain = pct(best.score.exact) - pct(scoreNow.exact)
const flipsWorse = best.score.flips > scoreNow.flips
console.log(`\nWith ${mine.length} notes, differences under about ${noise} points could be luck.`)
if (gain > noise && !flipsWorse) {
  console.log(
    `Your notes help: about +${gain.toFixed(0)} points exact at x${best.w}. Worth training:\n` +
      `  npm run train:head -- --real ${target} --real-weight ${best.w}`,
  )
} else {
  console.log(
    gain > 0 && !flipsWorse
      ? `A small gain (+${gain.toFixed(0)} points at x${best.w}), not clearly more than luck. Keep the current reader, and check again with more notes.`
      : 'Your notes do not clearly help yet. Keep the current reader, and check again with more notes.',
  )
}
