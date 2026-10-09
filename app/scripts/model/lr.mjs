// A small multinomial logistic regression, used to train the note reader's "head": the last layer
// that turns a sentence embedding into a score for each of the 16 feelings. Plain JavaScript, no
// dependencies, and fully deterministic (zero start, fixed steps), so the same notes always give
// the same head.
//
// Targets are SOFT: a note that accepts three feelings is trained towards all three equally, which
// matches how the corpus is labelled.

/** Mean and standard deviation per dimension, so every dimension counts equally. */
export function fitStandardizer(vectors) {
  const dim = vectors[0].length
  const mean = new Float64Array(dim)
  const sd = new Float64Array(dim)
  for (const v of vectors) for (let j = 0; j < dim; j++) mean[j] += v[j] / vectors.length
  for (const v of vectors)
    for (let j = 0; j < dim; j++) sd[j] += (v[j] - mean[j]) ** 2 / vectors.length
  for (let j = 0; j < dim; j++) sd[j] = Math.sqrt(sd[j]) + 1e-6
  return { mean, sd }
}

export function softmax(scores) {
  let max = -Infinity
  for (const s of scores) if (s > max) max = s
  const out = scores.map((s) => Math.exp(s - max))
  const total = out.reduce((a, b) => a + b, 0)
  return out.map((v) => v / total)
}

/**
 * Train on rows of { x: number[], y: number[] } where y is a probability distribution over the
 * classes. Returns { mean, sd, W (classes x dim), b } as plain arrays.
 */
export function train(rows, { lambda = 0.3, steps = 250, lr = 0.03 } = {}) {
  const classes = rows[0].y.length
  const { mean, sd } = fitStandardizer(rows.map((r) => r.x))
  const dim = mean.length
  const n = rows.length
  const X = new Float64Array(n * dim)
  const Y = new Float64Array(n * classes)
  rows.forEach((r, i) => {
    for (let j = 0; j < dim; j++) X[i * dim + j] = (r.x[j] - mean[j]) / sd[j]
    for (let c = 0; c < classes; c++) Y[i * classes + c] = r.y[c]
  })

  const W = new Float64Array(classes * dim)
  const b = new Float64Array(classes)
  const mW = new Float64Array(classes * dim)
  const vW = new Float64Array(classes * dim)
  const mb = new Float64Array(classes)
  const vb = new Float64Array(classes)
  const gW = new Float64Array(classes * dim)
  const gb = new Float64Array(classes)
  const p = new Float64Array(classes)
  const [beta1, beta2, eps] = [0.9, 0.999, 1e-8]

  for (let step = 1; step <= steps; step++) {
    gW.fill(0)
    gb.fill(0)
    for (let i = 0; i < n; i++) {
      const xi = i * dim
      let max = -Infinity
      for (let c = 0; c < classes; c++) {
        let s = b[c]
        const wc = c * dim
        for (let j = 0; j < dim; j++) s += W[wc + j] * X[xi + j]
        p[c] = s
        if (s > max) max = s
      }
      let z = 0
      for (let c = 0; c < classes; c++) {
        p[c] = Math.exp(p[c] - max)
        z += p[c]
      }
      for (let c = 0; c < classes; c++) {
        const err = (p[c] / z - Y[i * classes + c]) / n
        gb[c] += err
        const wc = c * dim
        for (let j = 0; j < dim; j++) gW[wc + j] += err * X[xi + j]
      }
    }
    const c1 = 1 - beta1 ** step
    const c2 = 1 - beta2 ** step
    for (let k = 0; k < classes * dim; k++) {
      const grad = gW[k] + lambda * W[k]
      mW[k] = beta1 * mW[k] + (1 - beta1) * grad
      vW[k] = beta2 * vW[k] + (1 - beta2) * grad * grad
      W[k] -= (lr * (mW[k] / c1)) / (Math.sqrt(vW[k] / c2) + eps)
    }
    for (let c = 0; c < classes; c++) {
      mb[c] = beta1 * mb[c] + (1 - beta1) * gb[c]
      vb[c] = beta2 * vb[c] + (1 - beta2) * gb[c] * gb[c]
      b[c] -= (lr * (mb[c] / c1)) / (Math.sqrt(vb[c] / c2) + eps)
    }
  }

  return {
    mean: Array.from(mean),
    sd: Array.from(sd),
    W: Array.from({ length: classes }, (_, c) => Array.from(W.subarray(c * dim, (c + 1) * dim))),
    b: Array.from(b),
  }
}

/** Probabilities for one embedding under a trained model. */
export function predict(model, x) {
  const scores = model.W.map((w, c) => {
    let s = model.b[c]
    for (let j = 0; j < w.length; j++) s += w[j] * ((x[j] - model.mean[j]) / model.sd[j])
    return s
  })
  return softmax(scores)
}

/** Deterministic k-fold split of row indices. */
export function folds(count, k = 5) {
  return Array.from({ length: k }, (_, f) => {
    const idx = []
    for (let i = f; i < count; i += k) idx.push(i)
    return idx
  })
}

/** Out-of-fold probabilities for every row (each row is predicted by a model that never saw it). */
export function crossValidatedProbs(rows, options, k = 5) {
  const out = new Array(rows.length)
  for (const held of folds(rows.length, k)) {
    const skip = new Set(held)
    const model = train(
      rows.filter((_, i) => !skip.has(i)),
      options,
    )
    for (const i of held) out[i] = predict(model, rows[i].x)
  }
  return out
}
