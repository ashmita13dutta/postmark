// Scores a feeling classifier the same way tests/corpus.test.js scores the keyword engine, so the
// two can be compared directly. A note's label is one feeling, a list of acceptable feelings, or
// "*" (anything is fine).

// How a feeling reads in color; same table as tests/corpus.test.js.
export const POLARITY = {
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

/** The feelings a note accepts, or null when anything goes. */
export function acceptedFeelings(label) {
  if (label === '*') return null
  const list = Array.isArray(label) ? label : [label]
  return list.includes('*') ? null : list
}

const isFlip = (accepted, got) => {
  const g = POLARITY[got]
  return g !== 0 && accepted.every((o) => POLARITY[o] === -g)
}

/**
 * @param notes   [[text, feelingLabel, topicLabel], ...]
 * @param rankedOf (index) => feeling ids, best first
 * @returns counts and ready-made percentages
 *   exact       the top pick is one of the accepted feelings
 *   feelsRight  the top pick has the same polarity as an accepted feeling
 *   flips       a positive note read as negative, or the reverse
 *   top3        an accepted feeling is among the first three
 *   strict      the top pick is the FIRST feeling listed (the strictest reading)
 */
export function scoreRanked(notes, rankedOf) {
  const t = { n: 0, exact: 0, feelsRight: 0, flips: 0, top3: 0, strict: 0 }
  notes.forEach(([, label], i) => {
    const accepted = acceptedFeelings(label)
    if (accepted === null) return
    const ranked = rankedOf(i)
    const got = ranked[0]
    t.n++
    if (accepted.includes(got)) t.exact++
    else if (isFlip(accepted, got)) t.flips++
    if (accepted.some((o) => POLARITY[o] === POLARITY[got])) t.feelsRight++
    if (ranked.slice(0, 3).some((f) => accepted.includes(f))) t.top3++
    if (accepted[0] === got) t.strict++
  })
  const pct = (x) => (t.n ? (100 * x) / t.n : 0)
  return {
    ...t,
    pct: {
      exact: pct(t.exact),
      feelsRight: pct(t.feelsRight),
      flips: pct(t.flips),
      top3: pct(t.top3),
      strict: pct(t.strict),
    },
  }
}

export const describe = (s) =>
  `exact ${s.pct.exact.toFixed(1)}%  feels-right ${s.pct.feelsRight.toFixed(1)}%  flips ${s.pct.flips.toFixed(1)}%  top-3 ${s.pct.top3.toFixed(1)}%  strict ${s.pct.strict.toFixed(1)}%  (${s.n} notes)`

/** Feeling ids sorted by probability, highest first. */
export const rankIds = (probs, ids) =>
  ids
    .map((id, i) => [probs[i], id])
    .sort((a, b) => b[0] - a[0])
    .map((x) => x[1])
