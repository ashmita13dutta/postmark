import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { feelings } from '../src/data/feelings.json'
import {
  FEELING_IDS,
  HEAD,
  MODEL,
  headLogits,
  headProbs,
  rankFeelings,
  softmax,
} from '../src/engine/reader/head'

const manifest = JSON.parse(
  readFileSync(new URL('../scripts/model/manifest.json', import.meta.url), 'utf8'),
)

describe('the trained head file', () => {
  it('has a score for exactly the 16 feelings the app knows', () => {
    expect([...FEELING_IDS].sort()).toEqual(Object.keys(feelings).sort())
    expect(new Set(FEELING_IDS).size).toBe(FEELING_IDS.length)
  })

  it('is well formed: one row of weights per feeling, finite numbers, no zero spreads', () => {
    expect(HEAD.W).toHaveLength(FEELING_IDS.length)
    expect(HEAD.b).toHaveLength(FEELING_IDS.length)
    expect(HEAD.mean).toHaveLength(HEAD.dim)
    expect(HEAD.sd).toHaveLength(HEAD.dim)
    for (const row of HEAD.W) expect(row).toHaveLength(HEAD.dim)
    const all = [...HEAD.mean, ...HEAD.sd, ...HEAD.b, ...HEAD.W.flat()]
    expect(all.every(Number.isFinite)).toBe(true)
    expect(Math.min(...HEAD.sd)).toBeGreaterThan(0)
  })

  it('was trained for the model that ships (retrain after changing the manifest)', () => {
    expect(MODEL.id).toBe(manifest.id)
    expect(MODEL.revision).toBe(manifest.source.revision)
    expect(MODEL.dtype).toBe(manifest.dtype)
    expect(MODEL.prefix).toBe(manifest.prefix)
    expect(MODEL.pooling).toBe(manifest.pooling)
  })
})

describe('softmax', () => {
  it('gives probabilities that add up to one and keep the order', () => {
    const p = softmax([1, 3, 2])
    expect(p.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10)
    expect(p[1]).toBeGreaterThan(p[2])
    expect(p[2]).toBeGreaterThan(p[0])
  })
  it('does not overflow on large scores', () => {
    const p = softmax([1000, 999, -1000])
    expect(p.every(Number.isFinite)).toBe(true)
    expect(p[0]).toBeGreaterThan(p[1])
  })
})

describe('headProbs', () => {
  // a tiny head by hand: two feelings, two dimensions, unit spread
  const tiny = {
    dim: 2,
    feelings: ['a', 'b'],
    mean: [0, 0],
    sd: [1, 1],
    W: [
      [1, 0],
      [0, 1],
    ],
    b: [0, 0],
  }

  it('applies standardise, weights and bias, then softmax', () => {
    const [pa, pb] = headProbs([2, 0], tiny)
    const e2 = Math.exp(2)
    expect(pa).toBeCloseTo(e2 / (e2 + 1), 10)
    expect(pb).toBeCloseTo(1 / (e2 + 1), 10)
  })

  it('standardises with the head mean and spread', () => {
    const shifted = { ...tiny, mean: [1, 0], sd: [0.5, 1] }
    // (2 - 1) / 0.5 = 2, so the same as the plain case
    expect(headLogits([2, 0], shifted)).toEqual([2, 0])
  })

  it('adds the bias', () => {
    expect(headLogits([0, 0], { ...tiny, b: [0.5, -1] })).toEqual([0.5, -1])
  })

  it('refuses an embedding of the wrong size', () => {
    expect(() => headProbs([1, 2, 3], tiny)).toThrow('2-number')
    expect(() => headProbs(undefined, tiny)).toThrow('nothing')
  })

  it('works on the real head with a real-sized vector', () => {
    const v = new Array(HEAD.dim).fill(0).map((_, i) => (i === 3 ? 1 : 0))
    const p = headProbs(v)
    expect(p).toHaveLength(FEELING_IDS.length)
    expect(p.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 8)
  })
})

describe('rankFeelings', () => {
  it('sorts best first and keeps the ids', () => {
    const r = rankFeelings([0.1, 0.6, 0.3], ['x', 'y', 'z'])
    expect(r.map((e) => e.id)).toEqual(['y', 'z', 'x'])
    expect(r[0].p).toBe(0.6)
  })
})
