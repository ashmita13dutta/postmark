/*
 * Tiny image toolkit for the sticker scripts, with no extra dependencies:
 *   - imageSize:  width and height from a PNG, JPEG or WebP header
 *   - decode:     any of those to straight (non-premultiplied) RGBA pixels, using the SVG renderer we
 *                 already ship (@resvg/resvg-js), which can draw raster images
 *   - encodePng:  RGBA pixels to a PNG file, using fflate for the compression
 */
import { Resvg } from '@resvg/resvg-js'
import { zlibSync } from 'fflate'

const MIME = { png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp' }

/** 'png' | 'jpeg' | 'webp' | null, from the first bytes. */
export function imageType(buf) {
  if (buf.length > 8 && buf.readUInt32BE(0) === 0x89504e47) return 'png'
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8) return 'jpeg'
  if (
    buf.length > 12 &&
    buf.toString('ascii', 0, 4) === 'RIFF' &&
    buf.toString('ascii', 8, 12) === 'WEBP'
  )
    return 'webp'
  return null
}

/** { width, height } read from the file header, or null when the format is not understood. */
export function imageSize(buf) {
  const type = imageType(buf)
  if (type === 'png') return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
  if (type === 'jpeg') {
    let i = 2
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) {
        i++
        continue
      }
      const marker = buf[i + 1]
      // start-of-frame markers carry the size (C4, C8 and CC are not frames)
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker))
        return { width: buf.readUInt16BE(i + 7), height: buf.readUInt16BE(i + 5) }
      i += 2 + buf.readUInt16BE(i + 2)
    }
    return null
  }
  if (type === 'webp') {
    const kind = buf.toString('ascii', 12, 16)
    if (kind === 'VP8X')
      return { width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) }
    if (kind === 'VP8L') {
      const bits = buf.readUInt32LE(21)
      return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >> 14) & 0x3fff) }
    }
    if (kind === 'VP8 ')
      return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff }
  }
  return null
}

/** Pixels of an image file: { width, height, rgba } with straight (not premultiplied) alpha. */
export function decode(buf) {
  const type = imageType(buf)
  const size = imageSize(buf)
  if (!type || !size) throw new Error('Not a PNG, JPEG or WebP image')
  const { width, height } = size
  const href = `data:${MIME[type]};base64,${buf.toString('base64')}`
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ` +
    `width="${width}" height="${height}"><image xlink:href="${href}" width="${width}" height="${height}"/></svg>`
  const out = new Resvg(svg).render()
  if (out.width !== width || out.height !== height)
    throw new Error(`Decoded size ${out.width}x${out.height} does not match ${width}x${height}`)
  return { width, height, rgba: unpremultiply(Buffer.from(out.pixels)) }
}

/** The renderer hands back premultiplied pixels; undo that so colors are the real colors. */
function unpremultiply(rgba) {
  for (let i = 0; i < rgba.length; i += 4) {
    const a = rgba[i + 3]
    if (a > 0 && a < 255) {
      rgba[i] = Math.min(255, Math.round((rgba[i] * 255) / a))
      rgba[i + 1] = Math.min(255, Math.round((rgba[i + 1] * 255) / a))
      rgba[i + 2] = Math.min(255, Math.round((rgba[i + 2] * 255) / a))
    }
  }
  return rgba
}

/** Scale RGBA pixels to a new size with the renderer's smooth resampling. */
export function resize({ width, height, rgba }, newWidth, newHeight) {
  const href = `data:image/png;base64,${encodePng(width, height, rgba).toString('base64')}`
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ` +
    `width="${newWidth}" height="${newHeight}"><image xlink:href="${href}" width="${newWidth}" ` +
    `height="${newHeight}" preserveAspectRatio="none"/></svg>`
  const out = new Resvg(svg).render()
  return { width: newWidth, height: newHeight, rgba: unpremultiply(Buffer.from(out.pixels)) }
}

// ---- PNG writer ----

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(bytes) {
  let c = 0xffffffff
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length)
  out.writeUInt32BE(data.length, 0)
  out.write(type, 4, 'ascii')
  data.copy(out, 8)
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length)
  return out
}

/** A PNG file (8-bit RGBA) from straight RGBA pixels. */
export function encodePng(width, height, rgba) {
  const stride = width * 4
  // each row gets a "Sub" filter byte: it compresses smooth gradients (3D shading) much better
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    const row = y * (stride + 1)
    raw[row] = 1
    for (let x = 0; x < stride; x++) {
      const left = x >= 4 ? rgba[y * stride + x - 4] : 0
      raw[row + 1 + x] = (rgba[y * stride + x] - left) & 0xff
    }
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8 // bit depth
  header[9] = 6 // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', Buffer.from(zlibSync(raw, { level: 9 }))),
    chunk('IEND', Buffer.alloc(0)),
  ])
}
