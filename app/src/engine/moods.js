/**
 * "My moods": feelings you invent yourself. A mood is a name and five colors; you teach it the words
 * that bring it on (the same "Teach it" taps as for the built-in feelings), and when your words for
 * it outweigh the built-in ones in a note, the stamp is exactly those five colors.
 *
 * A mood is { id: 'my:ab12cd34', label, colors: [{ hex, name } x5], createdAt }. Its id starts with
 * `my:` so it can never clash with a built-in feeling; it is stored in the `moods` table, and a
 * postcard keeps the id as its `feeling` (and its own five colors, so deleting a mood never changes
 * an old postcard). Everything here is pure; saving lives in db/queries.js.
 */
import { feelings } from '../data/feelings.json'
import { namePalette } from './colorNames'

export const MY_PREFIX = 'my:'
export const MAX_MOODS = 20
export const MAX_LABEL = 24

const HEX = /^#[0-9A-Fa-f]{6}$/

export const isMyMood = (id) => typeof id === 'string' && id.startsWith(MY_PREFIX)

const validColors = (colors) =>
  Array.isArray(colors) && colors.length === 5 && colors.every((c) => HEX.test(c?.hex ?? c))

/**
 * Rows from the database as a lookup: id -> mood. A row that does not look right (no name, not five
 * colors) is left out, so a bad row can never break a screen.
 * @returns {Map<string, { id: string, label: string, colors: {hex: string, name: string}[], createdAt: number }>}
 */
export function buildMoods(rows = []) {
  const map = new Map()
  for (const r of rows) {
    if (!isMyMood(r?.id) || !r.label || !validColors(r.colors)) continue
    map.set(r.id, {
      id: r.id,
      label: r.label,
      colors: r.colors.map((c) => ({ hex: c.hex.toUpperCase(), name: c.name })),
      createdAt: r.createdAt ?? 0,
    })
  }
  return map
}

/** The name to show for a feeling id: a built-in's label, one of your moods, or a plain fallback. */
export function moodLabel(id, moods) {
  return feelings[id]?.label ?? moods?.get(id)?.label ?? 'A mood you made'
}

/**
 * Check what you typed and tidy it: a name (1 to 24 characters, not a built-in mood's name, not
 * one you already have) and exactly five hex colors, which get their usual color names. `selfId`
 * is the mood being edited, so keeping its own name is fine. Throws a message fit to show.
 */
export function cleanMood({ label, colors }, moods = new Map(), selfId = null) {
  const name = String(label ?? '')
    .trim()
    .replace(/\s+/g, ' ')
  if (!name) throw new Error('Give your mood a name.')
  if (name.length > MAX_LABEL) throw new Error(`A mood name can be up to ${MAX_LABEL} letters.`)
  const lower = name.toLowerCase()
  if (Object.values(feelings).some((f) => f.label.toLowerCase() === lower))
    throw new Error(`“${name}” is already one of the built-in moods. Pick another name.`)
  for (const m of moods.values())
    if (m.id !== selfId && m.label.toLowerCase() === lower)
      throw new Error(`You already have a mood called “${m.label}”.`)
  if (!validColors(colors)) throw new Error('A mood needs exactly 5 colors.')
  const hexes = colors.map((c) => (c.hex ?? c).toUpperCase())
  return { label: name, colors: namePalette(hexes).map(({ hex, name: n }) => ({ hex, name: n })) }
}

/** What readNote returns as `built` for a mood of yours: its five colors, exactly as you chose them. */
export function moodBuilt(mood) {
  return {
    colors: mood.colors.map(({ hex, name }) => ({ hex, name })),
    paletteSource: 'moment',
    palette: null,
    tagged: false,
    mixed: false,
    tinted: false,
    time: null,
    season: null,
    mine: true,
  }
}
