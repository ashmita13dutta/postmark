/*
 * Sticker files that are used as they are, with no re-drawing: SVG and WebP.
 *   - svgSize:   the shape (width and height) of an SVG, from its viewBox or its width and height
 *   - svgProblem: why an SVG should not be published, or null (scripts would run if someone opened
 *                the file by its address, even though they stay inert inside the app's <img>)
 *   - webpInfo:  size and whether a WebP file has a see-through channel
 * No dependencies; the rest of the sticker tools live in image.mjs.
 */
import { imageSize, imageType } from './image.mjs'

/** The longest side a drawn (SVG) sticker is recorded at. Only its shape matters; it scales freely. */
const SVG_EDGE = 256

const num = (text) => {
  const n = parseFloat(text)
  return Number.isFinite(n) && n > 0 ? n : null
}

/** { width, height } scaled so the longest side is 256, or null when no shape can be found. */
export function svgSize(text) {
  const tag = /<svg\b[^>]*>/i.exec(text)?.[0]
  if (!tag) return null
  const attr = (name) => new RegExp(`\\s${name}\\s*=\\s*["']([^"']+)["']`, 'i').exec(tag)?.[1]
  let w = null
  let h = null
  const box = attr('viewBox')
    ?.trim()
    .split(/[\s,]+/)
    .map(Number)
  if (box?.length === 4 && box[2] > 0 && box[3] > 0) {
    w = box[2]
    h = box[3]
  } else {
    // a percentage ("100%") says nothing about the shape, so only plain numbers and px count
    const wa = attr('width')
    const ha = attr('height')
    if (wa && ha && !wa.includes('%') && !ha.includes('%')) {
      w = num(wa)
      h = num(ha)
    }
  }
  if (!w || !h) return null
  const k = SVG_EDGE / Math.max(w, h)
  return { width: Math.max(1, Math.round(w * k)), height: Math.max(1, Math.round(h * k)) }
}

/** A sentence about what is wrong with this SVG, or null when it is fine to publish. */
export function svgProblem(text) {
  if (/<script\b/i.test(text)) return 'it contains a <script>'
  if (/\son[a-z]+\s*=/i.test(tagsOnly(text))) return 'it has event handlers (onclick and the like)'
  return null
}

/** Just the tags, so words inside <text> or <style> content are not mistaken for attributes. */
const tagsOnly = (text) => (text.match(/<[^>]+>/g) ?? []).join('')

/**
 * { width, height, alpha, animated } of a WebP file, or null if it is not one. `alpha` is true when
 * the file says it has a see-through channel; a WebP without one is a plain picture and still needs
 * its background cut out.
 */
export function webpInfo(buf) {
  if (imageType(buf) !== 'webp') return null
  const size = imageSize(buf)
  if (!size) return null
  const kind = buf.toString('ascii', 12, 16)
  if (kind === 'VP8X') {
    const flags = buf[20]
    return { ...size, alpha: Boolean(flags & 0x10), animated: Boolean(flags & 0x02) }
  }
  if (kind === 'VP8L') {
    // "alpha is used" is bit 28 of the 32-bit header word that holds the size
    return { ...size, alpha: Boolean((buf.readUInt32LE(21) >>> 28) & 1), animated: false }
  }
  return { ...size, alpha: false, animated: false }
}
