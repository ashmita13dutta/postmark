/**
 * Which kind of picture a file is, read from its first bytes (not its name or its type, which are
 * often empty or wrong: a HEIC photo picked on Windows has no type at all). Pure, so it is tested
 * without a browser.
 */

/** Plain-language names, for messages. */
export const FORMAT_NAMES = {
  jpeg: 'JPEG',
  png: 'PNG',
  gif: 'GIF',
  webp: 'WebP',
  avif: 'AVIF',
  heic: 'HEIC',
  bmp: 'BMP',
  tiff: 'TIFF',
  svg: 'SVG',
}

const ascii = (bytes, from, to) => String.fromCharCode(...bytes.slice(from, to))

// the "brand" of an ISO media file (bytes 8 to 12) says whether it is HEIC or AVIF
const HEIC_BRANDS = new Set([
  'heic',
  'heix',
  'hevc',
  'hevx',
  'heim',
  'heis',
  'hevm',
  'hevs',
  'mif1',
  'msf1',
])
const AVIF_BRANDS = new Set(['avif', 'avis'])

/**
 * @param {Uint8Array} bytes the first 32 bytes or more of the file
 * @returns {'jpeg'|'png'|'gif'|'webp'|'avif'|'heic'|'bmp'|'tiff'|'svg'|null} null when it is not a picture we know
 */
export function sniffFormat(bytes) {
  if (!bytes || bytes.length < 4) return null
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg'
  if (bytes[0] === 0x89 && ascii(bytes, 1, 4) === 'PNG') return 'png'
  if (ascii(bytes, 0, 4) === 'GIF8') return 'gif'
  if (ascii(bytes, 0, 4) === 'RIFF' && bytes.length >= 12 && ascii(bytes, 8, 12) === 'WEBP')
    return 'webp'
  if (bytes[0] === 0x42 && bytes[1] === 0x4d) return 'bmp'
  const little = bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2a && bytes[3] === 0
  const big = bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[2] === 0 && bytes[3] === 0x2a
  if (little || big) return 'tiff'
  if (bytes.length >= 12 && ascii(bytes, 4, 8) === 'ftyp') {
    const brand = ascii(bytes, 8, 12)
    if (AVIF_BRANDS.has(brand)) return 'avif'
    if (HEIC_BRANDS.has(brand)) return 'heic'
  }
  const head = ascii(bytes, 0, Math.min(bytes.length, 32)).trimStart()
  if (head.startsWith('<svg') || head.startsWith('<?xml')) return 'svg'
  return null
}

/**
 * What to tell the person when a picture could not be opened.
 * @param {string|null} format what sniffFormat said
 * @param {{ heicTried?: boolean, offline?: boolean }} [what]
 */
export function unreadableMessage(format, { heicTried = false, offline = false } = {}) {
  if (format === 'heic') {
    return offline
      ? 'This HEIC photo needs a one-time download to open, and you look offline. Connect once and try again, or pick it from Photos (it is converted for you).'
      : heicTried
        ? 'This HEIC photo could not be opened. Try picking it from Photos, which converts it for you, or save a copy as JPEG.'
        : 'This phone cannot open HEIC photos directly. Pick it from Photos, which converts it for you.'
  }
  if (format === 'tiff' || format === 'bmp' || format === 'svg' || format === 'avif')
    return `This looks like a ${FORMAT_NAMES[format]} file, which this browser cannot open here. Try a JPEG or PNG copy.`
  return 'That does not look like a photo this phone can open.'
}

/**
 * The `accept` list for a photo picker. iPhones convert HEIC to JPEG on their own when the list is
 * just "image/*" (and listing HEIC there turns that off), so only other devices get the extra types.
 */
export function photoAccept(
  userAgent = typeof navigator === 'undefined' ? '' : navigator.userAgent,
) {
  const apple = /iPhone|iPad|iPod/.test(userAgent)
  return apple ? 'image/*' : 'image/*,.heic,.heif,.avif'
}
