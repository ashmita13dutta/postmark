import { describe, expect, it } from 'vitest'
import {
  backgroundMask,
  cornersAreLight,
  cropObject,
  cutBackground,
  detectBackground,
  findObjects,
  hasTransparency,
  trimAlpha,
} from '../scripts/stickers/cutout.mjs'
import { decode, encodePng, imageSize, imageType } from '../scripts/stickers/image.mjs'

/** A white canvas, with solid rectangles painted on it. */
function canvas(w, h, rects = [], color = [200, 60, 50]) {
  const rgba = Buffer.alloc(w * h * 4, 255)
  for (const [x, y, rw, rh, c = color] of rects) {
    for (let j = y; j < y + rh; j++) {
      for (let i = x; i < x + rw; i++) {
        const o = (j * w + i) * 4
        rgba[o] = c[0]
        rgba[o + 1] = c[1]
        rgba[o + 2] = c[2]
        rgba[o + 3] = 255
      }
    }
  }
  return rgba
}
const alphaAt = (rgba, w, x, y) => rgba[(y * w + x) * 4 + 3]

describe('cutting the background', () => {
  it('makes the white around an object transparent and keeps the object', () => {
    const w = 60
    const h = 60
    const cut = cutBackground(canvas(w, h, [[20, 20, 20, 20]]), w, h)
    expect(alphaAt(cut, w, 2, 2)).toBe(0)
    expect(alphaAt(cut, w, 30, 30)).toBe(255)
  })

  it('removes a white pocket inside an object (the hole in a handle) but not a small highlight', () => {
    const w = 80
    const h = 80
    // a big red block with a 14x14 white hole, and a separate block with a 3x3 white highlight
    const rgba = canvas(w, h, [
      [10, 10, 40, 40],
      [60, 60, 15, 15],
    ])
    const paintWhite = (x0, y0, size) => {
      for (let j = y0; j < y0 + size; j++)
        for (let i = x0; i < x0 + size; i++) rgba.fill(255, (j * w + i) * 4, (j * w + i) * 4 + 4)
    }
    paintWhite(25, 25, 14) // hole
    paintWhite(66, 66, 3) // highlight
    const cut = cutBackground(rgba, w, h)
    expect(alphaAt(cut, w, 30, 30)).toBe(0) // the hole is see-through
    expect(alphaAt(cut, w, 67, 67)).toBeGreaterThan(0) // the highlight survives
  })

  it('has no light halo: an edge pixel takes the object color, not the blurry in-between', () => {
    const w = 40
    const h = 40
    const rgba = canvas(w, h, [[10, 10, 20, 20]])
    // a pale pinkish pixel just outside the object, as a JPEG leaves where red blurs into white
    rgba.set([230, 200, 190, 255], (9 * w + 20) * 4)
    const cut = cutBackground(rgba, w, h)
    const fringe = (9 * w + 20) * 4
    expect(cut[fringe + 3]).toBeLessThan(255) // soft, not solid
    expect(cut[fringe]).toBeLessThan(215) // recolored from the object (red is 200), not 230
    expect(cut[fringe + 1]).toBeLessThan(120) // and not the pale 200
  })

  it('reaches the border only through light pixels, so a dark frame protects its inside', () => {
    const w = 50
    const h = 50
    const rgba = canvas(w, h, [
      [10, 10, 30, 30, [20, 20, 20]],
      [20, 20, 10, 10, [250, 250, 250]],
    ])
    const bg = backgroundMask(rgba, w, h, { holeArea: 1000 })
    expect(bg[0]).toBe(1) // outside
    expect(bg[25 * w + 25]).toBe(0) // inside the frame, below the pocket-size limit
  })

  it('knows whether a picture still needs its background removed', () => {
    const w = 30
    const h = 30
    expect(cornersAreLight(canvas(w, h, [[10, 10, 5, 5]]), w, h)).toBe(true)
    expect(cornersAreLight(canvas(w, h, [[0, 0, 30, 30]]), w, h)).toBe(false)
    expect(hasTransparency(canvas(w, h))).toBe(false)
    expect(hasTransparency(cutBackground(canvas(w, h, [[10, 10, 5, 5]]), w, h))).toBe(true)
  })
})

describe('finding the objects on a sheet', () => {
  const w = 200
  const h = 120

  it('finds separate objects in reading order', () => {
    const rgba = canvas(w, h, [
      [120, 10, 30, 30], // top right
      [10, 10, 30, 30], // top left
      [10, 70, 30, 30], // bottom
    ])
    const { objects } = findObjects(rgba, w, h)
    expect(objects.map((o) => [o.x, o.y])).toEqual([
      [10, 10],
      [120, 10],
      [10, 70],
    ])
  })

  it('keeps parts that are close together as one object', () => {
    const rgba = canvas(w, h, [
      [10, 10, 30, 30],
      [43, 10, 30, 30], // 3px away, closer than the gap
    ])
    expect(findObjects(rgba, w, h, { gap: 5 }).objects).toHaveLength(1)
  })

  it('separates two objects that only touch, and keeps a thin part with its object', () => {
    // two blocks joined by a thin 2px bridge, plus a thin 'whisker' sticking out of the first
    const rgba = canvas(w, h, [
      [10, 40, 30, 30],
      [60, 40, 30, 30],
      [40, 54, 20, 2], // the bridge
      [4, 54, 6, 2], // the whisker
    ])
    const { objects, labels } = findObjects(rgba, w, h)
    expect(objects).toHaveLength(2)
    const whisker = labels[54 * w + 5]
    expect(whisker).toBe(labels[55 * w + 20]) // part of the left block
    expect(whisker).not.toBe(labels[55 * w + 80])
  })

  it('hands a small piece back to the big object it touches (a kettle handle)', () => {
    // a big block with a small block hanging off a thin neck: the neck is eroded away, so the small
    // block gets its own core, then rejoins because it is small and touching
    const rgba = canvas(w, h, [
      [20, 40, 60, 60], // big body
      [44, 24, 12, 12], // small handle
      [48, 36, 4, 4], // thin neck joining them
    ])
    const { objects } = findObjects(rgba, w, h, { minArea: 100 })
    expect(objects).toHaveLength(1)
    expect(objects[0].y).toBe(24)
  })

  it('does not swallow a small object that is not touching anything', () => {
    const rgba = canvas(w, h, [
      [20, 40, 60, 60],
      [150, 10, 14, 14],
    ])
    expect(findObjects(rgba, w, h, { minArea: 100 }).objects).toHaveLength(2)
  })

  it('cuts overlapping stickers apart along a line you give it', () => {
    // two big blocks sharing a wide seam: erosion alone cannot part them
    const rgba = canvas(w, h, [
      [20, 10, 60, 50],
      [20, 60, 60, 50],
    ])
    expect(findObjects(rgba, w, h, { minArea: 100 }).objects).toHaveLength(1)
    const { objects } = findObjects(rgba, w, h, { minArea: 100, cuts: [[10, 59, 90, 59]] })
    expect(objects).toHaveLength(2)
  })

  it('splits parts that are far apart, and ignores specks', () => {
    const rgba = canvas(w, h, [
      [10, 10, 30, 30],
      [80, 10, 30, 30],
      [160, 100, 3, 3], // a speck of dust
    ])
    expect(findObjects(rgba, w, h).objects).toHaveLength(2)
  })

  it('crops one object without its neighbour', () => {
    const rgba = canvas(w, h, [
      [10, 10, 30, 30],
      [38, 10, 12, 30, [30, 90, 200]], // overlaps the first object's box once grown
    ])
    const cut = cutBackground(rgba, w, h)
    const { objects, labels } = findObjects(rgba, w, h, { gap: 1 })
    expect(objects.length).toBeGreaterThanOrEqual(1)
    const first = cropObject(cut, w, objects[0], labels)
    expect(first.width).toBe(objects[0].width)
    expect(first.rgba.length).toBe(first.width * first.height * 4)
  })

  it('trims to the visible pixels and pads', () => {
    const rgba = Buffer.alloc(20 * 20 * 4)
    rgba.fill(255, (5 * 20 + 6) * 4, (5 * 20 + 6) * 4 + 4)
    const out = trimAlpha({ width: 20, height: 20, rgba }, 2)
    expect(out.width).toBe(1 + 4)
    expect(out.height).toBe(1 + 4)
    expect(out.rgba[(2 * out.width + 2) * 4 + 3]).toBe(255)
  })
})

describe('sheets on a grey or off-white background', () => {
  const w = 120
  const h = 90
  /** A plain-colored sheet with rectangles painted on it (each rect: x, y, w, h, color). */
  function sheet(bg, rects) {
    const rgba = Buffer.alloc(w * h * 4)
    for (let p = 0; p < w * h; p++) rgba.set([bg[0], bg[1], bg[2], 255], p * 4)
    for (const [x, y, rw, rh, c] of rects) {
      for (let j = y; j < y + rh; j++) {
        for (let i = x; i < x + rw; i++) rgba.set([c[0], c[1], c[2], 255], (j * w + i) * 4)
      }
    }
    return rgba
  }
  const grey = [228, 228, 228]

  it('finds the color a sheet was made on', () => {
    expect(detectBackground(sheet(grey, [[40, 30, 20, 20, [200, 60, 50]]]), w, h)).toEqual(grey)
    expect(detectBackground(sheet([252, 252, 252], []), w, h)).toEqual([252, 252, 252])
    expect(detectBackground(sheet([244, 244, 236], []), w, h)).toEqual([244, 244, 236])
  })

  it('says there is no plain background when the border is busy', () => {
    const rgba = Buffer.alloc(w * h * 4, 255)
    for (let p = 0; p < w * h; p++)
      rgba.set([(p * 37) % 256, (p * 91) % 256, (p * 53) % 256, 255], p * 4)
    expect(detectBackground(rgba, w, h)).toBeNull()
  })

  it('treats the grey as background and keeps a sticker’s own white border', () => {
    // a red sticker with a 3px white border, on grey
    const rgba = sheet(grey, [
      [30, 20, 40, 40, [255, 255, 255]],
      [33, 23, 34, 34, [200, 60, 50]],
    ])
    const cut = cutBackground(rgba, w, h, { bg: grey })
    expect(alphaAt(cut, w, 5, 5)).toBe(0) // the grey
    expect(alphaAt(cut, w, 50, 40)).toBe(255) // the sticker
    expect(alphaAt(cut, w, 35, 25)).toBe(255) // inside the white border, kept as part of it
  })

  it('finds the separate stickers on a grey sheet', () => {
    const rgba = sheet(grey, [
      [10, 10, 30, 30, [200, 60, 50]],
      [70, 10, 30, 30, [50, 90, 200]],
      [40, 55, 30, 25, [60, 160, 90]],
    ])
    const { objects } = findObjects(rgba, w, h, { bg: grey, minArea: 100 })
    expect(objects.map((o) => [o.x, o.y])).toEqual([
      [10, 10],
      [70, 10],
      [40, 55],
    ])
  })

  it('without a background color, a grey sheet is not understood (so the old rule needs white)', () => {
    const rgba = sheet(grey, [[40, 30, 20, 20, [200, 60, 50]]])
    expect(findObjects(rgba, w, h, { minArea: 100 }).objects).toHaveLength(1) // the whole sheet
  })
})

describe('image reading and writing', { timeout: 30_000 }, () => {
  it('writes a PNG that reads back exactly, alpha included', () => {
    const w = 7
    const h = 5
    const rgba = Buffer.alloc(w * h * 4)
    for (let i = 0; i < w * h; i++) rgba.set([i * 5, 255 - i * 3, 40, i % 2 ? 255 : 120], i * 4)
    const png = encodePng(w, h, rgba)
    expect(imageType(png)).toBe('png')
    expect(imageSize(png)).toEqual({ width: w, height: h })
    const back = decode(png)
    expect(back.width).toBe(w)
    expect(back.height).toBe(h)
    // semi-transparent pixels survive the premultiply round trip to within rounding
    for (let i = 0; i < rgba.length; i++)
      expect(Math.abs(back.rgba[i] - rgba[i])).toBeLessThanOrEqual(2)
  })

  it('refuses something that is not an image', () => {
    expect(imageType(Buffer.from('hello world, definitely not a picture'))).toBeNull()
    expect(() => decode(Buffer.from('hello world, definitely not a picture'))).toThrow()
  })
})
