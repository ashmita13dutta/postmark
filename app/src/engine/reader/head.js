import head from '../../data/feelingHead.json'

/**
 * The note reader's "head": the last layer that turns a sentence embedding (384 numbers from the
 * on-device model) into a probability for each of the 16 feelings. It is trained by
 * `npm run train:head` and stored in data/feelingHead.json. Everything here is plain arithmetic, so
 * it behaves identically in the app, in tests and in the training scripts.
 */
export const HEAD = head
export const FEELING_IDS = head.feelings
/** Which model the head was trained on; the app only trusts vectors from this exact model. */
export const MODEL = head.model

export function softmax(scores) {
  let max = -Infinity
  for (const s of scores) if (s > max) max = s
  const out = scores.map((s) => Math.exp(s - max))
  const total = out.reduce((a, b) => a + b, 0)
  return out.map((v) => v / total)
}

/** Raw scores (before softmax) for each feeling, in head.feelings order. */
export function headLogits(vector, h = head) {
  if (!vector || vector.length !== h.dim) {
    throw new Error(
      `Expected a ${h.dim}-number embedding, got ${vector ? vector.length : 'nothing'}`,
    )
  }
  return h.W.map((weights, c) => {
    let s = h.b[c]
    for (let j = 0; j < h.dim; j++) s += weights[j] * ((vector[j] - h.mean[j]) / h.sd[j])
    return s
  })
}

/** Probability of each feeling for one embedding, in head.feelings order. */
export function headProbs(vector, h = head) {
  return softmax(headLogits(vector, h))
}

/** [{ id, p }] sorted from most to least likely. */
export function rankFeelings(probs, ids = FEELING_IDS) {
  return ids.map((id, i) => ({ id, p: probs[i] })).sort((a, b) => b.p - a.p)
}
