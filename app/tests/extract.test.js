import { describe, expect, it } from 'vitest'
import {
  downscale,
  extractPalette,
  orderForBanding,
  paletteFromPixels,
} from '../src/engine/colorExtract'
import { chroma, hexDistance, hexToOklab, hexToRgb } from '../src/lib/color'
import { LIMITS } from '../src/lib/contentRules'
import { seededRng } from '../src/lib/rng'

/** Build RGBA pixel data of a given size from a function (x, y) -> '#RRGGBB' or null (transparent). */
function image(width, height, colorAt) {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const hex = colorAt(x, y)
      const o = (y * width + x) * 4
      if (hex) {
        const [r, g, b] = hexToRgb(hex)
        data.set([r, g, b, 255], o)
      }
    }
  }
  return data
}

const stripes = ['#3A5771', '#E7C64B', '#B14126', '#4F7A47', '#F4EFE6']
const L = (hex) => hexToOklab(hex).L

function expectValidPalette(colors) {
  expect(colors).toHaveLength(5)
  for (const c of colors) expect(c).toMatch(/^#[0-9A-F]{6}$/)
  for (let i = 0; i < 5; i++) {
    expect(chroma(hexToOklab(colors[i]))).toBeLessThanOrEqual(LIMITS.maxChromaVivid + 1e-6)
    for (let j = i + 1; j < 5; j++) {
      expect(
        hexDistance(colors[i], colors[j]),
        `${colors[i]} and ${colors[j]} look alike`,
      ).toBeGreaterThanOrEqual(LIMITS.minPair)
    }
  }
}

describe('extractPalette', () => {
  it('finds the five colors of a five-stripe picture', () => {
    const colors = extractPalette(image(50, 50, (x, y) => stripes[Math.floor(y / 10)]))
    expectValidPalette(colors)
    for (const s of stripes) {
      const nearest = Math.min(...colors.map((c) => hexDistance(c, s)))
      expect(nearest, `no color near ${s}`).toBeLessThan(0.04)
    }
  })

  it('orders the result dark to light, ready for stamp bands', () => {
    const colors = extractPalette(image(50, 50, (x, y) => stripes[Math.floor(y / 10)]))
    for (let i = 1; i < 5; i++) expect(L(colors[i])).toBeGreaterThanOrEqual(L(colors[i - 1]))
    expect(orderForBanding(['#FFFFFF', '#000000', '#888888']).join()).toBe(
      '#000000,#888888,#FFFFFF',
    )
  })

  it('a small but different color is not lost behind a big one', () => {
    // 70% sky, 28% grass, a 2% red flower
    const colors = extractPalette(
      image(100, 100, (x, y) => (y < 70 ? '#7FA3C7' : y < 98 ? '#4F7A47' : '#C8302B')),
    )
    expectValidPalette(colors)
    expect(Math.min(...colors.map((c) => hexDistance(c, '#C8302B')))).toBeLessThan(0.06)
    expect(Math.min(...colors.map((c) => hexDistance(c, '#7FA3C7')))).toBeLessThan(0.04)
    expect(Math.min(...colors.map((c) => hexDistance(c, '#4F7A47')))).toBeLessThan(0.04)
  })

  it('a flat one-color photo still gives five distinct tints', () => {
    const colors = extractPalette(image(20, 20, () => '#3F7D7A'))
    expectValidPalette(colors)
    // all tints of the same teal: the middle one is close to the original
    expect(Math.min(...colors.map((c) => hexDistance(c, '#3F7D7A')))).toBeLessThan(0.05)
  })

  it('a pure white or pure black photo still gives five distinct colors', () => {
    expectValidPalette(extractPalette(image(20, 20, () => '#FFFFFF')))
    expectValidPalette(extractPalette(image(20, 20, () => '#000000')))
  })

  it('a two-color photo gives five colors, not two', () => {
    expectValidPalette(extractPalette(image(40, 40, (x) => (x < 20 ? '#E7C64B' : '#3A5771'))))
  })

  it('a smooth gradient gives five spread-out colors', () => {
    const colors = extractPalette(
      image(64, 64, (x) => {
        const v = Math.round((x / 63) * 255)
        return `#${v.toString(16).padStart(2, '0').repeat(3)}`
      }),
    )
    expectValidPalette(colors)
    expect(L(colors[4]) - L(colors[0])).toBeGreaterThan(0.5)
  })

  it('very saturated colors are tamed so a photo never makes a neon stamp', () => {
    const colors = extractPalette(
      image(30, 30, (x) => (x < 10 ? '#FF0000' : x < 20 ? '#00FF00' : '#0000FF')),
    )
    expectValidPalette(colors) // includes the chroma cap
  })

  it('ignores transparent pixels', () => {
    // left half transparent junk, right half real stripes
    const colors = extractPalette(
      image(50, 50, (x, y) => (x < 25 ? null : stripes[Math.floor(y / 10)])),
    )
    expectValidPalette(colors)
    expect(Math.min(...colors.map((c) => hexDistance(c, '#B14126')))).toBeLessThan(0.04)
  })

  it('empty or fully transparent images fall back to a blank palette', () => {
    expect(extractPalette(new Uint8ClampedArray(0))).toHaveLength(5)
    expect(extractPalette(image(10, 10, () => null))).toHaveLength(5)
  })

  it('works on a single pixel', () => {
    expectValidPalette(extractPalette(image(1, 1, () => '#B14126')))
  })

  it('handles noise, and is deterministic', () => {
    const rng = seededRng('noise')
    const noise = image(
      64,
      64,
      () =>
        `#${Math.floor(rng() * 0xffffff)
          .toString(16)
          .padStart(6, '0')}`,
    )
    const a = extractPalette(noise)
    expectValidPalette(a)
    expect(extractPalette(noise)).toEqual(a)
  })

  it('handles a big image quickly by sampling', () => {
    const big = image(1200, 900, (x, y) => stripes[Math.floor((y / 900) * 5)])
    const t0 = performance.now()
    expectValidPalette(extractPalette(big))
    expect(performance.now() - t0).toBeLessThan(2000)
  })

  it('can return a different number of colors', () => {
    expect(
      extractPalette(
        image(50, 50, (x, y) => stripes[Math.floor(y / 10)]),
        { k: 3 },
      ),
    ).toHaveLength(3)
  })
})

describe('downscale', () => {
  it('shrinks the long side to the target and keeps the shape', () => {
    const r = downscale(
      image(400, 200, () => '#336699'),
      400,
      200,
      64,
    )
    expect([r.width, r.height]).toEqual([64, 32])
    expect(r.data).toHaveLength(64 * 32 * 4)
  })

  it('does not enlarge small images', () => {
    const r = downscale(
      image(10, 8, () => '#336699'),
      10,
      8,
      64,
    )
    expect([r.width, r.height]).toEqual([10, 8])
  })

  it('averages blocks of pixels', () => {
    // a 4x4 black/white checkerboard of 2x2 blocks, shrunk to 2x2: each pixel averages one block
    const px = image(4, 4, (x, y) =>
      (Math.floor(x / 2) + Math.floor(y / 2)) % 2 ? '#FFFFFF' : '#000000',
    )
    const r = downscale(px, 4, 4, 2)
    expect([r.width, r.height]).toEqual([2, 2])
    expect(Array.from(r.data.slice(0, 3))).toEqual([0, 0, 0])
    expect(Array.from(r.data.slice(4, 7))).toEqual([255, 255, 255])
  })

  it('shrinking first gives the same palette as the full image (the app does this)', () => {
    const full = image(256, 256, (x, y) => stripes[Math.floor(y / 52) % 5])
    const small = downscale(full, 256, 256, 64)
    const a = extractPalette(small.data)
    for (const s of stripes) expect(Math.min(...a.map((c) => hexDistance(c, s)))).toBeLessThan(0.06)
  })
})

describe('paletteFromPixels', () => {
  it('returns five named colors with source "photo", no repeated names', () => {
    const r = paletteFromPixels(image(50, 50, (x, y) => stripes[Math.floor(y / 10)]))
    expect(r.paletteSource).toBe('photo')
    expect(r.colors).toHaveLength(5)
    expect(new Set(r.colors.map((c) => c.name)).size).toBe(5)
    for (const c of r.colors) expect(c.hex).toMatch(/^#[0-9A-F]{6}$/)
    expect(r.colors.map((c) => c.name)).toContain('Puja Red') // the red stripe is the sample Puja Red
  })
})

describe('extractPalette: edges and specks are not colors', () => {
  it('a hard sky/grass edge does not add in-between colors; the extra slots are tints', () => {
    const sky = '#7FA3C7'
    const grass = '#4F7A47'
    const colors = extractPalette(image(64, 64, (x, y) => (y < 43 ? sky : grass)))
    expectValidPalette(colors)
    // every color is close to the sky, the grass, or a lighter/darker tint of one of them:
    // never a muddy mix of the two (the midpoint between sky and grass)
    const mid = '#659F8F' // a mix of the two (roughly halfway)
    expect(Math.min(...colors.map((c) => hexDistance(c, sky)))).toBeLessThan(0.03)
    expect(Math.min(...colors.map((c) => hexDistance(c, grass)))).toBeLessThan(0.03)
    for (const c of colors) {
      const nearTint = Math.min(hexDistance(c, sky), hexDistance(c, grass)) < 0.2
      expect(nearTint, `${c} looks like a muddy blend`).toBe(true)
    }
    expect(Math.min(...colors.map((c) => hexDistance(c, mid)))).toBeGreaterThan(0.015)
  })

  it('a speck under 1% of the picture is ignored', () => {
    const base = (x, y) => (y < 60 ? '#7FA3C7' : '#4F7A47')
    const plain = extractPalette(image(100, 100, base))
    const speck = extractPalette(
      image(100, 100, (x, y) => (x < 5 && y < 1 ? '#C8302B' : base(x, y))),
    )
    expect(speck).toEqual(plain) // five pixels of 10,000
  })

  it('a real accent (2%) is kept', () => {
    const colors = extractPalette(
      image(100, 100, (x, y) => (y < 70 ? '#7FA3C7' : y < 98 ? '#4F7A47' : '#C8302B')),
    )
    expect(Math.min(...colors.map((c) => hexDistance(c, '#C8302B')))).toBeLessThan(0.06)
  })
})
