// Accuracy of the mood engine on realistic notes.
//   npm run evaluate     prints the score and every miss
//
// Each set is a list of [note, feeling, topic]. A label is one answer, a list of acceptable
// answers, or "*" (anything is fine). The dev sets are what we tune against. A held-out set is
// written fresh, checked ONCE for an honest score, and then folded into the dev sets, because
// tuning on a set always flatters its score. See tests/corpus/*.json for each set's history.
import { writeFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import dev from './corpus/dev.json'
import dev2 from './corpus/dev2.json'
import dev3 from './corpus/dev3.json'
import dev4 from './corpus/dev4.json'
import { detectMood } from '../src/engine/mood'

const NOON = { hour: 15, month: 10 }

// How a feeling reads in color. A "flip" is a positive note getting a negative palette or the
// reverse: the mistake that really ruins a stamp. Content vs peaceful hardly matters.
const POLARITY = {
  joyful: 1,
  excited: 1,
  proud: 1,
  loving: 1,
  grateful: 1,
  inspired: 1,
  content: 0,
  peaceful: 0,
  dreamy: 0,
  nostalgic: 0,
  sad: -1,
  angry: -1,
  anxious: -1,
  disappointed: -1,
  tired: -1,
  bored: -1,
}
const isFlip = (expected, actual) => {
  if (expected === '*') return false
  const options = Array.isArray(expected) ? expected : [expected]
  if (options.includes('*')) return false
  const got = POLARITY[actual]
  return got !== 0 && options.every((o) => POLARITY[o] === -got)
}
// "feels right": the same kind of feeling (positive / neutral / negative) as an accepted answer.
const feelsRight = (expected, actual) => {
  if (expected === '*') return true
  const options = Array.isArray(expected) ? expected : [expected]
  return options.includes('*') || options.some((o) => POLARITY[o] === POLARITY[actual])
}
const accepts = (expected, actual) =>
  expected === '*' ||
  (Array.isArray(expected)
    ? expected.includes('*') || expected.includes(actual)
    : expected === actual)

export function score(notes) {
  const misses = []
  let feeling = 0
  let topic = 0
  let both = 0
  let flips = 0
  let right = 0
  for (const [text, wantFeeling, wantTopic] of notes) {
    const r = detectMood({ text, ...NOON })
    const okF = accepts(wantFeeling, r.feeling)
    const okT = accepts(wantTopic, r.topic) || accepts(wantTopic, r.secondaryTopic)
    if (okF) feeling++
    if (okT) topic++
    if (okF && okT) both++
    const flipped = !okF && isFlip(wantFeeling, r.feeling)
    if (flipped) flips++
    if (feelsRight(wantFeeling, r.feeling)) right++
    if (!okF || !okT) {
      misses.push(
        `${flipped ? 'FLIP ' : okF ? '     ' : 'F✗   '}${okT ? '   ' : 'T✗ '} got ${r.feeling}/${r.topic}  want ${JSON.stringify(wantFeeling)}/${JSON.stringify(wantTopic)}  | ${text}`,
      )
    }
  }
  const n = notes.length
  const pct = (x) => `${((100 * x) / n).toFixed(1)}%`
  return {
    n,
    feeling,
    topic,
    both,
    flips,
    right,
    summary: `feels-right ${pct(right)}  flips ${pct(flips)}  feeling ${pct(feeling)}  topic ${pct(topic)}  both ${pct(both)}  (${n} notes)`,
    misses,
  }
}

const sets = { dev: dev.notes, dev2: dev2.notes, dev3: dev3.notes, dev4: dev4.notes }
const all = Object.values(sets).flat()

describe('mood engine accuracy on realistic notes', () => {
  const results = Object.fromEntries(Object.entries(sets).map(([k, notes]) => [k, score(notes)]))
  const total = score(all)

  it('reports the score', () => {
    // written to a file too, because test output is hidden when everything passes
    const lines = Object.entries(results).map(([k, r]) => `${k}: ${r.summary}`)
    const misses = Object.values(results).flatMap((r) => r.misses)
    writeFileSync(
      new URL('./corpus/.last-run.txt', import.meta.url),
      `${lines.join('\n')}\nALL: ${total.summary}\n${misses.join('\n')}\n`,
    )
    expect(total.n).toBeGreaterThan(400)
  })

  // These floors only go up. If a change drops below one, the change made things worse.
  // (Feeling floor went 0.92 -> 0.91 when the harder dev4 set joined; dev1-3 alone are above 0.92.)
  const lines = (misses) => misses.join('\n')
  it('feeling accuracy stays above the floor', () => {
    expect(total.feeling / total.n, lines(total.misses)).toBeGreaterThanOrEqual(0.91)
  })
  it('topic accuracy stays above the floor', () => {
    expect(total.topic / total.n, lines(total.misses)).toBeGreaterThanOrEqual(0.95)
  })
  it('"feels right" (positive / neutral / negative) stays above the floor', () => {
    expect(total.right / total.n, lines(total.misses)).toBeGreaterThanOrEqual(0.95)
  })
  it('no flips: a positive note never gets a negative palette, or the reverse', () => {
    expect(total.flips, lines(total.misses.filter((m) => m.startsWith('FLIP')))).toBe(0)
  })
})
