/**
 * Photo filters, as plain arithmetic on pixels (RGBA, 0 to 255) so they can be tested without a
 * browser. Each filter is a small recipe (see LOOKS): how much color to keep, a contrast curve, a tint
 * for the shadows and the highlights, film grain and a vignette. `intensity` (0 to 1) blends the
 * filtered picture with the original, so 0 returns the original exactly.
 *
 * The grain is seeded, so the same photo and seed always give the same picture, and it is sized by
 * the picture (a grain cell is about 1/700 of the long edge), so the small live preview shows the
 * same texture as the full-size picture that is kept.
 */
import { seededRng } from './rng'

export const FILTERS = [
  { id: 'none', label: 'Original' },
  { id: 'vintage', label: 'Vintage photo booth' },
  { id: 'vibrant', label: 'Vibrant day-out' },
  { id: 'soft', label: 'Soft film' },
  { id: 'golden', label: 'Golden hour' },
  { id: 'mono', label: 'Black & white' },
]

/**
 * The recipes. Colors are in 0 to 1.
 *  - sat:      1 keeps the color, 0 is gray, above 1 is richer
 *  - vibrance: extra richness for dull colors only (bright ones are left alone, so skin and sky do not burn)
 *  - gain:     red, green and blue multipliers (a warm or cool cast)
 *  - contrast: an S-curve, above 0 deepens the shadows and brightens the lights, below 0 flattens
 *  - black / white: where pure black and pure white end up, per channel (a faded print lifts the black)
 *  - grain:    how strong the film grain is, strongest in the midtones
 *  - vignette: how much the corners darken
 */
const LOOKS = {
  vintage: {
    sat: 0.8,
    vibrance: 0,
    gain: [1.04, 1, 0.95],
    contrast: 0.2,
    black: [0.115, 0.095, 0.1],
    white: [1, 0.965, 0.86],
    grain: 0.075,
    vignette: 0.36,
  },
  vibrant: {
    sat: 1.08,
    vibrance: 0.7,
    gain: [1, 1, 1],
    contrast: 0.22,
    black: [0, 0, 0],
    white: [0.985, 0.985, 0.985],
    brightness: 0,
    grain: 0,
    vignette: 0,
  },
  soft: {
    sat: 0.88,
    vibrance: 0.15,
    gain: [1.03, 1, 0.99],
    contrast: -0.12,
    black: [0.1, 0.09, 0.1],
    white: [1, 0.96, 0.955],
    brightness: 0.03,
    grain: 0.03,
    vignette: 0,
  },
  golden: {
    sat: 1.06,
    vibrance: 0.25,
    gain: [1.07, 1.0, 0.85],
    contrast: 0.18,
    black: [0.04, 0.025, 0.012],
    white: [1, 0.97, 0.88],
    grain: 0.03,
    vignette: 0.2,
  },
  mono: {
    sat: 0,
    vibrance: 0,
    gain: [1, 1, 1],
    contrast: 0.42,
    black: [0.025, 0.025, 0.03],
    white: [0.99, 0.99, 0.985],
    grain: 0.06,
    vignette: 0.24,
  },
}

const clamp255 = (v) => (v < 0 ? 0 : v > 255 ? 255 : v)
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)
const luma = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b

/** A smooth S-curve: `k` above 0 adds contrast around the middle, below 0 takes it away. */
function curve(v, k) {
  const s = v * v * (3 - 2 * v)
  return v + k * (s - v)
}

/**
 * A filtered copy of the pixels.
 * @param {Uint8ClampedArray} data RGBA, row by row (not changed)
 * @param {number} width
 * @param {number} height
 * @param {{ filter: string, intensity?: number, seed?: string }} options
 * @returns {Uint8ClampedArray}
 */
export function applyFilter(data, width, height, { filter, intensity = 1, seed = 'photo' } = {}) {
  const out = new Uint8ClampedArray(data)
  const k = Math.min(1, Math.max(0, intensity))
  const look = LOOKS[filter]
  if (!look || k === 0) return out

  const { sat, vibrance, gain, contrast, black, white, grain, vignette } = look
  const brightness = look.brightness ?? 0

  // grain: one random value per cell, so a big picture gets coarser grain than a small one
  const cell = Math.max(1, Math.round(Math.max(width, height) / 700))
  const gw = Math.ceil(width / cell)
  const gh = Math.ceil(height / cell)
  const noise = new Float32Array(gw * gh)
  if (grain > 0) {
    const rnd = seededRng(`grain:${seed}`)
    for (let i = 0; i < noise.length; i++) noise[i] = rnd() * 2 - 1
  }

  const cx = (width - 1) / 2
  const cy = (height - 1) / 2
  const maxD2 = cx * cx + cy * cy || 1

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      let r = data[i] / 255
      let g = data[i + 1] / 255
      let b = data[i + 2] / 255

      // color: vibrance first (only for dull colors), then the overall amount
      let y0 = luma(r, g, b)
      if (vibrance) {
        const top = Math.max(r, g, b)
        const dullness = top > 0 ? 1 - (top - Math.min(r, g, b)) / top : 0
        const amount = 1 + vibrance * dullness * dullness
        r = y0 + (r - y0) * amount
        g = y0 + (g - y0) * amount
        b = y0 + (b - y0) * amount
      }
      if (sat !== 1) {
        r = y0 + (r - y0) * sat
        g = y0 + (g - y0) * sat
        b = y0 + (b - y0) * sat
      }

      // cast, contrast, then where black and white end up
      r = black[0] + curve(clamp01(r * gain[0] + brightness), contrast) * (white[0] - black[0])
      g = black[1] + curve(clamp01(g * gain[1] + brightness), contrast) * (white[1] - black[1])
      b = black[2] + curve(clamp01(b * gain[2] + brightness), contrast) * (white[2] - black[2])

      if (grain > 0) {
        // the same amount in every channel (texture, not color), strongest in the midtones
        y0 = luma(r, g, b)
        const n = noise[Math.floor(y / cell) * gw + Math.floor(x / cell)]
        const weight = 0.4 + 0.6 * (1 - Math.abs(2 * y0 - 1))
        const grainAmount = n * grain * weight
        r += grainAmount
        g += grainAmount
        b += grainAmount
      }
      if (vignette > 0) {
        const d2 = ((x - cx) * (x - cx) + (y - cy) * (y - cy)) / maxD2
        const shade = 1 - vignette * d2 * d2 ** 0.35
        r *= shade
        g *= shade
        b *= shade
      }

      r *= 255
      g *= 255
      b *= 255
      out[i] = clamp255(data[i] + (r - data[i]) * k)
      out[i + 1] = clamp255(data[i + 1] + (g - data[i + 1]) * k)
      out[i + 2] = clamp255(data[i + 2] + (b - data[i + 2]) * k)
      // alpha is left alone
    }
  }
  return out
}
