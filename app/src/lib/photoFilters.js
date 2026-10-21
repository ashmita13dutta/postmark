/**
 * Photo filters, as plain arithmetic on pixels (RGBA, 0 to 255) so they can be tested without a
 * browser: "Vintage photo booth" (faded blacks, a warm tint, a little grain and a soft vignette) and
 * "Vibrant day-out" (more color and contrast). `intensity` (0 to 1) blends the filtered picture with
 * the original, so 0 returns the original exactly. The grain is seeded, so the same photo and seed
 * always give the same picture.
 */
import { seededRng } from './rng'

export const FILTERS = [
  { id: 'none', label: 'Original' },
  { id: 'vintage', label: 'Vintage photo booth' },
  { id: 'vibrant', label: 'Vibrant day-out' },
]

const clamp = (v) => (v < 0 ? 0 : v > 255 ? 255 : v)
const luma = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b

/** Pull a color towards (amount above 1) or away from (below 1) its own gray. */
function saturate(r, g, b, amount) {
  const y = luma(r, g, b)
  return [y + (r - y) * amount, y + (g - y) * amount, y + (b - y) * amount]
}

/**
 * A filtered copy of the pixels.
 * @param {Uint8ClampedArray} data RGBA, row by row (not changed)
 * @param {number} width
 * @param {number} height
 * @param {{ filter: 'none' | 'vintage' | 'vibrant', intensity?: number, seed?: string }} options
 * @returns {Uint8ClampedArray}
 */
export function applyFilter(data, width, height, { filter, intensity = 1, seed = 'photo' } = {}) {
  const out = new Uint8ClampedArray(data)
  const k = Math.min(1, Math.max(0, intensity))
  if (filter === 'none' || !filter || k === 0) return out

  const rnd = seededRng(`grain:${seed}`)
  const cx = (width - 1) / 2
  const cy = (height - 1) / 2
  const maxD2 = cx * cx + cy * cy || 1

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      let r = data[i]
      let g = data[i + 1]
      let b = data[i + 2]

      if (filter === 'vintage') {
        // desaturate a little, lift the blacks (a faded print), warm the tint
        ;[r, g, b] = saturate(r, g, b, 0.82)
        r = r * 0.88 + 26
        g = g * 0.86 + 21
        b = b * 0.8 + 16
        r *= 1.05
        b *= 0.94
        // film grain: the same amount in every channel, so it adds texture, not color
        const grain = (rnd() - 0.5) * 30
        r += grain
        g += grain
        b += grain
        // vignette: darker towards the corners
        const d2 = ((x - cx) * (x - cx) + (y - cy) * (y - cy)) / maxD2
        const shade = 1 - 0.38 * d2 * d2 ** 0.35
        r *= shade
        g *= shade
        b *= shade
      } else if (filter === 'vibrant') {
        ;[r, g, b] = saturate(r, g, b, 1.38)
        // contrast around mid-gray, and a touch brighter
        r = (r - 128) * 1.12 + 128 + 4
        g = (g - 128) * 1.12 + 128 + 4
        b = (b - 128) * 1.12 + 128 + 4
      }

      out[i] = clamp(data[i] + (r - data[i]) * k)
      out[i + 1] = clamp(data[i + 1] + (g - data[i + 1]) * k)
      out[i + 2] = clamp(data[i + 2] + (b - data[i + 2]) * k)
      // alpha is left alone
    }
  }
  return out
}
