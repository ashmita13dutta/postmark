/**
 * The doodles (doodles.json, yours to edit): small hand-inked SVG drawings.
 *
 * Each has an `svg` (the inside of an <svg>), a size `w` by `h` (60 by 60 unless it says), and
 * optionally `line: true`, which wraps it in the standard dark-brown round-ended line so a drawing only
 * has to say its shapes and fills. `{c0}` to `{c4}` in a color stand for the day's five palette colors.
 * The eight doodles from the first version keep their ids (heart, star, sun, moon, flower, cloud,
 * squiggle, arrow), so a postcard that used one now shows the new drawing.
 */
import { fillColors } from '../lib/slots'
import data from './doodles.json'

export const DOODLES = data.doodles
export const DOODLE_SIZE = { width: 60, height: 60 }

/** The line every `line: true` doodle is drawn with. */
export const LINE = {
  stroke: '#3B2F2B',
  width: 1.8,
}

export const findDoodle = (id) => DOODLES.find((d) => d.id === id)

/** Width and height of a doodle in px at scale 1. */
export const doodleLayout = (doodle) => ({
  width: doodle.w ?? DOODLE_SIZE.width,
  height: doodle.h ?? DOODLE_SIZE.height,
})

/** The inside of the doodle's <svg>, as text, with the day's colors filled in. */
export function doodleMarkup(doodle, palette) {
  const inner = doodle.line
    ? `<g fill="none" stroke="${LINE.stroke}" stroke-width="${LINE.width}" stroke-linecap="round" stroke-linejoin="round">${doodle.svg}</g>`
    : doodle.svg
  return fillColors(inner, palette)
}

/**
 * Why a doodle's drawing should not be used, or null. The markup is written into the page as it is,
 * so it must stay a plain drawing: no scripts, no event handlers, no pictures or links to elsewhere.
 */
export function doodleProblem(doodle) {
  const text = String(doodle.svg ?? '')
  if (/<\s*(script|foreignObject|image|iframe|style|a)\b/i.test(text))
    return 'it has a tag that is not a plain drawing'
  if (/\son[a-z]+\s*=/i.test(text)) return 'it has an event handler (onclick and the like)'
  if (/(xlink:)?href\s*=\s*['"](?!#)/i.test(text)) return 'it links to something outside itself'
  if (/url\(\s*['"]?(?!#)/i.test(text)) return 'it points at a file outside itself'
  return null
}
