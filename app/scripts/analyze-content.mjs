// Quality report for the content files in src/data. Run: npm run analyze
//   - palettes: are the 5 colors distinguishable? is there light/dark range? is anything neon?
//   - names: does every palette color have a close-matching color name?
//   - coverage: which parts of the color wheel have no names nearby?
import { readFileSync } from 'node:fs'
import { chroma, hexDistance, hexToOklab, hue } from '../src/lib/color.js'

const read = (f) => JSON.parse(readFileSync(new URL(`../src/data/${f}`, import.meta.url), 'utf8'))
const palettes = read('palettes.json')
const names = read('colornames.json')

// Thresholds (OKLab units). Tune if you disagree with a verdict.
const MIN_PAIR = 0.06 // two colors closer than this look like the same band
const MIN_RANGE = 0.3 // lightest minus darkest, so the stamp has depth
const MAX_CHROMA = 0.2 // above this starts to look neon
const NAME_MATCH = 0.035 // a palette color should have a name at least this close

const nearest = (hex) => {
  let best = { name: null, d: Infinity }
  for (const n of names) {
    const d = hexDistance(hex, n.hex)
    if (d < best.d) best = { name: n.name, d }
  }
  return best
}

let problems = 0
const flag = (msg) => {
  problems++
  console.log('  ✗', msg)
}

console.log('PALETTES')
let count = 0
for (const [family, list] of Object.entries(palettes)) {
  for (const p of list) {
    count++
    const labs = p.colors.map(hexToOklab)
    let minPair = Infinity
    let pair = ''
    for (let i = 0; i < 5; i++) {
      for (let j = i + 1; j < 5; j++) {
        const d = hexDistance(p.colors[i], p.colors[j])
        if (d < minPair) {
          minPair = d
          pair = `${p.colors[i]} ~ ${p.colors[j]}`
        }
      }
    }
    const range = Math.max(...labs.map((l) => l.L)) - Math.min(...labs.map((l) => l.L))
    const maxChroma = Math.max(...labs.map(chroma))
    const issues = []
    if (minPair < MIN_PAIR) issues.push(`two colors too close (${minPair.toFixed(3)}: ${pair})`)
    if (range < MIN_RANGE) issues.push(`little light/dark range (${range.toFixed(2)})`)
    if (maxChroma > MAX_CHROMA) issues.push(`very saturated (chroma ${maxChroma.toFixed(2)})`)
    if (issues.length) {
      console.log(`${family}/${p.id}`)
      issues.forEach(flag)
    }
  }
}
console.log(`  checked ${count} palettes`)

console.log('\nNAME COVERAGE (palette colors without a close name)')
const missing = new Map()
for (const list of Object.values(palettes)) {
  for (const p of list) {
    for (const hex of p.colors) {
      const n = nearest(hex)
      if (n.d > NAME_MATCH) missing.set(hex.toUpperCase(), n)
    }
  }
}
for (const [hex, n] of [...missing].sort()) {
  flag(`${hex} is ${n.d.toFixed(3)} from "${n.name}"`)
}
console.log(`  ${missing.size} palette colors need a closer name`)

console.log('\nCOLOR WHEEL COVERAGE (gaps where no name is within 0.06)')
const gaps = []
for (let h = 0; h < 360; h += 30) {
  for (const L of [0.3, 0.45, 0.6, 0.75, 0.9]) {
    // chromatic samples only, since neutrals are well covered
    const rad = (h * Math.PI) / 180
    const C = 0.08
    const lab = { L, a: C * Math.cos(rad), b: C * Math.sin(rad) }
    let best = Infinity
    let bestName = ''
    for (const n of names) {
      const nl = hexToOklab(n.hex)
      const d = Math.hypot(lab.L - nl.L, lab.a - nl.a, lab.b - nl.b)
      if (d < best) {
        best = d
        bestName = n.name
      }
    }
    if (best > 0.06) gaps.push({ h, L, best, bestName })
  }
}
for (const g of gaps)
  console.log(
    `  hue ${String(g.h).padStart(3)} lightness ${g.L}: nearest "${g.bestName}" is ${g.best.toFixed(3)} away`,
  )
console.log(`  ${gaps.length} gaps of ${12 * 5} sampled points`)

const hues = names.filter((n) => chroma(hexToOklab(n.hex)) > 0.03)
console.log(
  `\n${names.length} names total, ${hues.length} colorful, ${names.length - hues.length} neutral`,
)
const buckets = {}
for (const n of hues) {
  const b = Math.floor(hue(hexToOklab(n.hex)) / 45) * 45
  buckets[b] = (buckets[b] ?? 0) + 1
}
console.log('names per 45° of hue:', JSON.stringify(buckets))
console.log(problems ? `\n${problems} things to look at` : '\nAll good')
