import { describe, expect, it } from 'vitest'
import { seededRng, stampTilt } from '../src/lib/rng'

describe('rng', () => {
  it('same key gives the same sequence', () => {
    const a = seededRng('2026-09-24')
    const b = seededRng('2026-09-24')
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })

  it('different keys differ', () => {
    expect(seededRng('2026-09-24')()).not.toBe(seededRng('2026-09-25')())
  })

  it('values stay in [0, 1)', () => {
    const r = seededRng('x')
    for (let i = 0; i < 1000; i++) {
      const v = r()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('stampTilt is stable and bounded', () => {
    expect(stampTilt('2026-09-24')).toBe(stampTilt('2026-09-24'))
    for (let d = 1; d <= 30; d++) {
      const t = stampTilt(`2026-09-${String(d).padStart(2, '0')}`, 3)
      expect(Math.abs(t)).toBeLessThanOrEqual(3)
    }
  })
})
