/**
 * Color math in OKLab, where distance between two colors roughly matches how different they
 * look to a person. Pure functions, no DOM.
 */

export function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex)
  if (!m) throw new Error(`Invalid hex color: ${hex}`)
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function rgbToHex([r, g, b]) {
  const c = (v) =>
    Math.round(Math.min(255, Math.max(0, v)))
      .toString(16)
      .padStart(2, '0')
  return `#${c(r)}${c(g)}${c(b)}`.toUpperCase()
}

const toLinear = (v) => {
  const c = v / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}
const fromLinear = (c) => 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)

/** sRGB [0-255] to OKLab {L, a, b}. L is 0 (black) to 1 (white). */
export function rgbToOklab([r, g, b]) {
  const lr = toLinear(r)
  const lg = toLinear(g)
  const lb = toLinear(b)
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb)
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb)
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb)
  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  }
}

/** OKLab to sRGB [0-255], clamped into gamut. */
export function oklabToRgb({ L, a, b }) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [
    fromLinear(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    fromLinear(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    fromLinear(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ].map((v) => Math.min(255, Math.max(0, v)))
}

export const hexToOklab = (hex) => rgbToOklab(hexToRgb(hex))
export const oklabToHex = (lab) => rgbToHex(oklabToRgb(lab))

/** Straight-line distance in OKLab. ~0.02 is barely noticeable; ~0.1 is clearly different. */
export function oklabDistance(p, q) {
  return Math.hypot(p.L - q.L, p.a - q.a, p.b - q.b)
}

export const hexDistance = (h1, h2) => oklabDistance(hexToOklab(h1), hexToOklab(h2))

/** Chroma (colorfulness) of an OKLab color. */
export const chroma = ({ a, b }) => Math.hypot(a, b)

/** Hue angle in degrees, 0-360. Meaningless for near-greys. */
export function hue({ a, b }) {
  const h = (Math.atan2(b, a) * 180) / Math.PI
  return h < 0 ? h + 360 : h
}
