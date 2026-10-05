/**
 * Five colors from a photo, fully on-device.
 *
 *   pixels (RGBA, about 64px wide)
 *     -> median cut into 16 color groups
 *     -> merge groups that look alike
 *     -> keep the 5 that are most different from each other, favoring colors that cover more of
 *        the picture (so a tiny speck never beats the sky)
 *     -> if the photo is nearly one color, add lighter/darker tints so there are always 5
 *     -> order dark to light, ready for stamp bands
 *
 * The photo never leaves the phone: this is plain arithmetic, with no network and no library.
 */
import { BLANK_PALETTE } from '../db/moments'
import { chroma, hexToOklab, oklabDistance, oklabToHex, rgbToOklab } from '../lib/color'
import { LIMITS } from '../lib/contentRules'
import { namePalette } from './colorNames'

const BOXES = 16 // median-cut groups before choosing
const MAX_SAMPLES = 4096
const MIN_ALPHA = 128

// ---- median cut (in RGB, where splitting by channel is natural) ----

function makeBox(pixels) {
  let lo = [255, 255, 255]
  let hi = [0, 0, 0]
  for (const p of pixels) {
    for (let c = 0; c < 3; c++) {
      if (p[c] < lo[c]) lo[c] = p[c]
      if (p[c] > hi[c]) hi[c] = p[c]
    }
  }
  const ranges = [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]]
  const channel = ranges.indexOf(Math.max(...ranges))
  return { pixels, channel, range: ranges[channel] }
}

function averageColor(pixels) {
  const sum = [0, 0, 0]
  for (const p of pixels) for (let c = 0; c < 3; c++) sum[c] += p[c]
  return sum.map((v) => v / pixels.length)
}

function medianCut(pixels, count) {
  let boxes = [makeBox(pixels)]
  while (boxes.length < count) {
    // split the box that is biggest in both spread and population
    let pick = -1
    let best = 0
    boxes.forEach((b, i) => {
      const score = b.range * Math.sqrt(b.pixels.length)
      if (b.pixels.length > 1 && b.range > 0 && score > best) {
        best = score
        pick = i
      }
    })
    if (pick < 0) break // nothing left to split: the picture has fewer colors than boxes
    const { pixels: px, channel } = boxes[pick]
    const sorted = [...px].sort((p, q) => p[channel] - q[channel])
    const mid = sorted.length >> 1
    boxes.splice(pick, 1, makeBox(sorted.slice(0, mid)), makeBox(sorted.slice(mid)))
  }
  return boxes.map((b) => ({ rgb: averageColor(b.pixels), count: b.pixels.length }))
}

// ---- helpers ----

/** Pull very strong colors back so a photo never makes a neon stamp. */
function tame(lab) {
  // aim a hair under the limit: rounding to whole 0-255 color values can nudge chroma back up
  const limit = LIMITS.maxChromaVivid - 0.005
  const c = chroma(lab)
  if (c <= limit) return lab
  const k = limit / c
  return { L: lab.L, a: lab.a * k, b: lab.b * k }
}

/** Collect opaque pixels, sampling evenly so big images stay fast. */
function collect(rgba) {
  const total = rgba.length / 4
  const stride = Math.max(1, Math.floor(total / MAX_SAMPLES))
  const out = []
  for (let i = 0; i < total; i += stride) {
    const o = i * 4
    if (rgba[o + 3] >= MIN_ALPHA) out.push([rgba[o], rgba[o + 1], rgba[o + 2]])
  }
  return out
}

/** Merge groups whose colors look alike (their pixel counts add up). */
function mergeAlike(groups) {
  const merged = []
  for (const g of [...groups].sort((p, q) => q.count - p.count)) {
    const near = merged.find((m) => oklabDistance(m.lab, g.lab) < LIMITS.minPair * 0.8)
    if (near) {
      const total = near.count + g.count
      near.lab = {
        L: (near.lab.L * near.count + g.lab.L * g.count) / total,
        a: (near.lab.a * near.count + g.lab.a * g.count) / total,
        b: (near.lab.b * near.count + g.lab.b * g.count) / total,
      }
      near.count = total
    } else {
      merged.push({ ...g })
    }
  }
  return merged
}

/** Most different from each other, but weighted toward colors that cover more of the picture. */
function chooseDistinct(groups, k) {
  if (!groups.length) return []
  const total = groups.reduce((s, g) => s + g.count, 0)
  const maxShare = Math.max(...groups.map((g) => g.count)) / total
  const chosen = [groups.reduce((a, b) => (b.count > a.count ? b : a))]
  while (chosen.length < k) {
    let best = null
    let bestScore = 0
    for (const g of groups) {
      if (chosen.includes(g)) continue
      const gap = Math.min(...chosen.map((c) => oklabDistance(c.lab, g.lab)))
      if (gap < LIMITS.minPair) continue
      const share = Math.sqrt(g.count / total / maxShare) // 0..1
      const score = gap * (0.55 + 0.45 * share)
      if (score > bestScore) {
        bestScore = score
        best = g
      }
    }
    if (!best) break
    chosen.push(best)
  }
  return chosen
}

/** Distance from point p to the straight line segment a-b, in OKLab. */
function distanceToSegment(p, a, b) {
  const ab = { L: b.L - a.L, a: b.a - a.a, b: b.b - a.b }
  const ap = { L: p.L - a.L, a: p.a - a.a, b: p.b - a.b }
  const len2 = ab.L ** 2 + ab.a ** 2 + ab.b ** 2
  const t =
    len2 === 0 ? 0 : Math.min(1, Math.max(0, (ap.L * ab.L + ap.a * ab.a + ap.b * ab.b) / len2))
  return oklabDistance(p, { L: a.L + ab.L * t, a: a.a + ab.a * t, b: a.b + ab.b * t })
}

const MIN_SHARE = 0.01 // ignore colors covering less than 1% of the picture
const BLEND_MAX_SHARE = 0.06 // only small groups can be blends
const BLEND_DISTANCE = 0.025 // "on the line between two bigger colors"

/**
 * Drop colors that are not really in the photo. Shrinking a picture averages the pixels along
 * every edge, so a sky/grass border produces a row of in-between colors; and a speck covering a
 * fraction of a percent says nothing about the picture. Both would waste a stamp band.
 * If that leaves nothing, keep everything.
 */
function removeBlends(groups) {
  const total = groups.reduce((s, g) => s + g.count, 0)
  const big = groups.filter((g) => g.count / total >= MIN_SHARE)
  const kept = big.filter((g) => {
    if (g.count / total > BLEND_MAX_SHARE) return true
    for (const a of big) {
      for (const b of big) {
        if (a === b || a.count < g.count * 2 || b.count < g.count * 2) continue
        if (distanceToSegment(g.lab, a.lab, b.lab) < BLEND_DISTANCE) return false
      }
    }
    return true
  })
  return kept.length ? kept : groups
}

/** A nearly flat photo: fill the gaps with lighter and darker tints of what is there. */
function padWithTints(labs, k) {
  const out = [...labs]
  const steps = [0.14, -0.14, 0.28, -0.28, 0.07, -0.07, 0.4, -0.4, 0.2, -0.2]
  for (const step of steps) {
    for (const base of labs) {
      if (out.length >= k) return out
      const tint = {
        L: Math.min(0.97, Math.max(0.12, base.L + step)),
        a: base.a * 0.9,
        b: base.b * 0.9,
      }
      if (out.every((o) => oklabDistance(o, tint) >= LIMITS.minPair)) out.push(tint)
    }
  }
  return out
}

/**
 * Five distinct colors, dark to light.
 * @param {Uint8ClampedArray|number[]} rgba  pixel data, 4 values per pixel
 * @param {{ k?: number }} [options]
 * @returns {string[]} hex colors (always `k` of them, default 5)
 */
export function extractPalette(rgba, { k = 5 } = {}) {
  const pixels = collect(rgba)
  if (!pixels.length) return BLANK_PALETTE.map((c) => c.hex) // empty or fully transparent image

  const groups = mergeAlike(
    medianCut(pixels, BOXES).map((b) => ({ lab: tame(rgbToOklab(b.rgb)), count: b.count })),
  )
  let labs = chooseDistinct(removeBlends(groups), k).map((g) => g.lab)
  if (labs.length < k) labs = padWithTints(labs, k)
  // last resort (e.g. a pure white photo): spread lightness so five are still distinguishable
  for (let i = 1; labs.length < k; i++) {
    const L = Math.min(0.97, Math.max(0.12, 0.12 + (0.85 * labs.length) / k + i * 0.001))
    labs.push({ L, a: labs[0].a * 0.5, b: labs[0].b * 0.5 })
  }
  return orderForBanding(labs.slice(0, k).map(oklabToHex))
}

/** Dark to light: stamp bands read best as a gentle gradient, top to bottom. */
export function orderForBanding(hexes) {
  return [...hexes].sort((p, q) => hexToOklab(p).L - hexToOklab(q).L)
}

/** Average blocks of pixels down to at most `target` pixels on the long side. Pure, for tests and canvas-less use. */
export function downscale(rgba, width, height, target = 64) {
  const scale = Math.min(1, target / Math.max(width, height))
  const w = Math.max(1, Math.round(width * scale))
  const h = Math.max(1, Math.round(height * scale))
  const out = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const x0 = Math.floor((x * width) / w)
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) * width) / w))
      const y0 = Math.floor((y * height) / h)
      const y1 = Math.max(y0 + 1, Math.floor(((y + 1) * height) / h))
      const sum = [0, 0, 0, 0]
      let n = 0
      for (let yy = y0; yy < y1; yy++) {
        for (let xx = x0; xx < x1; xx++) {
          const o = (yy * width + xx) * 4
          for (let c = 0; c < 4; c++) sum[c] += rgba[o + c]
          n++
        }
      }
      for (let c = 0; c < 4; c++) out[(y * w + x) * 4 + c] = sum[c] / n
    }
  }
  return { data: out, width: w, height: h }
}

/** Five named colors for a photo: [{hex, name}] ready to store, with paletteSource 'photo'. */
export function paletteFromPixels(rgba) {
  const named = namePalette(extractPalette(rgba)).map(({ hex, name }) => ({ hex, name }))
  return { colors: named, paletteSource: 'photo' }
}

/**
 * Browser only: read an image file (from the photo picker or camera) into about-64px pixels.
 * Nothing is uploaded; the file is decoded and drawn on a small canvas on the device.
 */
export async function readImagePixels(file, target = 64) {
  const bitmap = await createImageBitmap(file) // applies the photo's rotation
  const scale = Math.min(1, target / Math.max(bitmap.width, bitmap.height))
  const w = Math.max(1, Math.round(bitmap.width * scale))
  const h = Math.max(1, Math.round(bitmap.height * scale))
  const canvas =
    typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(w, h)
      : document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close?.()
  return ctx.getImageData(0, 0, w, h).data
}

/** Browser only: file in, five named colors out. */
export async function paletteFromImageFile(file) {
  return paletteFromPixels(await readImagePixels(file))
}
