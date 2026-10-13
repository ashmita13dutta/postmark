/**
 * "Color slots": {c0} to {c4} inside a piece of CSS or SVG stand for the day's five palette colors,
 * so papers, tapes and doodles can follow the mood. Add two letters after a slot for see-through
 * (hex alpha): {c1}40 is that color at about 25 percent. Used by papers.json, tapes.json and
 * doodles.json.
 */
import { BLANK_PALETTE } from '../db/moments'

/** Every slot in a text, as written: ['{c0}', '{c3}']. Anything else in braces is a typo. */
export const slotsIn = (text) => text.match(/\{[^}]*\}/g) ?? []

/** True for a slot that is really there: {c0} to {c4}. */
export const isSlot = (slot) => /^\{c[0-4]\}$/.test(slot)

/**
 * Put the day's five colors into a text. A palette that is missing a color uses the plain paper
 * colors, so a postcard always has five.
 */
export function fillColors(text, palette) {
  const colors = palette?.length === 5 ? palette : BLANK_PALETTE
  return text.replace(/\{c([0-4])\}/g, (_, i) => colors[Number(i)].hex)
}
