/**
 * Photos: sizes and layouts (pure, tested) and the browser code that decodes, filters and compresses
 * them. A photo never leaves the phone. On import the longest edge is 1600 px at JPEG quality 0.8,
 * with a 320 px thumbnail beside it (spec section 10). A film strip is 3 or 4 frames on a white
 * photo-booth printout.
 */
import { applyFilter } from './photoFilters'
import { seededRng } from './rng'

export const MAX_EDGE = 1600
export const THUMB_EDGE = 320
export const JPEG_QUALITY = 0.8

/** Fit a size inside `max` on its longest edge, keeping its shape and never scaling up. */
export function fitWithin(width, height, max) {
  const scale = Math.min(1, max / Math.max(width, height))
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

/** The part of a source to draw so it fills a box without stretching (like CSS `object-fit: cover`). */
export function coverRect(srcW, srcH, boxW, boxH) {
  const boxRatio = boxW / boxH
  const srcRatio = srcW / srcH
  if (srcRatio > boxRatio) {
    const w = srcH * boxRatio
    return { x: (srcW - w) / 2, y: 0, w, h: srcH }
  }
  const h = srcW / boxRatio
  return { x: 0, y: (srcH - h) / 2, w: srcW, h }
}

/**
 * A photo-booth printout: frames stacked top to bottom between white borders, with a little room at
 * the foot for the date. Returns the printout's size and each frame's rectangle.
 */
export function stripLayout(frames, { frameW = 560, border = 34, gap = 26, footer = 96 } = {}) {
  const frameH = Math.round(frameW * 0.75)
  const width = frameW + 2 * border
  const rects = Array.from({ length: frames }, (_, i) => ({
    x: border,
    y: border + i * (frameH + gap),
    w: frameW,
    h: frameH,
  }))
  const height = border + frames * frameH + (frames - 1) * gap + footer
  return { width, height, frames: rects, footerY: height - footer }
}

/**
 * Where a photo sits behind its stamp (spec section 10): turned by about -6 to 8 degrees (steady for a
 * given seed) and slid out so a bit under a third of it shows beside the stamp. Back is the
 * postcard's other side, where it is mirrored. Numbers are fractions of the stamp's width, so it
 * looks the same at any size.
 * `visible` is the fraction of the photo that shows; `x` is for a photo of the standard `width` (a
 * narrower one, like a film strip, can use `peekX`).
 * @returns {{ rotate: number, x: number, y: number, width: number, side: 1 | -1, visible: number }}
 */
export function peekGeometry(seed, back = false) {
  const rnd = seededRng(`peek:${seed}`)
  const rotate = -6 + rnd() * 14
  const width = 0.9
  const visible = 0.27 + rnd() * 0.06 // 27% to 33% of the photo shows
  const side = back ? -1 : 1
  // the photo's left edge, as a fraction of the stamp's width: tucked in so only `visible` sticks out
  const x = side === 1 ? 1 - width * (1 - visible) : -width * visible
  const y = (rnd() - 0.5) * 0.16
  return { rotate: back ? -rotate : rotate, x, y, width, side, visible }
}

/** Where the left edge goes for a photo of any `width` (a fraction of the stamp's), so the same share shows. */
export function peekX({ side, visible }, width) {
  return side === 1 ? 1 - width * (1 - visible) : -width * visible
}

// ---- browser only from here ----

async function decode(file) {
  // 'from-image' applies the camera's rotation, so a portrait photo is not sideways
  return createImageBitmap(file, { imageOrientation: 'from-image' })
}

function canvasOf(width, height) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

const toBlob = (canvas, quality = JPEG_QUALITY) =>
  new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Could not make the picture'))),
      'image/jpeg',
      quality,
    ),
  )

/** Decode picked files into bitmaps. Throws a plain message if one is not a picture. */
export async function openPhotos(files) {
  try {
    return await Promise.all([...files].map(decode))
  } catch {
    throw new Error('That does not look like a photo this phone can open.')
  }
}

/** Draw a bitmap to fill a box on a context, cropping to fit. */
function drawCover(ctx, bitmap, x, y, w, h) {
  const r = coverRect(bitmap.width, bitmap.height, w, h)
  ctx.drawImage(bitmap, r.x, r.y, r.w, r.h, x, y, w, h)
}

/** Filter a region of a canvas in place. */
function filterRegion(ctx, x, y, w, h, options) {
  if (options.filter === 'none' || options.intensity === 0) return
  const image = ctx.getImageData(x, y, w, h)
  image.data.set(applyFilter(image.data, w, h, options))
  ctx.putImageData(image, x, y)
}

/**
 * Make the picture: one photo (its own shape) or a film strip, filtered. `maxEdge` is how big to
 * make it (small for a live preview, MAX_EDGE for the one that is kept).
 * @param {ImageBitmap[]} bitmaps one for a single photo, 3 or 4 for a strip
 * @param {{ kind: 'single' | 'strip', filter: string, intensity: number, seed: string, caption?: string }} o
 * @returns {HTMLCanvasElement}
 */
export function renderPhoto(
  bitmaps,
  { kind, filter, intensity, seed, caption = '' },
  maxEdge = MAX_EDGE,
) {
  const options = { filter, intensity, seed }
  if (kind === 'strip') {
    const layout = stripLayout(bitmaps.length)
    const scale = Math.min(1, maxEdge / layout.height)
    const canvas = canvasOf(Math.round(layout.width * scale), Math.round(layout.height * scale))
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    ctx.scale(scale, scale)
    ctx.fillStyle = '#FBF9F3'
    ctx.fillRect(0, 0, layout.width, layout.height)
    layout.frames.forEach((r, i) => drawCover(ctx, bitmaps[i], r.x, r.y, r.w, r.h))
    // the filter goes over the frames only, never the white border
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    layout.frames.forEach((r) =>
      filterRegion(
        ctx,
        Math.round(r.x * scale),
        Math.round(r.y * scale),
        Math.round(r.w * scale),
        Math.round(r.h * scale),
        options,
      ),
    )
    if (caption) {
      ctx.setTransform(scale, 0, 0, scale, 0, 0)
      ctx.fillStyle = 'rgba(42, 38, 32, 0.55)'
      ctx.font = '500 30px "JetBrains Mono", ui-monospace, monospace'
      ctx.textAlign = 'center'
      ctx.fillText(caption, layout.width / 2, layout.footerY + 58)
    }
    return canvas
  }
  const b = bitmaps[0]
  const size = fitWithin(b.width, b.height, maxEdge)
  const canvas = canvasOf(size.width, size.height)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(b, 0, 0, size.width, size.height)
  filterRegion(ctx, 0, 0, size.width, size.height, options)
  return canvas
}

/** The kept version: the full picture and its thumbnail, as JPEG blobs. */
export async function finishPhoto(bitmaps, settings) {
  const full = renderPhoto(bitmaps, settings, MAX_EDGE)
  const small = renderPhoto(bitmaps, settings, THUMB_EDGE)
  return { blob: await toBlob(full), thumb: await toBlob(small, 0.75) }
}

/**
 * Pixels to read a palette from: the originals (not the filtered picture), each shrunk to 64 px and
 * joined, so a strip gives one palette for all its frames. Returns RGBA bytes.
 */
export function pixelsForPalette(bitmaps, target = 64) {
  const parts = bitmaps.map((b) => {
    const size = fitWithin(b.width, b.height, target)
    const canvas = canvasOf(size.width, size.height)
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    ctx.drawImage(b, 0, 0, size.width, size.height)
    return ctx.getImageData(0, 0, size.width, size.height).data
  })
  const out = new Uint8ClampedArray(parts.reduce((n, p) => n + p.length, 0))
  let at = 0
  for (const p of parts) {
    out.set(p, at)
    at += p.length
  }
  return out
}
