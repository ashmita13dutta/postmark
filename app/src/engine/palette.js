import { defaultFeeling, feelings } from '../data/feelings.json'
import palettes from '../data/palettes.json'
import shifts from '../data/shifts.json'
import { fallback, topics } from '../data/topics.json'
import { chroma, hexToOklab, oklabDistance, oklabToHex } from '../lib/color'
import { LIMITS } from '../lib/contentRules'
import { seededRng } from '../lib/rng'
import { namePalette, nearestName } from './colorNames'

/**
 * Choose a base palette for a feeling and (optionally) a topic.
 *  1. A palette made for the topic ("party", "dating", "autumn"...) wins if the feeling has one.
 *  2. Otherwise one of the feeling's general palettes (palettes made for a different topic are
 *     skipped, so a party palette never shows up on a shopping day).
 * `energy` ('vivid' | 'soft') is a preference from the mood engine: an emphatic happy note leans
 * toward the bright palettes, a mild one toward the soft ones. If nothing of that energy is
 * available the other kind is used, so there is always a palette.
 * `tints` are colors the note asked for ("breezy morning" -> blue). With one, the palette whose
 * colors are already closest to it is preferred, so the stamp is built AROUND that color instead
 * of just having it dropped in; topic-made palettes keep a small edge.
 * Same seed, same palette.
 * @returns {{ palette: object, tagged: boolean }}
 */
export function pickPalette(feeling, topic, seed, energy, tints = []) {
  const list = palettes[feeling] ?? palettes[defaultFeeling]
  const rng = seededRng(`pick:${feeling}:${topic}:${seed}`)
  const preferEnergy = (pool) => {
    const match = energy ? pool.filter((p) => p.energy === energy) : pool
    return match.length ? match : pool
  }
  const choose = (pool) => pool[Math.floor(rng() * pool.length)]

  const tagged = topic ? list.filter((p) => p.topics?.includes(topic)) : []
  if (tints.length) {
    const tint = hexToOklab(tints[0])
    const general = list.filter((p) => !p.topics?.length)
    const pool = preferEnergy([...tagged, ...general])
    // how close the palette already is to the tint (smaller is closer)
    const gap = (p) => {
      const g = Math.min(...p.colors.map((c) => oklabDistance(hexToOklab(c), tint)))
      return p.topics?.includes(topic) ? g - 0.02 : g
    }
    const ranked = [...pool].sort((a, b) => gap(a) - gap(b))
    const close = ranked.filter((p) => gap(p) <= gap(ranked[0]) + 0.03)
    const palette = choose(close)
    return { palette, tagged: !!topic && !!palette.topics?.includes(topic) }
  }
  if (tagged.length) return { palette: choose(preferEnergy(tagged)), tagged: true }
  const general = list.filter((p) => !p.topics?.length)
  return { palette: choose(preferEnergy(general.length ? general : list)), tagged: false }
}

/**
 * The full recipe: pick the palette, then bring in the topic's accents unless the palette was
 * already made for that topic.
 * @returns {{ palette: object, colors: string[], mixed: boolean, tagged: boolean }}
 */
export function composePalette({ feeling, topic, seed, energy, tints = [], tintStrong = false }) {
  const { palette, tagged } = pickPalette(feeling, topic, seed, energy, tints)
  if (tints.length && tintStrong) {
    const built = tintBands(palette.colors, tints, palette.energy, feelings[feeling]?.look)
    if (built) return { palette, colors: built, mixed: true, tagged: false, tinted: true }
  }
  const def = topic ? topics[topic] : null
  // a palette already made for the topic brings no topic accents, but tints are always wanted
  const accents = def && !tagged ? def.accents : []
  if (!accents.length && !tints.length) {
    return { palette, colors: [...palette.colors], mixed: false, tagged, tinted: false }
  }
  const mix = mixPalette(
    palette.colors,
    accents,
    `${feeling}:${topic}:${seed}`,
    palette.energy,
    tints,
  )
  return {
    palette,
    colors: mix.colors,
    mixed: mix.mixed,
    tagged: tagged && !mix.mixed,
    tinted: mix.tinted,
  }
}

/**
 * A strong tint ("morning breeze" -> bright blue): keep the palette's darkest and lightest colors
 * (they carry the mood) and build the three middle bands from shades of the tint, so the stamp
 * reads as that color. A second tint, if there is one, takes the middle band. The tint is only
 * toned a little toward the mood, and never past the strength this feeling's stamps may have.
 * Returns 5 colors, or null if no arrangement keeps them clearly different.
 */
export function tintBands(base, tints, energy = 'soft', look) {
  const labs = base.map(hexToOklab)
  const order = labs.map((lab, i) => ({ i, L: lab.L })).sort((a, b) => a.L - b.L)
  const dark = order[0].i
  const light = order[4].i
  const mids = order.slice(1, 4).map((o) => o.i) // darker to lighter
  const cap = energy === 'vivid' ? LIMITS.maxChromaVivid : LIMITS.maxChromaSoft
  const colorful = labs.map(chroma).filter((c) => c > 0.02)
  const mean = colorful.length ? colorful.reduce((a, b) => a + b, 0) / colorful.length : 0.04
  const limit = look?.chroma?.[1] ?? cap

  const shade = (hex, L, scale) => {
    const lab = hexToOklab(hex)
    const c = chroma(lab)
    if (c < 1e-6) return { L, a: 0, b: 0 }
    // hold on to most of the tint's own strength, but ease toward the palette's
    const toned = Math.min(cap, c + (Math.min(cap, mean * 1.25) - c) * 0.3)
    const k = (toned * scale) / c
    return { L, a: lab.a * k, b: lab.b * k }
  }

  for (let spread = 0; spread <= 3; spread++) {
    // keep the three bands in the palette's own lightness order, but never crowded
    const Ls = mids.map((i) => labs[i].L)
    for (let s = 0; s < 3; s++) {
      const gap = 0.07 + spread * 0.03
      for (let k = 1; k < 3; k++) if (Ls[k] - Ls[k - 1] < gap) Ls[k] = Ls[k - 1] + gap
      const top = labs[light].L - 0.06
      const over = Ls[2] - top
      if (over > 0) for (let k = 0; k < 3; k++) Ls[k] -= over
    }
    for (let shrink = 1; shrink > 0.35; shrink -= 0.15) {
      const colors = [...base]
      const scales = [0.85, 1, 0.8]
      mids.forEach((slot, k) => {
        const hex = k === 1 && tints[1] ? tints[1] : tints[0]
        colors[slot] = oklabToHex(shade(hex, Ls[k], scales[k] * shrink))
      })
      const labsNow = colors.map(hexToOklab)
      const meanNow = labsNow.reduce((s, l) => s + chroma(l), 0) / 5
      if (meanNow > limit * 0.97) continue // too strong for this feeling: tone the tint down
      if (isDistinct(colors) && colors[dark] === base[dark] && colors[light] === base[light]) {
        return colors
      }
    }
  }
  return null
}

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
 * @param {string[]} must    colors that must appear (tints): used first, and kept closer to the
 *                           color asked for than ordinary accents are
 * @returns {{ colors: string[], mixed: boolean, tinted: boolean, accentsUsed: string[] }}
 */
export function mixPalette(base, accents, seed, energy = 'soft', must = []) {
  if (base.length !== 5) throw new Error('A palette needs exactly 5 colors')
  const unchanged = { colors: [...base], mixed: false, tinted: false, accentsUsed: [] }
  if (!accents?.length && !must.length) return unchanged

  const rng = seededRng(`mix:${seed}`)
  const baseLabs = base.map(hexToOklab)

  // Middle three by lightness are the bands an accent may replace.
  const byLight = baseLabs.map((lab, i) => ({ i, L: lab.L })).sort((a, b) => a.L - b.L)
  const slots = byLight.slice(1, 4).map((s) => s.i)

  // Target color strength comes from the palette itself.
  const colorful = baseLabs.map(chroma).filter((c) => c > 0.02)
  const mean = colorful.length ? colorful.reduce((a, b) => a + b, 0) / colorful.length : 0.04
  const cap = energy === 'vivid' ? LIMITS.maxChromaVivid : LIMITS.maxChromaSoft
  const tune = (hex, keep = 0) => {
    const lab = hexToOklab(hex)
    const c = chroma(lab)
    if (c < 1e-6) return hex
    const target = Math.min(cap, mean * 1.25)
    // keep: how much of the color's own strength to hold on to (tints hold on to most of it)
    const next = Math.min(cap, c + (target - c) * 0.55 * (1 - keep))
    const k = next / c
    return oklabToHex({ L: lab.L, a: lab.a * k, b: lab.b * k })
  }

  // Everything that could go in: the tints first, then the topic's accents.
  const all = [...must, ...accents]
  const isMust = (idx) => idx < must.length

  // Which two colors (seeded), then every order they could take. Tints always go in.
  const order = accents.map((_, i) => must.length + i).sort(() => rng() - 0.5)
  const pairs = []
  if (must.length >= 2) pairs.push([0, 1])
  else if (must.length === 1) {
    for (const o of order) pairs.push([0, o])
    pairs.push([0]) // the tint on its own, if no accent fits alongside it
  } else {
    for (let a = 0; a < order.length; a++) {
      for (let b = a + 1; b < order.length; b++) pairs.push([order[a], order[b]])
    }
    if (!pairs.length) pairs.push([order[0]])
  }

  for (const pair of pairs) {
    const tuned = pair.map((idx) => tune(all[idx], isMust(idx) ? 0.6 : 0))
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
    if (isDistinct(colors))
      return { colors, mixed: true, tinted: must.length > 0, accentsUsed: tuned }
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

// ---------------------------------------------------------------------------------------------
// Day-to-day variation: time of day and season (settings in data/shifts.json)
// ---------------------------------------------------------------------------------------------

const WARM = { a: Math.cos(Math.PI / 3), b: Math.sin(Math.PI / 3) } // orange, in OKLab's a/b plane
const WARMTH_SCALE = 0.02 // how far "warmth: 1" pushes a color toward orange (OKLab units)

/** Name of the time-of-day bucket for an hour (0-23). */
export function timeOfDay(hour) {
  for (const [name, t] of Object.entries(shifts.times)) if (t.hours.includes(hour)) return name
  return 'midday'
}

/** Name of the season for a month (1-12) in a profile ("generic", "kolkata"...). */
export function seasonOf(month, profile) {
  const table = shifts.profiles[profile] ?? shifts.profiles[fallback.activeProfile]
  return table[month]
}

/** Move one color: lighter/darker, more/less colorful, warmer/cooler, hue rotated. */
function shiftColor(hex, { dL, dC, warmth, hue }) {
  const lab = hexToOklab(hex)
  const rad = (hue * Math.PI) / 180
  let a = lab.a * Math.cos(rad) - lab.b * Math.sin(rad)
  let b = lab.a * Math.sin(rad) + lab.b * Math.cos(rad)
  a = a * (1 + dC) + WARM.a * warmth * WARMTH_SCALE
  b = b * (1 + dC) + WARM.b * warmth * WARMTH_SCALE
  return { L: Math.min(0.99, Math.max(0.02, lab.L + dL)), a, b }
}

function acceptable(labs, cap) {
  for (let i = 0; i < labs.length; i++) {
    if (chroma(labs[i]) > cap + 1e-9) return false
    for (let j = i + 1; j < labs.length; j++) {
      if (oklabDistance(labs[i], labs[j]) < LIMITS.minPair) return false
    }
  }
  return true
}

/**
 * Nudge a palette for the time of day and season, plus a small seeded jitter so two rainy days
 * never look identical. Same inputs, same result. The shift is eased back (full, half, quarter,
 * none) until the five colors are still clearly different and within the palette's strength
 * limit, so it can never spoil a palette.
 *
 * @param {string[]} colors  5 hex colors
 * @param {object} ctx       { hour, month, seed, profile?, energy? ('soft'|'vivid'), strength? }
 * @returns {{ colors: string[], time: string, season: string, applied: number }}
 */
export function shiftPalette(colors, { hour, month, seed, profile, energy = 'soft', strength }) {
  const time = timeOfDay(hour)
  const season = seasonOf(month, profile)
  const t = shifts.times[time]
  const s = shifts.seasons[season]
  const rng = seededRng(`shift:${seed}`)
  const j = shifts.jitter
  const jit = (amount) => (rng() * 2 - 1) * amount
  const total = {
    dL: t.dL + s.dL + jit(j.dL),
    dC: t.dC + s.dC + jit(j.dC),
    warmth: t.warmth + s.warmth,
    hue: t.hue + s.hue + jit(j.hue),
  }
  const base = strength ?? shifts.strength
  const cap = energy === 'vivid' ? LIMITS.maxChromaVivid : LIMITS.maxChromaSoft

  for (const ease of [1, 0.5, 0.25]) {
    const k = ease * base
    const eased = {
      dL: total.dL * k,
      dC: total.dC * k,
      warmth: total.warmth * k,
      hue: total.hue * k,
    }
    // judge the colors that will actually be shown: converting to hex clips anything slightly
    // outside the screen's range, which can pull two light colors closer together
    const shown = colors.map((c) => oklabToHex(shiftColor(c, eased)))
    if (acceptable(shown.map(hexToOklab), cap)) {
      return { colors: shown, time, season, applied: k }
    }
  }
  return { colors: [...colors], time, season, applied: 0 }
}

// ---------------------------------------------------------------------------------------------
// The whole pipeline, and editing a swatch by hand
// ---------------------------------------------------------------------------------------------

/**
 * Everything the Today screen needs, from a note's mood to five named colors:
 * pick a palette for the feeling and topic, mix in the topic's accents, shift for the time of
 * day and season, then name each color (never the same name twice).
 *
 * @param {object} input
 * @param {string} input.feeling   from detectMood
 * @param {string} input.topic     from detectMood
 * @param {string} [input.energy]  'vivid' | 'soft' from detectMood
 * @param {string} input.seed      a stable string, normally the day ('2026-10-05')
 * @param {number} input.hour      local hour 0-23
 * @param {number} input.month     local month 1-12
 * @param {string} [input.profile] 'generic' | 'kolkata' | ...
 * @returns {{ colors: {hex, name}[], paletteSource: 'moment', palette: object,
 *             tagged: boolean, mixed: boolean, time: string, season: string }}
 */
export function buildPalette({
  feeling,
  topic,
  energy,
  seed,
  hour,
  month,
  profile,
  tints = [],
  tintStrong = false,
}) {
  const base = composePalette({ feeling, topic, seed, energy, tints, tintStrong })
  const shift = shiftPalette(base.colors, {
    hour,
    month,
    seed,
    profile,
    energy: base.palette.energy,
  })
  const named = namePalette(shift.colors).map(({ hex, name }) => ({ hex, name }))
  return {
    colors: named,
    paletteSource: 'moment',
    palette: base.palette,
    tagged: base.tagged,
    mixed: base.mixed,
    tinted: base.tinted,
    time: shift.time,
    season: shift.season,
  }
}

/**
 * Change one swatch by hand. The name follows the new color unless you give your own (names stay
 * editable), and is never one already used on the stamp. Returns the new palette and the source,
 * which becomes 'manual'.
 * @param {{hex: string, name: string}[]} palette
 */
export function setSwatch(palette, index, hex, name) {
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) throw new Error(`Invalid hex color: ${hex}`)
  if (index < 0 || index >= palette.length) throw new Error(`No swatch ${index}`)
  const upper = hex.toUpperCase()
  const taken = new Set(palette.filter((_, i) => i !== index).map((c) => c.name.toLowerCase()))
  const chosen = name?.trim() || nearestName(upper, taken).name
  const next = palette.map((c, i) => (i === index ? { hex: upper, name: chosen } : c))
  return { palette: next, paletteSource: 'manual' }
}

/** Rename one swatch without changing its color. */
export function renameSwatch(palette, index, name) {
  const clean = name.trim()
  if (!clean) throw new Error('A swatch needs a name')
  return {
    palette: palette.map((c, i) => (i === index ? { ...c, name: clean } : c)),
    paletteSource: 'manual',
  }
}
