/*
 * Pixel work for stickers, all on plain RGBA buffers so it can be tested without any image file:
 *   detectBackground  the flat color a sheet was made on (white, off-white, light grey...)
 *   cutBackground     turn that background transparent (and tidy the fringe)
 *   findObjects       find the separate objects on a sheet
 *   cropObject        cut one object out with its own transparency
 *   trimAlpha         shrink to the visible pixels
 *   hasTransparency / cornersAreLight   decide whether an image still needs its background removed
 *
 * Without a `bg` color the background is taken to be near white. With `bg` ([r, g, b], from
 * detectBackground) any pixel within `tol` of that color counts, so grey sheets work too.
 */

const idx = (w, x, y) => (y * w + x) * 4
const minChannel = (rgba, i) => Math.min(rgba[i], rgba[i + 1], rgba[i + 2])
/** The biggest difference in any one channel between a pixel and a color. */
const maxDiff = (rgba, i, c) =>
  Math.max(Math.abs(rgba[i] - c[0]), Math.abs(rgba[i + 1] - c[1]), Math.abs(rgba[i + 2] - c[2]))

/**
 * The color a sheet was made on, read from the picture's border: the most common color there, if it
 * covers most of the border. Returns [r, g, b], or null when the border is not one flat color (a
 * photo with no plain background).
 */
export function detectBackground(rgba, w, h, share = 0.6) {
  const bins = new Map()
  const border = []
  for (let x = 0; x < w; x++) border.push(idx(w, x, 0), idx(w, x, h - 1))
  for (let y = 1; y < h - 1; y++) border.push(idx(w, 0, y), idx(w, w - 1, y))
  for (const i of border) {
    const key = ((rgba[i] >> 3) << 10) | ((rgba[i + 1] >> 3) << 5) | (rgba[i + 2] >> 3)
    const bin = bins.get(key) ?? { n: 0, r: 0, g: 0, b: 0 }
    bin.n++
    bin.r += rgba[i]
    bin.g += rgba[i + 1]
    bin.b += rgba[i + 2]
    bins.set(key, bin)
  }
  let best = null
  for (const bin of bins.values()) if (!best || bin.n > best.n) best = bin
  if (!best) return null
  const color = [
    Math.round(best.r / best.n),
    Math.round(best.g / best.n),
    Math.round(best.b / best.n),
  ]
  // count everything close to that color, so noise across a bin edge does not split the vote
  const close = border.filter((i) => maxDiff(rgba, i, color) <= 10).length
  return close / border.length >= share ? color : null
}

/** True when any pixel is not fully opaque. */
export function hasTransparency(rgba) {
  for (let i = 3; i < rgba.length; i += 4) if (rgba[i] < 250) return true
  return false
}

/** True when the four corners are near white (a sticker photographed or exported on white). */
export function cornersAreLight(rgba, w, h, white = 238) {
  return [
    [0, 0],
    [w - 1, 0],
    [0, h - 1],
    [w - 1, h - 1],
  ].every(([x, y]) => minChannel(rgba, idx(w, x, y)) >= white && rgba[idx(w, x, y) + 3] > 200)
}

/** Flood fill: marks every pixel reachable from `seeds` through pixels where `ok(i)` holds. */
function flood(w, h, seeds, ok, mark) {
  const stack = []
  for (const s of seeds) {
    if (!mark[s] && ok(s)) {
      mark[s] = 1
      stack.push(s)
    }
  }
  while (stack.length) {
    const p = stack.pop()
    const x = p % w
    const y = (p - x) / w
    if (x > 0 && !mark[p - 1] && ok(p - 1)) ((mark[p - 1] = 1), stack.push(p - 1))
    if (x < w - 1 && !mark[p + 1] && ok(p + 1)) ((mark[p + 1] = 1), stack.push(p + 1))
    if (y > 0 && !mark[p - w] && ok(p - w)) ((mark[p - w] = 1), stack.push(p - w))
    if (y < h - 1 && !mark[p + w] && ok(p + w)) ((mark[p + w] = 1), stack.push(p + w))
  }
}

/**
 * Which pixels are background: near-white pixels connected to the border, plus large pure-white
 * pockets inside a sticker (the hole in a mug handle). Small white highlights are kept.
 * @returns {Uint8Array} 1 for background
 */
export function backgroundMask(
  rgba,
  w,
  h,
  { white = 238, pure = 252, holeArea = 120, bg: color = null, tol = 14 } = {},
) {
  const n = w * h
  const bg = new Uint8Array(n)
  // "background-like": near white, or near the sheet's own color
  const light = color
    ? (p) => maxDiff(rgba, p * 4, color) <= tol
    : (p) => minChannel(rgba, p * 4) >= white
  // "exactly background": what a pocket inside a sticker must look like to be cut out too
  const pureBg = color
    ? (p) => maxDiff(rgba, p * 4, color) <= 6
    : (p) => minChannel(rgba, p * 4) >= pure
  const seeds = []
  for (let x = 0; x < w; x++) seeds.push(x, (h - 1) * w + x)
  for (let y = 0; y < h; y++) seeds.push(y * w, y * w + w - 1)
  flood(w, h, seeds, light, bg)

  // Pockets are only cut out on near-white sheets. On a grey or colored sheet a sticker can hold an
  // area that is the very shade of the background (the white disc on a pool ball), and cutting it
  // out would punch a hole in the sticker.
  if (color && Math.min(...color) < white) return bg

  // pockets of pure white that the border fill could not reach
  const seen = new Uint8Array(n)
  for (let p = 0; p < n; p++) {
    if (bg[p] || seen[p] || !pureBg(p)) continue
    const cells = []
    const stack = [p]
    seen[p] = 1
    while (stack.length) {
      const q = stack.pop()
      cells.push(q)
      const x = q % w
      const y = (q - x) / w
      const next = []
      if (x > 0) next.push(q - 1)
      if (x < w - 1) next.push(q + 1)
      if (y > 0) next.push(q - w)
      if (y < h - 1) next.push(q + w)
      for (const m of next) {
        if (!seen[m] && !bg[m] && pureBg(m)) {
          seen[m] = 1
          stack.push(m)
        }
      }
    }
    if (cells.length >= holeArea) for (const c of cells) bg[c] = 1
  }
  return bg
}

/**
 * Make the background transparent. The outermost ring of the sticker (where the object blended
 * into the white) is thinned and its color pulled from further inside, so there is no white halo.
 * Returns a new RGBA buffer; the input is untouched.
 */
export function cutBackground(rgba, w, h, options) {
  const bg = backgroundMask(rgba, w, h, options)
  const out = Buffer.from(rgba)
  const nearBg = (x, y) => {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx
        const ny = y + dy
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) return true
        if (bg[ny * w + nx]) return true
      }
    }
    return false
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x
      const i = p * 4
      if (bg[p]) {
        out[i + 3] = 0
        continue
      }
      if (!nearBg(x, y)) continue
      // an edge pixel that is nearly the background color is background bleeding in: drop it
      const bleed = options?.bg
        ? maxDiff(rgba, i, options.bg) <= (options.tol ?? 14) * 2
        : minChannel(rgba, i) >= 225
      if (bleed) {
        out[i + 3] = 0
        continue
      }
      // pull the color from the nearest solid pixel inside, so the edge carries no white
      let r = 0
      let g = 0
      let b = 0
      let c = 0
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
          const q = ny * w + nx
          if (bg[q] || nearBg(nx, ny)) continue
          r += rgba[q * 4]
          g += rgba[q * 4 + 1]
          b += rgba[q * 4 + 2]
          c++
        }
      }
      if (c) {
        out[i] = Math.round(r / c)
        out[i + 1] = Math.round(g / c)
        out[i + 2] = Math.round(b / c)
      }
      out[i + 3] = 150
    }
  }
  return out
}

/** Mark every index within `radius` of a set index along one line of `n` cells. */
function growLine(isSet, mark, n, radius) {
  let last = -Infinity
  for (let i = 0; i < n; i++) {
    if (isSet(i)) last = i
    if (i - last <= radius) mark(i)
  }
  last = Infinity
  for (let i = n - 1; i >= 0; i--) {
    if (isSet(i)) last = i
    if (last - i <= radius) mark(i)
  }
}

/** Grow a 0/1 mask by `radius` pixels in every direction (a square brush: rows, then columns). */
function dilate(mask, w, h, radius) {
  const across = new Uint8Array(mask.length)
  for (let y = 0; y < h; y++) {
    growLine(
      (x) => mask[y * w + x],
      (x) => (across[y * w + x] = 1),
      w,
      radius,
    )
  }
  const out = new Uint8Array(mask.length)
  for (let x = 0; x < w; x++) {
    growLine(
      (y) => across[y * w + x],
      (y) => (out[y * w + x] = 1),
      h,
      radius,
    )
  }
  return out
}

/** Draw a 3px line [x1, y1, x2, y2] into a mask with the given value. */
function drawLine(mask, w, h, [x1, y1, x2, y2], value) {
  const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1), 1)
  for (let i = 0; i <= steps; i++) {
    const x = Math.round(x1 + ((x2 - x1) * i) / steps)
    const y = Math.round(y1 + ((y2 - y1) * i) / steps)
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx
        const ny = y + dy
        if (nx >= 0 && ny >= 0 && nx < w && ny < h) mask[ny * w + nx] = value
      }
    }
  }
}

/**
 * Give small pieces back to the big object they touch. Works on the label image in place: a label
 * whose area is under `ratio` of a neighbour it touches (within 2px) takes that neighbour's label.
 */
function mergeOrphans(labels, w, h, ratio) {
  if (!ratio) return
  const area = new Map()
  for (let p = 0; p < labels.length; p++)
    if (labels[p]) area.set(labels[p], (area.get(labels[p]) ?? 0) + 1)
  const order = [...area.keys()].sort((a, b) => area.get(a) - area.get(b))
  for (const small of order) {
    if (!area.has(small)) continue
    const votes = new Map()
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (labels[y * w + x] !== small) continue
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            const nx = x + dx
            const ny = y + dy
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
            const other = labels[ny * w + nx]
            if (other && other !== small) votes.set(other, (votes.get(other) ?? 0) + 1)
          }
        }
      }
    }
    // the neighbour it touches most, if that neighbour is much bigger
    let best = 0
    for (const [label, n] of votes) if (n > (votes.get(best) ?? 0)) best = label
    if (best && area.get(small) < ratio * area.get(best)) {
      for (let p = 0; p < labels.length; p++) if (labels[p] === small) labels[p] = best
      area.set(best, area.get(best) + area.get(small))
      area.delete(small)
    }
  }
}

/** Shrink a 0/1 mask by `radius` pixels. The edge of the image counts as empty. */
function erode(mask, w, h, radius) {
  const empty = new Uint8Array(mask.length)
  for (let p = 0; p < mask.length; p++) empty[p] = mask[p] ? 0 : 1
  for (let x = 0; x < w; x++) ((empty[x] = 1), (empty[(h - 1) * w + x] = 1))
  for (let y = 0; y < h; y++) ((empty[y * w] = 1), (empty[y * w + w - 1] = 1))
  const grown = dilate(empty, w, h, radius)
  const out = new Uint8Array(mask.length)
  for (let p = 0; p < mask.length; p++) out[p] = grown[p] ? 0 : 1
  return out
}

/**
 * The separate objects on a sheet.
 *
 * Each object is first found by its solid core: the shape shrunk by `split` pixels, so two things
 * that only touch (a cat lying on a blanket) fall apart. Every pixel of the original shape then
 * joins the nearest core, which also brings back thin parts like whiskers and handles. `gap` merges
 * cores that are closer than that many pixels, for stickers made of loose pieces (confetti).
 * `cuts` are lines [x1, y1, x2, y2] drawn through the shape before anything else, for stickers that
 * overlap too much to part by themselves. A small piece that touches a much bigger object (less than
 * `orphan` of its area), like a kettle's handle, rejoins it.
 * `objects` are in reading order; `labels` says which object each pixel belongs to (use it with
 * cropObject).
 * @returns {{objects: {label: number, x: number, y: number, width: number, height: number, area: number}[], labels: Int32Array, background: Uint8Array}}
 */
export function findObjects(
  rgba,
  w,
  h,
  { gap = 0, split = 3, minArea = 500, cuts = [], orphan = 0.35, ...bgOptions } = {},
) {
  const background = backgroundMask(rgba, w, h, bgOptions)
  const solid = new Uint8Array(w * h)
  for (let p = 0; p < solid.length; p++) solid[p] = background[p] ? 0 : 1
  for (const cut of cuts) drawLine(solid, w, h, cut, 0)
  const core = split > 0 ? erode(solid, w, h, split) : solid
  const seeds = gap > 0 ? dilate(core, w, h, gap) : core

  // 1. label the connected cores (8-way)
  const seedLabel = new Int32Array(w * h)
  let count = 0
  for (let start = 0; start < seedLabel.length; start++) {
    if (!seeds[start] || seedLabel[start]) continue
    count++
    seedLabel[start] = count
    const stack = [start]
    while (stack.length) {
      const q = stack.pop()
      const x = q % w
      const y = (q - x) / w
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
          const n = ny * w + nx
          if (seeds[n] && !seedLabel[n]) {
            seedLabel[n] = count
            stack.push(n)
          }
        }
      }
    }
  }

  // 2. grow every core back over the solid pixels, nearest core first
  const labels = new Int32Array(w * h)
  let queue = []
  for (let p = 0; p < labels.length; p++) {
    if (core[p] && seedLabel[p]) {
      labels[p] = seedLabel[p]
      queue.push(p)
    }
  }
  while (queue.length) {
    const nextQueue = []
    for (const q of queue) {
      const x = q % w
      const y = (q - x) / w
      const around = []
      if (x > 0) around.push(q - 1)
      if (x < w - 1) around.push(q + 1)
      if (y > 0) around.push(q - w)
      if (y < h - 1) around.push(q + w)
      for (const n of around) {
        if (solid[n] && !labels[n]) {
          labels[n] = labels[q]
          nextQueue.push(n)
        }
      }
    }
    queue = nextQueue
  }

  mergeOrphans(labels, w, h, orphan)

  // 3. measure each object
  const boxes = new Map()
  for (let p = 0; p < labels.length; p++) {
    const label = labels[p]
    if (!label) continue
    const x = p % w
    const y = (p - x) / w
    const box = boxes.get(label) ?? { label, minX: x, minY: y, maxX: x, maxY: y, area: 0 }
    box.minX = Math.min(box.minX, x)
    box.maxX = Math.max(box.maxX, x)
    box.minY = Math.min(box.minY, y)
    box.maxY = Math.max(box.maxY, y)
    box.area++
    boxes.set(label, box)
  }
  const found = [...boxes.values()]
    .filter((b) => b.area >= minArea)
    .map((b) => ({
      label: b.label,
      x: b.minX,
      y: b.minY,
      width: b.maxX - b.minX + 1,
      height: b.maxY - b.minY + 1,
      area: b.area,
    }))

  // reading order: rows first (objects whose centres are within about half a row of each other
  // share a row), then left to right
  const rowHeight = found.length
    ? [...found].map((o) => o.height).sort((x, y) => x - y)[Math.floor(found.length / 2)] * 0.7
    : 1
  found.sort((x, y) => {
    const rx = Math.round((x.y + x.height / 2) / rowHeight)
    const ry = Math.round((y.y + y.height / 2) / rowHeight)
    return rx - ry || x.x - y.x
  })
  return { objects: found, labels, background }
}

/**
 * Cut one found object out of the sheet. Pixels inside its box that belong to a neighbour stay
 * transparent. `cut` is the sheet after cutBackground.
 */
export function cropObject(cut, w, object, labels) {
  const { x, y, width, height, label } = object
  const out = Buffer.alloc(width * height * 4)
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const p = (y + row) * w + (x + col)
      if (labels[p] !== label) continue
      const i = p * 4
      const o = (row * width + col) * 4
      out[o] = cut[i]
      out[o + 1] = cut[i + 1]
      out[o + 2] = cut[i + 2]
      out[o + 3] = cut[i + 3]
    }
  }
  return { width, height, rgba: out }
}

/** Shrink to the visible pixels, then add `pad` transparent pixels around them. */
export function trimAlpha({ width, height, rgba }, pad = 3, threshold = 8) {
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (rgba[idx(width, x, y) + 3] > threshold) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < 0) return { width: 1, height: 1, rgba: Buffer.alloc(4) }
  const w = maxX - minX + 1 + pad * 2
  const h = maxY - minY + 1 + pad * 2
  const out = Buffer.alloc(w * h * 4)
  for (let y = 0; y <= maxY - minY; y++) {
    for (let x = 0; x <= maxX - minX; x++) {
      const from = idx(width, minX + x, minY + y)
      const to = idx(w, x + pad, y + pad)
      out[to] = rgba[from]
      out[to + 1] = rgba[from + 1]
      out[to + 2] = rgba[from + 2]
      out[to + 3] = rgba[from + 3]
    }
  }
  return { width: w, height: h, rgba: out }
}
