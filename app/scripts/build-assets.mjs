/*
 * Draws the app icon, iOS splash screens and the share-link card, then writes the PNGs into public/.
 * Run with:  npm run assets
 * Everything is drawn from the SVG below with the palette from tokens.css, so a tweak is one edit here.
 * Fonts: resvg needs TTF, but the self-hosted fonts are WOFF, so we unwrap them in memory (no extra files).
 */
import { Resvg } from '@resvg/resvg-js'
import { unzlibSync } from 'fflate'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pub = resolve(root, 'public')
mkdirSync(resolve(pub, 'splash'), { recursive: true })

const C = {
  paper: '#EFE9DC',
  card: '#FBF6EA',
  ink: '#2A2620',
  postmark: '#534AB7',
  blue: '#3A5771',
  mist: '#B6C7D6',
  yellow: '#E7C64B',
  orange: '#E39544',
  red: '#B14126',
  redDeep: '#8A2E1E',
}

// ---------- fonts: WOFF -> TTF in memory ----------
function woffToSfnt(buf) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  const n = dv.getUint16(12)
  const tables = []
  for (let i = 0; i < n; i++) {
    const o = 44 + i * 20
    const off = dv.getUint32(o + 4)
    const comp = dv.getUint32(o + 8)
    const orig = dv.getUint32(o + 12)
    const raw = buf.subarray(off, off + comp)
    tables.push({
      tag: buf.subarray(o, o + 4),
      sum: dv.getUint32(o + 16),
      data: comp < orig ? unzlibSync(raw) : raw,
    })
  }
  const pad = (x) => (x + 3) & ~3
  const dirSize = 12 + n * 16
  const out = new Uint8Array(dirSize + tables.reduce((s, t) => s + pad(t.data.length), 0))
  const ov = new DataView(out.buffer)
  ov.setUint32(0, dv.getUint32(4)) // flavor
  ov.setUint16(4, n)
  const pow = 2 ** Math.floor(Math.log2(n))
  ov.setUint16(6, pow * 16)
  ov.setUint16(8, Math.log2(pow))
  ov.setUint16(10, n * 16 - pow * 16)
  let pos = dirSize
  tables.forEach((t, i) => {
    const r = 12 + i * 16
    out.set(t.tag, r)
    ov.setUint32(r + 4, t.sum)
    ov.setUint32(r + 8, pos)
    ov.setUint32(r + 12, t.data.length)
    out.set(t.data, pos)
    pos += pad(t.data.length)
  })
  return out
}
const fontDir = resolve(root, 'node_modules/@fontsource')
const fontFiles = [
  'dm-serif-display/files/dm-serif-display-latin-400-normal.woff',
  'dm-sans/files/dm-sans-latin-500-normal.woff',
  'kalam/files/kalam-latin-400-normal.woff',
].map((f) => {
  const out = resolve(tmpdir(), `postmark-${f.split('/').pop().replace('.woff', '.ttf')}`)
  writeFileSync(out, woffToSfnt(readFileSync(resolve(fontDir, f))))
  return out
})

function render(svg, width, name) {
  // the root tag carries the pixel size; rewrite it to the size we want (fitTo is ignored once `font` is set)
  const m = svg.match(/^<svg[^>]*viewBox="0 0 (\d+) (\d+)" width="\d+" height="\d+">/)
  const tall = Math.round((width * m[2]) / m[1])
  const clean = svg.replace(
    m[0],
    m[0].replace(/ width="\d+" height="\d+"/, ` width="${width}" height="${tall}"`),
  )
  const png = new Resvg(clean, {
    font: { fontFiles, loadSystemFonts: false, defaultFontFamily: 'DM Serif Display' },
  })
    .render()
    .asPng()
  writeFileSync(resolve(pub, name), png)
  console.log(`${name}  ${width}px  ${(png.length / 1024).toFixed(1)} KB`)
}

// ---------- the stamp ----------
// Drawn on a 1024 square. cx/cy/s place and scale it, so the same art serves icons and splash screens.
function stamp({ cx = 512, cy = 512, s = 1, tilt = -5, id = 'a', postmark = true } = {}) {
  const W = 560
  const H = 680
  const x0 = -W / 2
  const y0 = -H / 2
  // perforation holes: spaced evenly, including the corners
  const holes = []
  const nx = 10
  const ny = 12
  for (let i = 0; i <= nx; i++) {
    const x = x0 + (W / nx) * i
    holes.push([x, y0], [x, y0 + H])
  }
  for (let j = 1; j < ny; j++) {
    const y = y0 + (H / ny) * j
    holes.push([x0, y], [x0 + W, y])
  }
  const holeSvg = holes
    .map(([x, y]) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="17" fill="#000"/>`)
    .join('')

  const px = x0 + 56
  const py = y0 + 56
  const pw = W - 112
  const ph = H - 112
  const sunY = py + ph * 0.58
  // the postmark: a double ring with wavy cancel lines running left over the stamp
  const pmX = x0 + W - 40
  const pmY = y0 + 70
  const waves = [0, 1, 2]
    .map((i) => {
      const y = pmY - 36 + i * 36
      const x1 = pmX - 120 - 250
      const x2 = pmX - 120
      let d = `M${x1} ${y}`
      const step = 50
      for (let x = x1; x < x2; x += step) d += ` q${step / 4} -14 ${step / 2} 0 t${step / 2} 0`
      return `<path d="${d}" fill="none" stroke="${C.postmark}" stroke-width="16" stroke-linecap="round"/>`
    })
    .join('')

  return `
  <g transform="translate(${cx} ${cy}) rotate(${tilt}) scale(${s})">
    <defs>
      <mask id="perf${id}" maskUnits="userSpaceOnUse" x="${x0 - 40}" y="${y0 - 40}" width="${W + 80}" height="${H + 80}">
        <rect x="${x0}" y="${y0}" width="${W}" height="${H}" fill="#fff"/>${holeSvg}
      </mask>
      <linearGradient id="sky${id}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${C.blue}"/>
        <stop offset=".38" stop-color="${C.mist}"/>
        <stop offset=".72" stop-color="${C.yellow}"/>
        <stop offset="1" stop-color="${C.orange}"/>
      </linearGradient>
      <clipPath id="pic${id}"><rect x="${px}" y="${py}" width="${pw}" height="${ph}"/></clipPath>
      <filter id="sh${id}" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="22" stdDeviation="22" flood-color="#3b2a14" flood-opacity=".28"/>
      </filter>
    </defs>
    <g filter="url(#sh${id})"><g mask="url(#perf${id})"><rect x="${x0}" y="${y0}" width="${W}" height="${H}" fill="${C.card}"/></g></g>
    <g clip-path="url(#pic${id})">
      <rect x="${px}" y="${py}" width="${pw}" height="${ph}" fill="url(#sky${id})"/>
      <circle cx="${px + pw * 0.5}" cy="${sunY}" r="${pw * 0.21}" fill="${C.card}" opacity=".95"/>
      <path d="M${px} ${py + ph * 0.7} C${px + pw * 0.25} ${py + ph * 0.6} ${px + pw * 0.45} ${py + ph * 0.76} ${px + pw * 0.7} ${py + ph * 0.66} S${px + pw * 0.95} ${py + ph * 0.6} ${px + pw} ${py + ph * 0.64} V${py + ph} H${px} Z" fill="${C.red}"/>
      <path d="M${px} ${py + ph * 0.84} C${px + pw * 0.3} ${py + ph * 0.76} ${px + pw * 0.6} ${py + ph * 0.9} ${px + pw} ${py + ph * 0.8} V${py + ph} H${px} Z" fill="${C.redDeep}"/>
    </g>
    ${
      postmark
        ? `<g opacity=".86">${waves}
      <circle cx="${pmX - 40}" cy="${pmY}" r="118" fill="none" stroke="${C.postmark}" stroke-width="14"/>
      <circle cx="${pmX - 40}" cy="${pmY}" r="88" fill="none" stroke="${C.postmark}" stroke-width="6"/>
      <circle cx="${pmX - 40}" cy="${pmY}" r="24" fill="${C.postmark}"/></g>`
        : ''
    }
  </g>`
}

const paperBg = (id = 'bg') => `
  <defs><radialGradient id="${id}" cx=".35" cy=".25" r="1.1">
    <stop offset="0" stop-color="#FBF7EE"/><stop offset="1" stop-color="#EADFC6"/>
  </radialGradient></defs>
  <rect width="1024" height="1024" fill="url(#${id})"/>`

const wrap = (inner, w = 1024, h = 1024) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${inner}</svg>`

// full-bleed square: iOS and Android apply their own rounding, so the corners must be solid
const iconFull = wrap(paperBg() + stamp({ s: 1.05 }))
// maskable: the important part has to stay inside the central 80%
const iconMaskable = wrap(paperBg() + stamp({ s: 0.84 }))
// favicon / "any" icon: rounded corners baked in
const iconRounded = wrap(
  `<clipPath id="r"><rect width="1024" height="1024" rx="224"/></clipPath><g clip-path="url(#r)">${paperBg() + stamp({ s: 1.05 })}</g>`,
)

writeFileSync(resolve(pub, 'icon.svg'), iconRounded)
render(iconFull, 1024, 'icon-1024.png')
render(iconFull, 512, 'icon-512.png')
render(iconFull, 192, 'icon-192.png')
render(iconFull, 180, 'apple-touch-icon.png')
render(iconMaskable, 512, 'icon-512-maskable.png')
render(iconRounded, 64, 'favicon-64.png')

// ---------- iOS launch screens ----------
// [css width, css height, pixel ratio]
const phones = [
  [440, 956, 3],
  [402, 874, 3],
  [430, 932, 3],
  [393, 852, 3],
  [428, 926, 3],
  [390, 844, 3],
  [414, 896, 3],
  [375, 812, 3],
  [414, 896, 2],
  [375, 667, 2],
]
export const splashList = phones.map(([w, h, r]) => ({
  w,
  h,
  r,
  file: `splash/${w * r}x${h * r}.png`,
}))
for (const { w, h, r, file } of splashList) {
  const pw = w * r
  const ph = h * r
  const size = Math.min(pw * 0.5, 700)
  const k = size / 1024
  const svg = wrap(
    `<rect width="${pw}" height="${ph}" fill="${C.paper}"/>` +
      `<g transform="translate(${pw / 2 - 512 * k} ${ph / 2 - 512 * k - ph * 0.04}) scale(${k})">${stamp({ id: 's', postmark: false, tilt: -5, s: 0.9 })}</g>`,
    pw,
    ph,
  )
  render(svg, pw, file)
}

// ---------- share-link card (1200x630) ----------
const og = wrap(
  `<defs><radialGradient id="ogbg" cx=".2" cy=".2" r="1.2"><stop offset="0" stop-color="#FBF7EE"/><stop offset="1" stop-color="#EADFC6"/></radialGradient></defs>
   <rect width="1200" height="630" fill="url(#ogbg)"/>
   <g transform="translate(900 315) scale(.52) translate(-512 -512)">${stamp({ id: 'og', tilt: 6 })}</g>
   <text x="90" y="290" font-family="DM Serif Display" font-size="130" fill="${C.ink}">Postmark</text>
   <text x="94" y="368" font-family="DM Sans" font-size="38" fill="${C.ink}" fill-opacity=".62">Every day becomes a postage stamp.</text>
   <text x="94" y="470" font-family="Kalam" font-size="34" fill="${C.postmark}" fill-opacity=".85">a tiny daily journal of your moods</text>`,
  1200,
  630,
)
render(og, 1200, 'og-card.png')
