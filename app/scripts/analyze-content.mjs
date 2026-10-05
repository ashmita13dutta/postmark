// Quality report for the content files in src/data. Run: npm run analyze
//   - palettes: are the 5 colors distinguishable? is there light/dark range? soft vs vivid?
//   - topic accents: are the 3 signature colors distinguishable and not neon?
//   - names: does every palette and accent color have a close-matching color name?
import { readFileSync } from 'node:fs'
import { chroma, hexDistance, hexToOklab, hue } from '../src/lib/color.js'
import { LIMITS } from '../src/lib/contentRules.js'

const read = (f) => JSON.parse(readFileSync(new URL(`../src/data/${f}`, import.meta.url), 'utf8'))
const palettes = read('palettes.json')
const topics = read('topics.json').topics
const names = read('colornames.json')

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
let vivid = 0
for (const [feeling, list] of Object.entries(palettes)) {
  for (const p of list) {
    count++
    if (p.energy === 'vivid') vivid++
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
    const cap = p.energy === 'vivid' ? LIMITS.maxChromaVivid : LIMITS.maxChromaSoft
    const issues = []
    if (minPair < LIMITS.minPair)
      issues.push(`two colors too close (${minPair.toFixed(3)}: ${pair})`)
    if (range < LIMITS.minRange) issues.push(`little light/dark range (${range.toFixed(2)})`)
    if (maxChroma > cap)
      issues.push(`too saturated for ${p.energy} (chroma ${maxChroma.toFixed(2)} > ${cap})`)
    if (p.energy === 'vivid' && maxChroma < LIMITS.minChromaVivid) {
      issues.push(
        `tagged vivid but nothing is vivid (chroma ${maxChroma.toFixed(2)}); call it soft`,
      )
    }
    if (issues.length) {
      console.log(`${feeling}/${p.id}`)
      issues.forEach(flag)
    }
  }
}
console.log(`  checked ${count} palettes (${vivid} vivid)`)

console.log('\nTOPIC ACCENTS')
for (const [id, t] of Object.entries(topics)) {
  const issues = []
  for (let i = 0; i < t.accents.length; i++) {
    for (let j = i + 1; j < t.accents.length; j++) {
      const d = hexDistance(t.accents[i], t.accents[j])
      if (d < LIMITS.minAccentPair)
        issues.push(`${t.accents[i]} ~ ${t.accents[j]} too close (${d.toFixed(3)})`)
    }
  }
  for (const a of t.accents) {
    const c = chroma(hexToOklab(a))
    if (c > LIMITS.maxChromaVivid) issues.push(`${a} too saturated (${c.toFixed(2)})`)
  }
  if (issues.length) {
    console.log(id)
    issues.forEach(flag)
  }
}
console.log(`  checked ${Object.keys(topics).length} topics`)

console.log('\nNAME COVERAGE (palette and accent colors without a close name)')
const missing = new Map()
const all = [
  ...Object.values(palettes).flatMap((l) => l.flatMap((p) => p.colors)),
  ...Object.values(topics).flatMap((t) => t.accents),
]
for (const hex of all) {
  const n = nearest(hex)
  if (n.d > LIMITS.nameMatch) missing.set(hex.toUpperCase(), n)
}
for (const [hex, n] of [...missing].sort()) flag(`${hex} is ${n.d.toFixed(3)} from "${n.name}"`)
console.log(`  ${missing.size} colors need a closer name`)

const colorful = names.filter((n) => chroma(hexToOklab(n.hex)) > 0.03)
const buckets = {}
for (const n of colorful) {
  const b = Math.floor(hue(hexToOklab(n.hex)) / 45) * 45
  buckets[b] = (buckets[b] ?? 0) + 1
}
console.log(
  `\n${names.length} names (${colorful.length} colorful). Per 45° of hue: ${JSON.stringify(buckets)}`,
)
console.log(problems ? `\n${problems} things to look at` : '\nAll good')
