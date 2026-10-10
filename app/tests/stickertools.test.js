import { spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { svgProblem, svgSize, webpInfo } from '../scripts/stickers/formats.mjs'
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

// ---- SVG and WebP stickers, kept as they are ----

/** Just the header of a WebP file: enough for the sticker tools, which never draw these files. */
function webpHeader(kind, { width, height, alpha = false, animated = false }) {
  const buf = Buffer.alloc(40)
  buf.write('RIFF', 0, 'ascii')
  buf.writeUInt32LE(32, 4)
  buf.write('WEBP', 8, 'ascii')
  if (kind === 'VP8X') {
    buf.write('VP8X', 12, 'ascii')
    buf.writeUInt32LE(10, 16)
    buf[20] = (alpha ? 0x10 : 0) | (animated ? 0x02 : 0)
    buf.writeUIntLE(width - 1, 24, 3)
    buf.writeUIntLE(height - 1, 27, 3)
  } else if (kind === 'VP8L') {
    buf.write('VP8L', 12, 'ascii')
    buf.writeUInt32LE(5, 16)
    buf[20] = 0x2f
    buf.writeUInt32LE(((alpha ? 1 : 0) << 28) | ((height - 1) << 14) | (width - 1), 21)
  } else {
    buf.write('VP8 ', 12, 'ascii')
    buf.writeUInt32LE(10, 16)
    buf.set([0x9d, 0x01, 0x2a], 23)
    buf.writeUInt16LE(width, 26)
    buf.writeUInt16LE(height, 28)
  }
  return buf
}

describe('SVG stickers', () => {
  it('takes the shape from the viewBox, scaled so the long side is 256', () => {
    expect(svgSize('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50"></svg>')).toEqual({
      width: 256,
      height: 128,
    })
    expect(svgSize(`<svg viewBox='0, 0, 40, 80' width="999" height="1"/>`)).toEqual({
      width: 128,
      height: 256,
    })
  })

  it('falls back to width and height, but not to percentages', () => {
    expect(svgSize('<svg width="120px" height="60"></svg>')).toEqual({ width: 256, height: 128 })
    expect(svgSize('<svg width="100%" height="100%"></svg>')).toBeNull()
    expect(svgSize('<svg></svg>')).toBeNull()
    expect(svgSize('not an svg at all')).toBeNull()
  })

  it('refuses scripts and event handlers, but not words that only look like them', () => {
    expect(svgProblem('<svg viewBox="0 0 1 1"><script>alert(1)</script></svg>')).toMatch(/script/)
    expect(svgProblem('<svg viewBox="0 0 1 1"><rect onclick="x()"/></svg>')).toMatch(/event/)
    expect(svgProblem('<svg viewBox="0 0 1 1"><text>onclick = nothing</text></svg>')).toBeNull()
    expect(svgProblem('<svg viewBox="0 0 1 1"><circle r="1"/></svg>')).toBeNull()
  })
})

describe('WebP stickers', () => {
  it('reads the size and whether there is a see-through channel, from any of the three layouts', () => {
    expect(webpInfo(webpHeader('VP8X', { width: 300, height: 200, alpha: true }))).toEqual({
      width: 300,
      height: 200,
      alpha: true,
      animated: false,
    })
    expect(webpInfo(webpHeader('VP8X', { width: 300, height: 200 }))).toMatchObject({
      alpha: false,
    })
    expect(webpInfo(webpHeader('VP8X', { width: 8, height: 8, animated: true }))).toMatchObject({
      animated: true,
    })
    expect(webpInfo(webpHeader('VP8L', { width: 123, height: 77, alpha: true }))).toMatchObject({
      width: 123,
      height: 77,
      alpha: true,
    })
    expect(webpInfo(webpHeader('VP8L', { width: 123, height: 77 }))).toMatchObject({ alpha: false })
    // a plain lossy WebP cannot be see-through
    expect(webpInfo(webpHeader('VP8 ', { width: 64, height: 48 }))).toEqual({
      width: 64,
      height: 48,
      alpha: false,
      animated: false,
    })
  })

  it('is null for anything that is not a WebP', () => {
    expect(webpInfo(Buffer.from('hello'))).toBeNull()
    expect(webpInfo(encodePng(1, 1, Buffer.from([1, 2, 3, 255])))).toBeNull()
  })
})

describe('building a pack of SVG and WebP stickers', { timeout: 60_000 }, () => {
  let dir
  /** Runs the build script on the temp folder; returns everything it printed, warnings included. */
  const run = () => {
    const out = spawnSync(process.execPath, [resolve(__dirname, '../scripts/build-stickers.mjs')], {
      env: { ...process.env, STICKER_ROOT: dir },
      encoding: 'utf8',
    })
    expect(out.status, out.stderr).toBe(0)
    return out.stdout + out.stderr
  }
  const manifest = () =>
    JSON.parse(readFileSync(resolve(dir, 'src/data/sticker-packs.json'), 'utf8'))

  beforeAll(() => {
    dir = mkdtempSync(resolve(tmpdir(), 'postmark-stickers-'))
    mkdirSync(resolve(dir, 'src/data'), { recursive: true })
    mkdirSync(resolve(dir, 'stickers-src/marks'), { recursive: true })
    // an ink pack that already exists, with a name the owner wrote by hand
    writeFileSync(
      resolve(dir, 'src/data/sticker-packs.json'),
      JSON.stringify({
        about: 'x',
        packs: [
          {
            id: 'marks',
            label: 'Postal marks',
            ink: true,
            stickers: [{ file: 'round', label: 'My round mark', keywords: ['mine'], w: 1, h: 1 }],
          },
        ],
      }),
    )
    const src = resolve(dir, 'stickers-src/marks')
    writeFileSync(
      resolve(src, 'round.svg'),
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 60"><circle cx="30" cy="30" r="25"/></svg>',
    )
    writeFileSync(
      resolve(src, 'airmail.webp'),
      webpHeader('VP8X', { width: 400, height: 160, alpha: true }),
    )
    writeFileSync(
      resolve(src, 'evil.svg'),
      '<svg viewBox="0 0 1 1"><script>alert(1)</script></svg>',
    )
    writeFileSync(
      resolve(src, 'plain.png'),
      encodePng(8, 6, Buffer.alloc(8 * 6 * 4, 255).fill(0, 0, 4)),
    )
  })
  afterAll(() => rmSync(dir, { recursive: true, force: true }))

  it('copies SVG and see-through WebP untouched, and turns a PNG into a PNG', () => {
    const out = run()
    expect(out).toMatch(/skipped evil\.svg: it contains a <script>/)
    const pub = resolve(dir, 'public/stickers/marks')
    expect(readdirSync(pub).sort()).toEqual(['airmail.webp', 'plain.png', 'round.svg'])
    expect(readFileSync(resolve(pub, 'round.svg'), 'utf8')).toContain('<circle')
    expect(imageType(readFileSync(resolve(pub, 'airmail.webp')))).toBe('webp')
  })

  it('lists them with their file type and shape, keeps the owner’s words and the ink flag', () => {
    const pack = manifest().packs[0]
    expect(pack).toMatchObject({ id: 'marks', label: 'Postal marks', ink: true })
    const by = Object.fromEntries(pack.stickers.map((s) => [s.file, s]))
    expect(by.round).toMatchObject({
      label: 'My round mark',
      keywords: ['mine'],
      ext: 'svg',
      w: 256,
      h: 171,
    })
    expect(by.airmail).toMatchObject({ ext: 'webp', w: 400, h: 160 })
    expect(by.plain.ext).toBeUndefined() // PNG is the default, so it is not written down
    expect(by.evil).toBeUndefined()
  })

  it('leaves no old copy behind when a picture is re-made in another format', () => {
    const pub = resolve(dir, 'public/stickers/marks')
    rmSync(resolve(dir, 'stickers-src/marks/round.svg'))
    writeFileSync(
      resolve(dir, 'stickers-src/marks/round.png'),
      encodePng(8, 8, Buffer.alloc(8 * 8 * 4, 0).fill(255, 0, 4)),
    )
    run()
    expect(existsSync(resolve(pub, 'round.svg'))).toBe(false)
    expect(existsSync(resolve(pub, 'round.png'))).toBe(true)
    const round = manifest().packs[0].stickers.find((s) => s.file === 'round')
    expect(round.ext).toBeUndefined()
    expect(round.label).toBe('My round mark')
  })
})
