/**
 * TIFF is not a format browsers open, so a scan or an export from an editing app is decoded here
 * (with the small `utif` reader) into plain pixels. Loaded on demand, only when a TIFF is picked.
 */
import * as UTIF from 'utif'

/**
 * @param {ArrayBuffer} buffer the whole file
 * @returns {{ width: number, height: number, data: Uint8ClampedArray }} RGBA pixels of the largest page
 */
export function decodeTiff(buffer) {
  const pages = UTIF.decode(buffer)
  if (!pages.length) throw new Error('no picture in this TIFF')
  // a TIFF can hold several pages (a thumbnail, a scan's pages): take the biggest
  let best = pages[0]
  for (const page of pages) if (page.width * page.height > best.width * best.height) best = page
  UTIF.decodeImage(buffer, best, pages)
  if (!(best.width > 0 && best.height > 0)) throw new Error('no picture in this TIFF')
  const rgba = UTIF.toRGBA8(best)
  return { width: best.width, height: best.height, data: new Uint8ClampedArray(rgba) }
}
