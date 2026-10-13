/**
 * Washi tapes (tapes.json, yours to edit) and how each one is drawn.
 *
 * A tape is a strip of translucent paper: a base color, layers of pattern on top, a hint of paper
 * fibre and gloss, and ends cut in a chosen shape. Everything here is plain functions that return SVG
 * text, so tapes need no picture files and can be tested without a browser. `{c0}` to `{c4}` in any
 * color stand for the day's five palette colors.
 *
 * Ids on a postcard are `tape:<id>`. The first version had five tapes in the day's colors, named
 * `tape:0` to `tape:4`; they are kept (and look better now), so old postcards are unchanged in meaning.
 */
import { seededRng } from '../lib/rng'
import { fillColors } from '../lib/slots'
import data from './tapes.json'

export const SIZES = {
  slim: { width: 124, height: 18 },
  regular: { width: 112, height: 30 },
  wide: { width: 120, height: 40 },
}
export const EDGES = ['cut', 'zigzag', 'wavy', 'scallop', 'torn']
export const LAYER_TYPES = [
  'stripes',
  'dots',
  'gingham',
  'checks',
  'grid',
  'hearts',
  'sparkles',
  'stars',
  'daisies',
  'leaves',
  'stitch',
  'waves',
  'bunting',
  'confetti',
  'gradient',
  'foil',
  'film',
  'rim',
  'text',
]

/** The five tapes in the day's colors, kept from the first version under their old ids. */
const TODAY = [0, 1, 2, 3, 4].map((i) => ({
  id: String(i),
  label: `Today’s color ${i + 1}`,
  keywords: ['palette', 'mood', 'today', 'colors', 'plain'],
  size: 'regular',
  edge: 'zigzag',
  base: `{c${i}}`,
  opacity: 0.88,
  layers: [{ type: 'stitch', ink: ['#FFFFFF'], opacity: 0.6 }],
}))

export const TAPES = [...data.tapes, ...TODAY]
export const findTape = (id) => TAPES.find((t) => t.id === id)

/** Width, height and end shape of a tape. */
export function tapeLayout(tape) {
  const size = SIZES[tape.size] ?? SIZES.regular
  return { ...size, edge: EDGES.includes(tape.edge) ? tape.edge : 'cut' }
}

const r1 = (n) => Math.round(n * 100) / 100
const num = (v, fallback) => (Number.isFinite(v) ? v : fallback)
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// ---- the shape of the strip ----

/**
 * The outline of a tape as an SVG path. The long edges are straight; the two ends are cut in the
 * shape `edge` says. `rng` only matters for a torn end, which is the same every time for one tape.
 */
export function tapePath(w, h, edge, rng = seededRng('tape')) {
  const d = h <= 20 ? 2.6 : 3.6 // how deep the cut ends bite
  const n = Math.max(3, Math.round(h / (edge === 'scallop' ? 7 : 5.5)))
  const ys = Array.from({ length: n + 1 }, (_, i) => (h * i) / n)

  if (edge === 'zigzag') {
    const right = ys.map((y, i) => `L${r1(w - (i % 2 ? d : 0))} ${r1(y)}`)
    const left = [...ys].reverse().map((y, i) => `L${r1((i + n) % 2 ? d : 0)} ${r1(y)}`)
    return `M0 0 H${w} ${right.join(' ')} ${left.join(' ')}Z`
  }
  if (edge === 'wavy') {
    const steps = 18
    const wave = (side) =>
      Array.from({ length: steps + 1 }, (_, i) => {
        const y = (h * i) / steps
        const dx =
          (d / 2) * (1 - Math.cos((2 * Math.PI * i * Math.max(2, Math.round(h / 12))) / steps))
        return `L${r1(side === 'r' ? w - dx : dx)} ${r1(y)}`
      })
    const right = wave('r').join(' ')
    const left = wave('l').reverse().join(' ')
    return `M0 0 H${w} ${right} ${left}Z`
  }
  if (edge === 'scallop') {
    const rad = r1(h / (2 * n))
    const right = ys.slice(1).map((y) => `A${rad} ${rad} 0 0 0 ${w} ${r1(y)}`)
    const left = [...ys]
      .reverse()
      .slice(1)
      .map((y) => `A${rad} ${rad} 0 0 0 0 ${r1(y)}`)
    return `M0 0 H${w} ${right.join(' ')} L0 ${h} ${left.join(' ')}Z`
  }
  if (edge === 'torn') {
    const m = Math.max(6, Math.round(h / 2.6))
    const ty = Array.from({ length: m + 1 }, (_, i) => (h * i) / m)
    const slant = (rng() - 0.5) * 3
    const rip = (base) =>
      ty.map(
        (y) =>
          `L${r1(base + (rng() * d * 1.3 - d * 0.3) * (base ? -1 : 1) + slant * (y / h - 0.5))} ${r1(y)}`,
      )
    const right = rip(w).join(' ')
    const left = rip(0).reverse().join(' ')
    return `M0 0 H${w} ${right} ${left}Z`
  }
  return `M0 0 H${w} V${h} H0Z`
}

// ---- small shapes the patterns are made of ----

const heart = (cx, cy, r) =>
  `M${r1(cx)} ${r1(cy + r * 0.9)}C${r1(cx - r * 1.4)} ${r1(cy + r * 0.1)} ${r1(cx - r * 0.7)} ${r1(cy - r * 0.9)} ${r1(cx)} ${r1(cy - r * 0.35)}C${r1(cx + r * 0.7)} ${r1(cy - r * 0.9)} ${r1(cx + r * 1.4)} ${r1(cy + r * 0.1)} ${r1(cx)} ${r1(cy + r * 0.9)}Z`

const sparkle = (cx, cy, r) => {
  const k = r * 0.1
  return `M${r1(cx)} ${r1(cy - r)}Q${r1(cx + k)} ${r1(cy - k)} ${r1(cx + r)} ${r1(cy)}Q${r1(cx + k)} ${r1(cy + k)} ${r1(cx)} ${r1(cy + r)}Q${r1(cx - k)} ${r1(cy + k)} ${r1(cx - r)} ${r1(cy)}Q${r1(cx - k)} ${r1(cy - k)} ${r1(cx)} ${r1(cy - r)}Z`
}

const star = (cx, cy, R) => {
  const r = R * 0.45
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    const rad = i % 2 ? r : R
    return `${r1(cx + rad * Math.cos(a))} ${r1(cy + rad * Math.sin(a))}`
  })
  return `M${pts.join('L')}Z`
}

// ---- layers: each returns { defs, body } ----

const inkOf = (layer, i, fallback) => layer.ink?.[i] ?? fallback

/** A repeating tile, drawn under `fill`, with `inner` markup inside it. */
const tile = (id, tw, th, inner, extra = '') =>
  `<pattern id="${id}" width="${r1(tw)}" height="${r1(th)}" patternUnits="userSpaceOnUse"${extra}>${inner}</pattern>`

const fillRect = (w, h, id) => `<rect width="${w}" height="${h}" fill="url(#${id})"/>`

const LAYERS = {
  stripes(layer, c) {
    const s = num(layer.scale, 7)
    const ink = layer.ink?.length ? layer.ink : ['#FFFFFF']
    const bands = ink.length === 1 ? [ink[0], null] : ink
    const period = s * bands.length
    const rects = bands
      .map((col, i) =>
        col ? `<rect x="${r1(i * s)}" width="${s}" height="${r1(period)}" fill="${col}"/>` : '',
      )
      .join('')
    return {
      defs: tile(
        c.id,
        period,
        period,
        rects,
        ` patternTransform="rotate(${num(layer.angle, 45)})"`,
      ),
      body: fillRect(c.w, c.h, c.id),
    }
  },
  dots(layer, c) {
    const s = num(layer.scale, 9)
    const r = num(layer.size, s * 0.18)
    const col = inkOf(layer, 0, '#FFFFFF')
    const dots = `<circle cx="${r1(s / 4)}" cy="${r1(s / 4)}" r="${r}" fill="${col}"/><circle cx="${r1((s * 3) / 4)}" cy="${r1((s * 3) / 4)}" r="${r}" fill="${col}"/>`
    return { defs: tile(c.id, s, s, dots), body: fillRect(c.w, c.h, c.id) }
  },
  gingham(layer, c) {
    const s = num(layer.scale, 8)
    const col = inkOf(layer, 0, '#E8809A')
    const inner = `<rect width="${s}" height="${s * 2}" fill="${col}" fill-opacity=".42"/><rect width="${s * 2}" height="${s}" fill="${col}" fill-opacity=".42"/>`
    return { defs: tile(c.id, s * 2, s * 2, inner), body: fillRect(c.w, c.h, c.id) }
  },
  checks(layer, c) {
    const s = num(layer.scale, 6)
    const col = inkOf(layer, 0, '#C9A57E')
    const inner = `<rect width="${s}" height="${s}" fill="${col}"/><rect x="${s}" y="${s}" width="${s}" height="${s}" fill="${col}"/>`
    return { defs: tile(c.id, s * 2, s * 2, inner), body: fillRect(c.w, c.h, c.id) }
  },
  grid(layer, c) {
    const s = num(layer.scale, 6)
    const col = inkOf(layer, 0, '#9DB7D6')
    const inner = `<path d="M0 0H${s}M0 0V${s}" stroke="${col}" stroke-width=".55" fill="none"/>`
    return { defs: tile(c.id, s, s, inner), body: fillRect(c.w, c.h, c.id) }
  },
  hearts(layer, c) {
    const s = num(layer.scale, 12)
    const r = num(layer.size, s * 0.22)
    const a = inkOf(layer, 0, '#E8809A')
    const b = inkOf(layer, 1, a)
    const inner = `<path d="${heart(s / 2, s / 2, r)}" fill="${a}"/><path d="${heart(s * 1.5, s * 1.5, r)}" fill="${b}"/>`
    return { defs: tile(c.id, s * 2, s * 2, inner), body: fillRect(c.w, c.h, c.id) }
  },
  sparkles(layer, c) {
    const s = num(layer.scale, 14)
    const r = num(layer.size, s * 0.3)
    const a = inkOf(layer, 0, '#F5D98B')
    const b = inkOf(layer, 1, a)
    const inner = `<path d="${sparkle(s / 2, s / 2, r)}" fill="${a}"/><path d="${sparkle(s * 1.5, s * 1.5, r * 0.8)}" fill="${b}"/><circle cx="${r1(s * 1.5)}" cy="${r1(s * 0.4)}" r="${r1(r * 0.12)}" fill="${b}"/><circle cx="${r1(s * 0.4)}" cy="${r1(s * 1.6)}" r="${r1(r * 0.12)}" fill="${a}"/>`
    return { defs: tile(c.id, s * 2, s * 2, inner), body: fillRect(c.w, c.h, c.id) }
  },
  stars(layer, c) {
    const s = num(layer.scale, 14)
    const R = num(layer.size, s * 0.3)
    const a = inkOf(layer, 0, '#F5D98B')
    const b = inkOf(layer, 1, a)
    const inner = `<path d="${star(s / 2, s / 2, R)}" fill="${a}"/><path d="${star(s * 1.5, s * 1.5, R)}" fill="${b}"/>`
    return { defs: tile(c.id, s * 2, s * 2, inner), body: fillRect(c.w, c.h, c.id) }
  },
  daisies(layer, c) {
    const s = num(layer.scale, 18)
    const petal = inkOf(layer, 0, '#FFFFFF')
    const heartCol = inkOf(layer, 1, '#F4C542')
    const flower = (cx, cy) => {
      const pr = s * 0.16
      const petals = Array.from({ length: 6 }, (_, i) => {
        const a = (i * Math.PI) / 3
        return `<circle cx="${r1(cx + Math.cos(a) * s * 0.2)}" cy="${r1(cy + Math.sin(a) * s * 0.2)}" r="${r1(pr)}" fill="${petal}"/>`
      }).join('')
      return `${petals}<circle cx="${r1(cx)}" cy="${r1(cy)}" r="${r1(s * 0.1)}" fill="${heartCol}"/>`
    }
    const inner = `${flower(s / 2, s / 2)}${flower(s * 1.5, s * 1.5)}<circle cx="${r1(s * 1.5)}" cy="${r1(s * 0.5)}" r="1" fill="${petal}"/><circle cx="${r1(s * 0.5)}" cy="${r1(s * 1.5)}" r="1" fill="${petal}"/>`
    return { defs: tile(c.id, s * 2, s * 2, inner), body: fillRect(c.w, c.h, c.id) }
  },
  leaves(layer, c) {
    const s = num(layer.scale, 16)
    const a = inkOf(layer, 0, '#7FAE86')
    const b = inkOf(layer, 1, a)
    const leaf = (cx, cy, rot, col) =>
      `<ellipse cx="${r1(cx)}" cy="${r1(cy)}" rx="${r1(s * 0.3)}" ry="${r1(s * 0.11)}" fill="${col}" transform="rotate(${rot} ${r1(cx)} ${r1(cy)})"/>`
    const inner = `${leaf(s * 0.5, s * 0.5, -35, a)}${leaf(s * 0.75, s * 0.78, 30, b)}${leaf(s * 1.5, s * 1.5, 35, a)}${leaf(s * 1.25, s * 1.22, -30, b)}`
    return { defs: tile(c.id, s * 2, s * 2, inner), body: fillRect(c.w, c.h, c.id) }
  },
  stitch(layer, c) {
    const col = inkOf(layer, 0, '#FFFFFF')
    const line = (y) =>
      `<line x1="5" y1="${r1(y)}" x2="${c.w - 5}" y2="${r1(y)}" stroke="${col}" stroke-opacity="${num(layer.opacity, 1)}" stroke-width="1.3" stroke-dasharray="4.5 3.2" stroke-linecap="round"/>`
    const body = Number.isFinite(layer.inset)
      ? line(layer.inset) + line(c.h - layer.inset)
      : line(c.h / 2)
    return { defs: '', body }
  },
  waves(layer, c) {
    const s = num(layer.scale, 10)
    const col = inkOf(layer, 0, '#6FA0D8')
    const h = s * 0.7
    const inner = `<path d="M0 ${r1(h / 2)}q${r1(s / 4)} ${r1(-h * 0.5)} ${r1(s / 2)} 0t${r1(s / 2)} 0" stroke="${col}" stroke-width="1.1" fill="none" stroke-linecap="round"/>`
    return { defs: tile(c.id, s, h, inner), body: fillRect(c.w, c.h, c.id) }
  },
  bunting(layer, c) {
    const fw = num(layer.size, 10)
    const rows = num(layer.rows, 1)
    const ink = layer.ink?.length ? layer.ink : ['#F4A6B8', '#8FC1E8']
    let body = ''
    for (let row = 0; row < rows; row++) {
      const y = 3 + row * (c.h / rows - 1)
      const off = row % 2 ? fw / 2 : 0
      body += `<path d="M0 ${r1(y)}H${c.w}" stroke="#8A7A66" stroke-width=".7" fill="none"/>`
      for (let x = -off, i = row; x < c.w; x += fw + 1.6, i++) {
        body += `<path d="M${r1(x)} ${r1(y)}H${r1(x + fw)}L${r1(x + fw / 2)} ${r1(y + fw * 1.05)}Z" fill="${ink[i % ink.length]}"/>`
      }
    }
    return { defs: '', body }
  },
  confetti(layer, c) {
    const ink = layer.ink?.length ? layer.ink : ['#F4A6B8', '#8FC1E8', '#F7D26B']
    const n = num(layer.count, 24)
    let body = ''
    for (let i = 0; i < n; i++) {
      const x = r1(c.rng() * c.w)
      const y = r1(c.rng() * c.h)
      const col = ink[i % ink.length]
      const kind = i % 3
      if (kind === 0)
        body += `<circle cx="${x}" cy="${y}" r="${r1(1 + c.rng() * 1.2)}" fill="${col}"/>`
      else if (kind === 1)
        body += `<rect x="${x}" y="${y}" width="${r1(2.4 + c.rng() * 1.6)}" height="1.5" fill="${col}" transform="rotate(${Math.round(c.rng() * 180)} ${x} ${y})"/>`
      else
        body += `<path d="M${x} ${y}l${r1(2 + c.rng() * 2)} ${r1(c.rng() * 3 - 1.5)}" stroke="${col}" stroke-width="1.2" stroke-linecap="round"/>`
    }
    return { defs: '', body }
  },
  gradient(layer, c) {
    const ink = layer.ink?.length ? layer.ink : ['#FAD7BE', '#C7A6E8']
    const stops = ink
      .map(
        (col, i) => `<stop offset="${r1(i / Math.max(1, ink.length - 1))}" stop-color="${col}"/>`,
      )
      .join('')
    return {
      defs: `<linearGradient id="${c.id}" x1="0" y1="0" x2="1" y2="0">${stops}</linearGradient>`,
      body: fillRect(c.w, c.h, c.id),
    }
  },
  foil(layer, c) {
    const ink = layer.ink?.length
      ? layer.ink
      : ['#B8902B', '#F3DC8A', '#C9A24A', '#FBEAB0', '#A9822A']
    const stops = ink
      .map(
        (col, i) => `<stop offset="${r1(i / Math.max(1, ink.length - 1))}" stop-color="${col}"/>`,
      )
      .join('')
    const sparks = Array.from({ length: 7 }, (_, i) => {
      const x = (c.w * (i + 0.5)) / 7 + (c.rng() - 0.5) * 8
      return `<path d="${sparkle(x, c.rng() * c.h, 1.6 + c.rng() * 1.6)}" fill="#FFFFFF" fill-opacity=".85"/>`
    }).join('')
    return {
      defs:
        `<linearGradient id="${c.id}" x1="0" y1="0" x2="1" y2="1">${stops}</linearGradient>` +
        `<linearGradient id="${c.id}h" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".5"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>`,
      body: `${fillRect(c.w, c.h, c.id)}<rect width="${c.w}" height="${c.h}" fill="url(#${c.id}h)" transform="skewX(-20)" opacity=".55"/>${sparks}`,
    }
  },
  film(layer, c) {
    const frame = inkOf(layer, 0, '#3A3733')
    const hole = inkOf(layer, 1, '#F6F0E4')
    let body = ''
    for (let x = 4; x < c.w; x += 8) {
      body += `<rect x="${x}" y="2.5" width="4" height="4" rx="1" fill="${hole}"/><rect x="${x}" y="${c.h - 6.5}" width="4" height="4" rx="1" fill="${hole}"/>`
    }
    for (let x = 4; x < c.w; x += 30) {
      body += `<rect x="${x}" y="9" width="26" height="${c.h - 18}" rx="2" fill="${frame}"/>`
    }
    return { defs: '', body }
  },
  rim(layer, c) {
    const b = num(layer.scale, 3)
    const top = inkOf(layer, 0, '#C8372D')
    const bottom = inkOf(layer, 1, top)
    return {
      defs: '',
      body: `<rect width="${c.w}" height="${b}" fill="${top}"/><rect y="${c.h - b}" width="${c.w}" height="${b}" fill="${bottom}"/>`,
    }
  },
  text(layer, c) {
    const size = num(layer.size, 8)
    const col = inkOf(layer, 0, '#2B4A8B')
    const said =
      layer.upper === false ? String(layer.text ?? '') : String(layer.text ?? '').toUpperCase()
    const line = esc(`${said}   ·   `.repeat(5))
    return {
      defs: '',
      body: `<text x="6" y="${r1(c.h / 2 + size * 0.36)}" font-size="${size}" font-weight="700" letter-spacing="1.3" fill="${col}" style="font-family:var(--font-ui)">${line}</text>`,
    }
  },
}

// ---- paper finish ----

/** Short fibres, the same for every tape: a few pale and a few brown strokes on a repeating tile. */
function fibre(id) {
  const rng = seededRng('washi-fibre')
  let strokes = ''
  for (let i = 0; i < 26; i++) {
    const x = r1(rng() * 56)
    const y = r1(rng() * 40)
    const dx = r1((rng() - 0.5) * 6)
    const dy = r1((rng() - 0.5) * 2)
    const pale = i % 2 === 0
    strokes += `<path d="M${x} ${y}q${r1(dx / 2)} ${dy} ${dx} ${r1(dy / 2)}" stroke="${pale ? '#FFFFFF' : '#7A5A30'}" stroke-opacity="${pale ? 0.26 : 0.09}" stroke-width=".45" fill="none"/>`
  }
  return tile(id, 56, 40, strokes)
}

/**
 * Everything inside the <svg> for one tape (its <defs> and its drawing) as text. `uid` makes the
 * ids unique, so the same tape can be on the card and in the tray at once.
 */
export function tapeMarkup(tape, palette, uid) {
  const { width: w, height: h, edge } = tapeLayout(tape)
  const rng = seededRng(`tape:${tape.id}`)
  const d = tapePath(w, h, edge, rng)
  const defs = [`<clipPath id="${uid}c"><path d="${d}"/></clipPath>`, fibre(`${uid}f`)]
  let body = `<rect width="${w}" height="${h}" fill="${tape.base ?? '#FFFFFF'}"/>`
  ;(tape.layers ?? []).forEach((layer, i) => {
    const make = LAYERS[layer.type]
    if (!make) return
    const out = make(layer, { id: `${uid}p${i}`, w, h, rng })
    if (out.defs) defs.push(out.defs)
    body += out.body
  })
  defs.push(
    `<linearGradient id="${uid}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".4"/><stop offset=".5" stop-color="#fff" stop-opacity=".05"/><stop offset="1" stop-color="#2a1a08" stop-opacity=".13"/></linearGradient>`,
  )
  const opacity = num(tape.opacity, 0.92)
  const markup =
    `<defs>${defs.join('')}</defs>` +
    `<g clip-path="url(#${uid}c)" opacity="${opacity}">${body}<rect width="${w}" height="${h}" fill="url(#${uid}f)"/><rect width="${w}" height="${h}" fill="url(#${uid}g)"/></g>` +
    `<path d="${d}" fill="none" stroke="#5A3D1E" stroke-opacity=".18" stroke-width=".7"/>`
  return fillColors(markup, palette)
}
