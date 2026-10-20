/**
 * Share images, drawn on a canvas: the "quilt poster" for a year and a "favorite stamp" card. They
 * hold colors, dates and counts only, never the text of a note, so sharing one never gives a
 * private day away. The layout is pure (and tested); only drawing needs a browser.
 */
import { quiltRows } from './album'
import { parseDay } from './dates'

// The stamp's bands, top to bottom (the same weights as components/stamp/StampArt.jsx).
const WEIGHTS = [34, 20, 24, 14, 8]
const TOTAL = WEIGHTS.reduce((a, b) => a + b, 0)

const PAPER = '#EFE9DC'
const CARD = '#FBF6EA'
const INK = '#2A2620'
const INK_SOFT = 'rgba(42, 38, 32, 0.55)'
const BLANK = 'rgba(42, 38, 32, 0.09)'
const POSTMARK = '#534AB7'
const DISPLAY = '"DM Serif Display", Georgia, serif'
const UI = '"DM Sans", system-ui, sans-serif'
const MONO = '"JetBrains Mono", ui-monospace, monospace'

export const POSTER = { width: 1080, height: 1350 }

/**
 * Where everything goes on the poster. Twelve rows of up to 31 tall flags under a heading, month
 * names on the left. Returns plain numbers.
 */
export function posterLayout({ width, height } = POSTER) {
  const pad = 72
  const labelW = 70
  const gap = 4
  const cols = 31
  const cellW = (width - 2 * pad - labelW - (cols - 1) * gap) / cols
  const cellH = 52
  const top = 400
  return {
    width,
    height,
    pad,
    labelW,
    gap,
    cols,
    cellW,
    cellH,
    top,
    quiltBottom: top + 12 * cellH + 11 * gap,
    /** The rectangle of the square for a month (0 to 11) and a day of that month (0 to 30). */
    cell: (row, col) => ({
      x: pad + labelW + col * (cellW + gap),
      y: top + row * (cellH + gap),
      w: cellW,
      h: cellH,
    }),
    label: (row) => ({ x: pad, y: top + row * (cellH + gap) + cellH / 2 }),
  }
}

/** The numbers to print under the quilt: [[title, value]]. Only what there is to say. */
export function posterFacts(stats, { feelingLabel, topicLabel } = {}) {
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`
  const facts = []
  if (stats.topColor) facts.push(['Most common color', stats.topColor.name])
  if (stats.topFeeling && feelingLabel)
    facts.push(['Felt most often', feelingLabel(stats.topFeeling.id)])
  if (stats.topTopic && topicLabel) facts.push(['Wrote about most', topicLabel(stats.topTopic.id)])
  facts.push(['Longest streak', plural(stats.longestStreak, 'day')])
  facts.push(['Rainy days', String(stats.rainyDays)])
  return facts
}

const bandsOf = (palette) => {
  let y = 0
  return WEIGHTS.map((w, i) => {
    const h = (w / TOTAL) * 1
    const band = { y, h, color: palette[i]?.hex ?? '#E8DFC6' }
    y += h
    return band
  })
}

function canvasOf(width, height) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

const toBlob = (canvas) =>
  new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Could not make the image'))),
      'image/png',
    ),
  )

/** The brand fonts are already on the page; wait until they are ready so the canvas can use them. */
async function fontsReady() {
  if (!document.fonts?.load) return
  await Promise.all([
    document.fonts.load(`64px ${DISPLAY}`),
    document.fonts.load(`italic 40px ${DISPLAY}`),
    document.fonts.load(`28px ${UI}`),
    document.fonts.load(`20px ${MONO}`),
  ]).catch(() => {})
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h)
}

/** A perforated stamp, drawn the way the app draws it: paper, five bands, the number, scalloped edge. */
function drawStamp(ctx, { x, y, w, palette, no, tilt = 0 }) {
  const h = (w * 6) / 5
  const stamp = canvasOf(Math.ceil(w), Math.ceil(h))
  const s = stamp.getContext('2d')
  s.fillStyle = CARD
  s.fillRect(0, 0, w, h)
  const inset = w * 0.085
  const artW = w - 2 * inset
  const artH = h - 2 * inset - h * 0.08
  for (const band of bandsOf(palette)) {
    s.fillStyle = band.color
    s.fillRect(inset, inset + band.y * artH, artW, band.h * artH + 0.5)
  }
  if (no != null) {
    s.fillStyle = INK
    s.font = `italic 400 ${Math.round(w * 0.065)}px ${DISPLAY}`
    s.textAlign = 'center'
    s.fillText(`No. ${no}`, w / 2, h - inset * 0.9)
  }
  // the perforations: round holes along every edge
  s.globalCompositeOperation = 'destination-out'
  const r = w * 0.027
  const step = w * 0.072
  for (let t = step / 2; t < w; t += step) {
    for (const yy of [0, h]) {
      s.beginPath()
      s.arc(t, yy, r, 0, Math.PI * 2)
      s.fill()
    }
  }
  for (let t = step / 2; t < h; t += step) {
    for (const xx of [0, w]) {
      s.beginPath()
      s.arc(xx, t, r, 0, Math.PI * 2)
      s.fill()
    }
  }
  ctx.save()
  ctx.translate(x + w / 2, y + h / 2)
  ctx.rotate((tilt * Math.PI) / 180)
  ctx.shadowColor = 'rgba(42, 38, 32, 0.28)'
  ctx.shadowBlur = w * 0.07
  ctx.shadowOffsetY = w * 0.03
  ctx.drawImage(stamp, -w / 2, -h / 2, w, h)
  ctx.restore()
}

/**
 * The poster for one year: a heading, the quilt, a few numbers. Returns a PNG Blob.
 * @param {object} input
 * @param {number} input.year
 * @param {number} input.volume       the volume number (1 = "Volume I")
 * @param {object[]} input.moments    the year's stamps
 * @param {string} input.today
 * @param {[string, string][]} input.facts  from posterFacts
 * @param {string} input.volumeName   "Volume II"
 */
export async function renderQuiltPoster({ year, volumeName, moments, today, facts }) {
  await fontsReady()
  const L = posterLayout()
  const canvas = canvasOf(L.width, L.height)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = PAPER
  ctx.fillRect(0, 0, L.width, L.height)

  ctx.fillStyle = INK_SOFT
  ctx.font = `500 24px ${MONO}`
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(`${volumeName.toUpperCase()} · ${year}`, L.pad, 150)
  ctx.fillStyle = INK
  ctx.font = `400 130px ${DISPLAY}`
  ctx.fillText(`${moments.length}`, L.pad, 290)
  const numberW = ctx.measureText(`${moments.length}`).width
  ctx.font = `400 52px ${DISPLAY}`
  ctx.fillText(moments.length === 1 ? 'stamp' : 'stamps', L.pad + numberW + 18, 290)
  ctx.fillStyle = INK_SOFT
  ctx.font = `400 30px ${UI}`
  ctx.fillText('one square for every day', L.pad, 345)

  const MONTHS = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ]
  quiltRows(year, moments, today).forEach((row, i) => {
    const label = L.label(i)
    ctx.fillStyle = INK_SOFT
    ctx.font = `500 20px ${MONO}`
    ctx.textBaseline = 'middle'
    ctx.fillText(MONTHS[i], label.x, label.y)
    row.cells.forEach((c, j) => {
      const r = L.cell(i, j)
      if (c.moment) {
        ctx.save()
        roundRect(ctx, r.x, r.y, r.w, r.h, 3)
        ctx.clip()
        for (const band of bandsOf(c.moment.palette)) {
          ctx.fillStyle = band.color
          ctx.fillRect(r.x, r.y + band.y * r.h, r.w, band.h * r.h + 0.5)
        }
        ctx.restore()
      } else if (c.status === 'blank' || c.status === 'today') {
        ctx.fillStyle = BLANK
        roundRect(ctx, r.x, r.y, r.w, r.h, 3)
        ctx.fill()
      } else {
        ctx.strokeStyle = 'rgba(42, 38, 32, 0.16)'
        ctx.setLineDash([2, 3])
        ctx.lineWidth = 1.5
        roundRect(ctx, r.x + 0.75, r.y + 0.75, r.w - 1.5, r.h - 1.5, 3)
        ctx.stroke()
        ctx.setLineDash([])
      }
    })
  })

  // the numbers, two columns
  ctx.textBaseline = 'alphabetic'
  const colW = (L.width - 2 * L.pad) / 2
  facts.slice(0, 4).forEach(([title, value], i) => {
    const x = L.pad + (i % 2) * colW
    const y = L.quiltBottom + 90 + Math.floor(i / 2) * 100
    ctx.fillStyle = INK_SOFT
    ctx.font = `500 19px ${MONO}`
    ctx.fillText(title.toUpperCase(), x, y)
    ctx.fillStyle = INK
    ctx.font = `400 40px ${DISPLAY}`
    ctx.fillText(value, x, y + 46)
  })

  ctx.fillStyle = POSTMARK
  ctx.font = `italic 400 34px ${DISPLAY}`
  ctx.textAlign = 'right'
  ctx.fillText('Postmark', L.width - L.pad, L.height - 54)
  ctx.textAlign = 'left'
  return toBlob(canvas)
}

/** A card for one favourite stamp: the stamp on paper, its date and its five color names. */
export async function renderStampCard({ moment }) {
  await fontsReady()
  const W = 1080
  const H = 1350
  const canvas = canvasOf(W, H)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = PAPER
  ctx.fillRect(0, 0, W, H)
  const w = 560
  drawStamp(ctx, {
    x: (W - w) / 2,
    y: 190,
    w,
    palette: moment.palette,
    no: moment.stampNo,
    tilt: -2.5,
  })

  const { y, m, d } = parseDay(moment.day)
  const date = new Date(y, m - 1, d).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  ctx.textAlign = 'center'
  ctx.fillStyle = INK
  ctx.font = `400 62px ${DISPLAY}`
  ctx.fillText(date, W / 2, 1010)
  ctx.fillStyle = INK_SOFT
  ctx.font = `400 30px ${UI}`
  const names = moment.palette.map((c) => c.name)
  ctx.fillText(names.slice(0, 3).join('  ·  '), W / 2, 1075)
  ctx.fillText(names.slice(3).join('  ·  '), W / 2, 1120)
  ctx.fillStyle = POSTMARK
  ctx.font = `italic 400 34px ${DISPLAY}`
  ctx.fillText('Postmark', W / 2, H - 70)
  return toBlob(canvas)
}
