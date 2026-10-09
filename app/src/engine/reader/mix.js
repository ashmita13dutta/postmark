import { FEELING_IDS, rankFeelings, softmax } from './head'
import { personalBoost } from './personal'

/**
 * How much a word you deliberately TAUGHT ("this word means sad") counts. It adds to the score of
 * that feeling, so it can overrule the reader when the reader is unsure, and never when the reader
 * is very confident of something else.
 */
export const TAUGHT_BOOST = 3

/**
 * Combine everything the app knows about how a note felt into one set of probabilities.
 *   probs          from the head (headProbs)
 *   vector         the note's embedding, for matching against your corrections
 *   corrections    [{ vector, feeling }] from earlier days
 *   taughtFeelings feelings whose taught words appear in this note
 * Returns { probs, ranked } with ranked = [{ id, p }] best first.
 */
export function mixSignals({
  probs,
  vector,
  corrections = [],
  taughtFeelings = [],
  ids = FEELING_IDS,
}) {
  const logits = probs.map((p) => Math.log(p + 1e-9))
  const personal = personalBoost(vector, corrections, ids)
  personal.forEach((b, i) => {
    logits[i] += b
  })
  for (const id of taughtFeelings) {
    const at = ids.indexOf(id)
    if (at !== -1) logits[at] += TAUGHT_BOOST
  }
  const mixed = softmax(logits)
  return { probs: mixed, ranked: rankFeelings(mixed, ids) }
}
