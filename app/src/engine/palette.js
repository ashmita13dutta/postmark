import { chroma, hexToOklab, oklabDistance, oklabToHex } from '../lib/color'
import { LIMITS } from '../lib/contentRules'
import { seededRng } from '../lib/rng'

/**
 * Mix a feeling's base palette with a topic's accent colors.
 *
 *  - The base palette keeps its light-to-dark shape: the darkest and lightest colors stay as
 *    anchors, and two of the three middle bands are swapped for topic accents.
 *  - Accents are re-tuned toward the palette's own color strength, so shopping pink on a tired
 *    day comes out muted, and on a joyful day stays candy-bright.
 *  - The result always has 5 colors that are clearly different from each other. If no mix can
 *    manage that, the untouched base palette is returned (mixed: false).
 *
 * @param {string[]} base    5 hex colors
 * @param {string[]} accents 3 hex colors from the topic
 * @param {string}   seed    any stable string, e.g. `${day}`; same seed gives the same mix
 * @param {'soft'|'vivid'} energy  the base palette's energy, which caps accent strength
 * @returns {{ colors: string[], mixed: boolean, accentsUsed: string[] }}
 */
export function mixPalette(base, accents, seed, energy = 'soft') {
  if (base.length !== 5) throw new Error('A palette needs exactly 5 colors')
  const unchanged = { colors: [...base], mixed: false, accentsUsed: [] }
  if (!accents?.length) return unchanged

  const rng = seededRng(`mix:${seed}`)
  const baseLabs = base.map(hexToOklab)

  // Middle three by lightness are the bands an accent may replace.
  const byLight = baseLabs.map((lab, i) => ({ i, L: lab.L })).sort((a, b) => a.L - b.L)
  const slots = byLight.slice(1, 4).map((s) => s.i)

  // Target color strength comes from the palette itself.
  const colorful = baseLabs.map(chroma).filter((c) => c > 0.02)
  const mean = colorful.length ? colorful.reduce((a, b) => a + b, 0) / colorful.length : 0.04
  const cap = energy === 'vivid' ? LIMITS.maxChromaVivid : LIMITS.maxChromaSoft
  const tune = (hex) => {
    const lab = hexToOklab(hex)
    const c = chroma(lab)
    if (c < 1e-6) return hex
    const target = Math.min(cap, mean * 1.25)
    const next = Math.min(cap, c + (target - c) * 0.55)
    const k = next / c
    return oklabToHex({ L: lab.L, a: lab.a * k, b: lab.b * k })
  }

  // Which two accents (seeded), then every order they could take.
  const order = [0, 1, 2].slice(0, accents.length).sort(() => rng() - 0.5)
  const pairs = []
  for (let a = 0; a < order.length; a++) {
    for (let b = a + 1; b < order.length; b++) pairs.push([order[a], order[b]])
  }
  if (!pairs.length) pairs.push([order[0]])

  for (const pair of pairs) {
    const tuned = pair.map((idx) => tune(accents[idx]))
    const free = [...slots]
    const colors = [...base]
    for (const hex of tuned) {
      const L = hexToOklab(hex).L
      let best = 0
      for (let k = 1; k < free.length; k++) {
        if (Math.abs(baseLabs[free[k]].L - L) < Math.abs(baseLabs[free[best]].L - L)) best = k
      }
      colors[free[best]] = hex
      free.splice(best, 1)
    }
    if (isDistinct(colors)) return { colors, mixed: true, accentsUsed: tuned }
  }
  return unchanged
}

function isDistinct(colors) {
  const labs = colors.map(hexToOklab)
  for (let i = 0; i < labs.length; i++) {
    for (let j = i + 1; j < labs.length; j++) {
      if (oklabDistance(labs[i], labs[j]) < LIMITS.minPair) return false
    }
  }
  return true
}
