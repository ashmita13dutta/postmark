import { describe, expect, it } from 'vitest'
import { coverRect, fitWithin, peekGeometry, peekX, stripLayout } from '../src/lib/photo'
import { FILTERS, applyFilter } from '../src/lib/photoFilters'

/** A flat picture of one color. */
const flat = (w, h, [r, g, b], a = 255) => {
  const data = new Uint8ClampedArray(w * h * 4)
  for (let i = 0; i < w * h; i++) data.set([r, g, b, a], i * 4)
  return data
}
const px = (data, w, x, y) => [...data.slice((y * w + x) * 4, (y * w + x) * 4 + 4)]
const spread = ([r, g, b]) => Math.max(r, g, b) - Math.min(r, g, b)

describe('applyFilter', () => {
  const W = 9
  const H = 7
  const sky = flat(W, H, [90, 130, 200])

  const LOOKS = FILTERS.map((f) => f.id).filter((id) => id !== 'none')

  it('has an original and five looks', () => {
    expect(FILTERS.map((f) => f.id)).toEqual([
      'none',
      'vintage',
      'vibrant',
      'soft',
      'golden',
      'mono',
    ])
    for (const f of FILTERS) expect(f.label.length).toBeGreaterThan(3)
  })

  it('returns the original pixels for "none", and for any filter at intensity 0', () => {
    expect([...applyFilter(sky, W, H, { filter: 'none' })]).toEqual([...sky])
    for (const filter of LOOKS)
      expect([...applyFilter(sky, W, H, { filter, intensity: 0 })]).toEqual([...sky])
  })

  it('never changes what it is given, and keeps the size', () => {
    const copy = new Uint8ClampedArray(sky)
    const out = applyFilter(sky, W, H, { filter: 'vintage', intensity: 1 })
    expect([...sky]).toEqual([...copy])
    expect(out).not.toBe(sky)
    expect(out.length).toBe(sky.length)
  })

  it('leaves transparency alone', () => {
    const see = flat(W, H, [90, 130, 200], 77)
    for (const filter of LOOKS) {
      const out = applyFilter(see, W, H, { filter, intensity: 1 })
      for (let i = 3; i < out.length; i += 4) expect(out[i]).toBe(77)
    }
  })

  describe('vintage', () => {
    it('fades the blacks and warms the tint', () => {
      const out = applyFilter(flat(21, 21, [0, 0, 0]), 21, 21, { filter: 'vintage', intensity: 1 })
      const [r, , b] = px(out, 21, 10, 10) // the middle, away from the vignette
      expect(r).toBeGreaterThan(8) // not black any more
      expect(r).toBeGreaterThan(b) // warmer: more red than blue
    })

    it('darkens the corners more than the middle', () => {
      const out = applyFilter(flat(41, 41, [180, 180, 180]), 41, 41, {
        filter: 'vintage',
        intensity: 1,
        seed: 'a',
      })
      const mid = px(out, 41, 20, 20)[1]
      const corner = px(out, 41, 0, 0)[1]
      expect(corner).toBeLessThan(mid - 15)
    })

    it('adds grain that is the same every time for a seed, and different for another', () => {
      const a = applyFilter(sky, W, H, { filter: 'vintage', intensity: 1, seed: 'one' })
      const b = applyFilter(sky, W, H, { filter: 'vintage', intensity: 1, seed: 'one' })
      const c = applyFilter(sky, W, H, { filter: 'vintage', intensity: 1, seed: 'two' })
      expect([...a]).toEqual([...b])
      expect([...a]).not.toEqual([...c])
      // grain is texture: it varies from pixel to pixel in a flat picture
      expect(new Set([...a].filter((_, i) => i % 4 === 1)).size).toBeGreaterThan(5)
    })

    it('desaturates a little', () => {
      const out = applyFilter(flat(21, 21, [250, 40, 40]), 21, 21, {
        filter: 'vintage',
        intensity: 1,
      })
      expect(spread(px(out, 21, 10, 10))).toBeLessThan(spread([250, 40, 40]))
    })
  })

  describe('vibrant', () => {
    it('makes colors more colorful', () => {
      const dull = [120, 140, 170]
      const out = applyFilter(flat(5, 5, dull), 5, 5, { filter: 'vibrant', intensity: 1 })
      expect(spread(px(out, 5, 2, 2))).toBeGreaterThan(spread(dull) + 15)
    })

    it('keeps a gray gray', () => {
      const [r, g, b] = px(
        applyFilter(flat(5, 5, [128, 128, 128]), 5, 5, { filter: 'vibrant' }),
        5,
        2,
        2,
      )
      expect(r).toBe(g)
      expect(g).toBe(b)
    })

    it('adds contrast: darks get darker and lights lighter', () => {
      const dark = px(
        applyFilter(flat(5, 5, [60, 60, 60]), 5, 5, { filter: 'vibrant' }),
        5,
        2,
        2,
      )[0]
      const light = px(
        applyFilter(flat(5, 5, [200, 200, 200]), 5, 5, { filter: 'vibrant' }),
        5,
        2,
        2,
      )[0]
      expect(dark).toBeLessThan(60)
      expect(light).toBeGreaterThan(200)
    })

    it('stays inside 0 to 255', () => {
      const out = applyFilter(flat(5, 5, [255, 0, 255]), 5, 5, { filter: 'vibrant', intensity: 1 })
      for (const v of out) expect(v >= 0 && v <= 255).toBe(true)
    })
  })

  describe('the other looks', () => {
    const mid = (filter, color, size = 21) =>
      px(applyFilter(flat(size, size, color), size, size, { filter, intensity: 1 }), size, 10, 10)

    it('soft film lifts the blacks and flattens the contrast', () => {
      expect(mid('soft', [0, 0, 0])[0]).toBeGreaterThan(15)
      const dark = mid('soft', [60, 60, 60])[1]
      const light = mid('soft', [200, 200, 200])[1]
      expect(light - dark).toBeLessThan(200 - 60)
    })

    it('golden hour warms: more red than blue, and the sky loses blue', () => {
      const [r, , b] = mid('golden', [150, 150, 150])
      expect(r).toBeGreaterThan(b + 20)
      expect(mid('golden', [90, 130, 200])[2]).toBeLessThan(200)
    })

    it('black and white leaves no color', () => {
      for (const color of [
        [250, 40, 40],
        [90, 130, 200],
        [30, 200, 90],
      ])
        expect(spread(mid('mono', color))).toBeLessThanOrEqual(6)
    })

    it('black and white keeps light and dark apart', () => {
      expect(mid('mono', [230, 230, 230])[0]).toBeGreaterThan(mid('mono', [40, 40, 40])[0] + 120)
    })

    it('shows the same size of grain in a small picture and a big one', () => {
      // a 1400 px wide picture has grain cells two pixels wide: neighbours in a cell match
      const wide = applyFilter(flat(1400, 4, [140, 140, 140]), 1400, 4, {
        filter: 'soft',
        seed: 'g',
      })
      expect(px(wide, 1400, 600, 1)).toEqual(px(wide, 1400, 601, 1))
      // a small one has one cell per pixel, so neighbours differ
      const small = applyFilter(flat(300, 4, [140, 140, 140]), 300, 4, {
        filter: 'soft',
        seed: 'g',
      })
      let differ = 0
      for (let x = 0; x < 100; x += 2)
        if (px(small, 300, x, 1)[0] !== px(small, 300, x + 1, 1)[0]) differ++
      expect(differ).toBeGreaterThan(20)
    })
  })

  it('blends with the original by the intensity', () => {
    const color = [90, 130, 200]
    const at = (intensity) =>
      px(applyFilter(flat(5, 5, color), 5, 5, { filter: 'vibrant', intensity }), 5, 2, 2)
    const full = at(1)
    const half = at(0.5)
    for (let c = 0; c < 3; c++) {
      // about halfway between the original and the full effect (pixels are whole numbers)
      expect(Math.abs(half[c] - (color[c] + full[c]) / 2)).toBeLessThanOrEqual(1)
    }
    expect(full[2]).toBeGreaterThan(half[2])
    expect(half[2]).toBeGreaterThan(color[2])
  })

  it('treats an intensity outside 0 to 1 as the nearest end', () => {
    const one = applyFilter(sky, W, H, { filter: 'vibrant', intensity: 1 })
    expect([...applyFilter(sky, W, H, { filter: 'vibrant', intensity: 5 })]).toEqual([...one])
    expect([...applyFilter(sky, W, H, { filter: 'vibrant', intensity: -2 })]).toEqual([...sky])
  })
})

describe('fitWithin', () => {
  it('shrinks the longest edge and keeps the shape', () => {
    expect(fitWithin(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 })
    expect(fitWithin(3000, 4000, 1600)).toEqual({ width: 1200, height: 1600 })
  })
  it('never scales up', () => {
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 })
  })
  it('never makes a side zero', () => {
    expect(fitWithin(10000, 1, 100)).toEqual({ width: 100, height: 1 })
  })
})

describe('coverRect', () => {
  it('crops the sides of a wide picture to fill a taller box', () => {
    const r = coverRect(400, 200, 100, 100)
    expect(r).toEqual({ x: 100, y: 0, w: 200, h: 200 })
  })
  it('crops the top and bottom of a tall picture to fill a wider box', () => {
    const r = coverRect(200, 400, 100, 100)
    expect(r).toEqual({ x: 0, y: 100, w: 200, h: 200 })
  })
  it('uses the whole picture when the shapes match', () => {
    expect(coverRect(400, 300, 200, 150)).toEqual({ x: 0, y: 0, w: 400, h: 300 })
  })
})

describe('stripLayout', () => {
  it.each([3, 4])('stacks %i frames between white borders', (n) => {
    const L = stripLayout(n)
    expect(L.frames).toHaveLength(n)
    for (const f of L.frames) {
      expect(f.x).toBeGreaterThan(0)
      expect(f.x + f.w).toBeLessThan(L.width)
    }
    // no two frames touch, and they run top to bottom
    for (let i = 1; i < n; i++)
      expect(L.frames[i].y).toBeGreaterThan(L.frames[i - 1].y + L.frames[i - 1].h)
    const last = L.frames[n - 1]
    expect(last.y + last.h).toBeLessThan(L.footerY + 1)
    expect(L.height).toBeGreaterThan(L.footerY)
  })

  it('is taller than it is wide, like a photo-booth strip', () => {
    const L = stripLayout(3)
    expect(L.height).toBeGreaterThan(L.width)
  })
})

describe('peekGeometry', () => {
  it('is the same every time for a seed', () => {
    expect(peekGeometry('2026-10-09')).toEqual(peekGeometry('2026-10-09'))
    expect(peekGeometry('2026-10-09')).not.toEqual(peekGeometry('2026-10-10'))
  })

  it('fans the photo out: always turned 8 to 14 degrees with its outer end up, pivoting on the hidden edge', () => {
    for (let d = 1; d <= 28; d++) {
      const front = peekGeometry(`2026-10-${String(d).padStart(2, '0')}`)
      expect(front.rotate).toBeLessThanOrEqual(-8 + 1e-9)
      expect(front.rotate).toBeGreaterThanOrEqual(-14 - 1e-9)
      expect(front.originX).toBe(0) // the left edge is under the stamp
      const back = peekGeometry(`2026-10-${String(d).padStart(2, '0')}`, true)
      expect(back.rotate).toBeGreaterThanOrEqual(8 - 1e-9)
      expect(back.rotate).toBeLessThanOrEqual(14 + 1e-9)
      expect(back.originX).toBe(1)
    }
  })

  it('shows about a third of the photo beside the stamp, on the right', () => {
    for (let d = 1; d <= 28; d++) {
      const g = peekGeometry(`seed-${d}`)
      const stickingOut = g.x + g.width - 1 // how far past the stamp's right edge it reaches
      const fraction = stickingOut / g.width
      expect(fraction).toBeGreaterThanOrEqual(0.27 - 1e-9)
      expect(fraction).toBeLessThanOrEqual(0.33 + 1e-9)
      expect(g.side).toBe(1)
    }
  })

  it('mirrors to the left on the back of the postcard', () => {
    for (let d = 1; d <= 28; d++) {
      const front = peekGeometry(`seed-${d}`)
      const back = peekGeometry(`seed-${d}`, true)
      expect(back.side).toBe(-1)
      const stickingOut = -back.x // how far past the stamp's left edge it reaches
      expect(stickingOut / back.width).toBeGreaterThanOrEqual(0.27 - 1e-9)
      expect(stickingOut / back.width).toBeLessThanOrEqual(0.33 + 1e-9)
      expect(back.rotate).toBeCloseTo(-front.rotate)
    }
  })
})

describe('peekX', () => {
  it('shows the same share of a narrower photo, like a film strip', () => {
    for (const back of [false, true]) {
      const g = peekGeometry('2026-10-21', back)
      for (const width of [0.45, 0.9]) {
        const x = peekX(g, width)
        const out = g.side === 1 ? x + width - 1 : -x // how far it reaches past the stamp's edge
        expect(out / width).toBeCloseTo(g.visible)
      }
    }
  })
})
