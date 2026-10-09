/**
 * Remembering your corrections. When you tell the app how a note really felt, it keeps the note's
 * embedding and your answer. A later note that reads almost exactly the same follows that answer.
 *
 * This is deliberately cautious: it only reacts to near-duplicates. Ordinary notes about different
 * things sit far below the floor (unrelated notes score about 0.78, related ones 0.85 to 0.92 under
 * the e5 model) and are not affected at all. It does not try to learn general rules from a few
 * corrections: a simulation showed that tuning the classifier from a handful of corrections only
 * made it worse.
 */
export const PERSONAL = {
  // similarity (cosine, 0 to 1) below which a correction is ignored
  floor: 0.92,
  // extra score for your answer when the note is identical; scaled down as it gets less similar
  weight: 4,
}

/** Cosine similarity of two unit-length vectors. */
export function similarity(a, b) {
  let s = 0
  for (let i = 0; i < a.length; i++) s += a[i] * b[i]
  return s
}

/**
 * Extra score for each feeling from your earlier corrections, in the order of `ids`.
 *   corrections: [{ vector, feeling }]
 */
export function personalBoost(vector, corrections, ids, { floor, weight } = PERSONAL) {
  const boost = new Array(ids.length).fill(0)
  for (const c of corrections) {
    if (!c.vector || c.vector.length !== vector.length) continue
    const at = ids.indexOf(c.feeling)
    if (at === -1) continue
    const s = similarity(vector, c.vector)
    if (s <= floor) continue
    boost[at] += weight * ((s - floor) / (1 - floor)) ** 2
  }
  return boost
}
