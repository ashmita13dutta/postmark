/**
 * The caption stickers (words.json, yours to edit) and how big each one is drawn.
 *
 * A word is drawn as SVG text in a font the app already carries, so the box has to be sized before
 * the browser has measured anything. `advance` is a typical width of one letter; the drawing then
 * tells the browser to stretch the text to exactly the width worked out here (textLength), so a
 * guess that is a little off only makes the letters slightly wider or narrower, never overflow.
 */
import data from './words.json'

export const WORDS = data.words

/** Longest text a word sticker should have; longer would shrink to nothing in the tray. */
export const MAX_WORD_LENGTH = 18

// size in px at scale 1. `family` is a CSS variable from styles/tokens.css.
const LOOKS = {
  script: {
    fontSize: 34,
    height: 46,
    padX: 6,
    advance: 13.2,
    baseline: 33,
    family: '--font-hand-alt',
  },
  label: { fontSize: 15, height: 30, padX: 14, advance: 11.4, baseline: 20, family: '--font-ui' },
}

export const findWord = (id) => WORDS.find((w) => w.id === id)

/**
 * Everything needed to draw one word: the text as shown (a label is in capitals), the look, and the
 * box. `textWidth` is the width the letters are stretched to; `width` adds the padding around them.
 */
export function wordLayout(word) {
  const lookName = word.look === 'label' ? 'label' : 'script'
  const look = LOOKS[lookName]
  const text = lookName === 'label' ? word.text.toUpperCase() : word.text
  const textWidth = Math.max(look.advance, Math.round(text.length * look.advance))
  return {
    text,
    look: lookName,
    color: word.color,
    fontSize: look.fontSize,
    family: look.family,
    baseline: look.baseline,
    padX: look.padX,
    textWidth,
    width: textWidth + look.padX * 2,
    height: look.height,
  }
}
