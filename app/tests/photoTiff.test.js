import * as UTIF from 'utif'
import { describe, expect, it } from 'vitest'
import { sniffFormat } from '../src/lib/photoFormat'
import { decodeTiff } from '../src/lib/photoTiff'

/** A small RGBA picture: left half red, right half blue, one green pixel at the top left. */
function picture(w, h) {
  const data = new Uint8Array(w * h * 4)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      data.set(x < w / 2 ? [220, 30, 30, 255] : [30, 40, 210, 255], i)
    }
  data.set([20, 200, 20, 255], 0)
  return data
}

describe('decodeTiff', () => {
  it('reads the pixels of a TIFF back, in the right places', () => {
    const w = 16
    const h = 8
    const file = UTIF.encodeImage(picture(w, h), w, h)
    expect(sniffFormat(new Uint8Array(file))).toBe('tiff')
    const out = decodeTiff(file)
    expect([out.width, out.height]).toEqual([w, h])
    expect(out.data).toBeInstanceOf(Uint8ClampedArray)
    const at = (x, y) => [...out.data.slice((y * w + x) * 4, (y * w + x) * 4 + 4)]
    expect(at(0, 0)).toEqual([20, 200, 20, 255])
    expect(at(3, 4)).toEqual([220, 30, 30, 255])
    expect(at(12, 4)).toEqual([30, 40, 210, 255])
  })

  it('refuses something that is not a TIFF', () => {
    expect(() => decodeTiff(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]).buffer)).toThrow()
  })
})
