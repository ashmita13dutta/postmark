import colorNames from '../data/colornames.json'
import { hexToOklab, oklabDistance } from '../lib/color'

// Precompute each name's OKLab color once.
const BANK = colorNames.map((c) => ({ ...c, lab: hexToOklab(c.hex) }))

/**
 * The closest-looking name in the bank. `taken` is a Set of names already used (lowercase)
 * so one stamp never repeats a name. Returns { name, hex, distance }.
 */
export function nearestName(hex, taken = new Set()) {
  const lab = hexToOklab(hex)
  let best = null
  for (const c of BANK) {
    if (taken.has(c.name.toLowerCase())) continue
    const distance = oklabDistance(lab, c.lab)
    if (!best || distance < best.distance) best = { name: c.name, hex: c.hex, distance }
  }
  return best
}

/** Names for a whole palette, in order, with no name used twice. */
export function namePalette(hexes) {
  const taken = new Set()
  return hexes.map((hex) => {
    const match = nearestName(hex, taken)
    taken.add(match.name.toLowerCase())
    return { hex, name: match.name, distance: match.distance }
  })
}
