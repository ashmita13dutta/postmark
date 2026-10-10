/**
 * What the decorate tray offers. Ids are stored on a decoration as `stickerId`.
 *
 * There are two kinds of sticker:
 *  - drawn ones (stamps, tape, doodles), made of shapes in components/postcard/Sticker.jsx
 *  - picture stickers (`img:<pack>/<file>`), listed in sticker-packs.json. Those are yours to edit:
 *    see the "about" line at the top of that file.
 */
import packData from './sticker-packs.json'

/** A picture sticker is shown no bigger than this many px (its longest side) at scale 1. */
export const IMAGE_BOX = 96

/**
 * Tones a picture sticker can be washed in. Each is a ramp from shadows to highlights; the sticker
 * keeps its shading but takes on these colors, so a whole card can share one cozy palette.
 * `ramp` is null for the sticker's own colors.
 */
export const TONES = [
  { id: 'original', label: 'Original', ramp: null },
  { id: 'cream', label: 'Cream', ramp: ['#5A4630', '#B59B76', '#EFE3CC', '#FFFAF0'] },
  { id: 'cocoa', label: 'Cocoa', ramp: ['#2A1A12', '#6B4430', '#B88A64', '#F2DDBF'] },
  { id: 'rose', label: 'Rose', ramp: ['#5A2A36', '#B65A74', '#EBB3C2', '#FFF1F4'] },
  { id: 'sage', label: 'Sage', ramp: ['#2B3A2C', '#6B8A62', '#B7CDA9', '#F4F9EE'] },
  { id: 'mono', label: 'Mono', ramp: ['#1E1E1E', '#6E6E6E', '#C9C9C9', '#FFFFFF'] },
]

/** What a new sticker looks like until you change it (and until you change what "new" means). */
export const DEFAULT_STYLE = { tone: 'original', outline: true }

const drawn = (pack, label, items) => ({
  id: pack,
  label,
  kind: 'drawn',
  items: items.map(([id, name, keywords]) => ({ id, label: name, keywords })),
})

const DRAWN_PACKS = [
  drawn('stamps', 'Stamps', [
    ['stamp:fragile', 'Fragile', ['stamp', 'ink', 'warning', 'box']],
    ['stamp:urgent', 'Urgent', ['stamp', 'ink', 'important']],
    ['stamp:handle', 'Handle with care', ['stamp', 'ink', 'careful', 'gentle']],
    ['stamp:return', 'Return to sender', ['stamp', 'ink', 'mail', 'post']],
  ]),
  {
    id: 'tape',
    label: 'Tape',
    kind: 'drawn',
    // tape takes its color from the day's palette: tape:0 is the first swatch, and so on
    items: [0, 1, 2, 3, 4].map((i) => ({
      id: `tape:${i}`,
      label: `Tape ${i + 1}`,
      keywords: ['tape', 'washi', 'strip'],
    })),
  },
  drawn('doodles', 'Doodles', [
    ['doodle:heart', 'Heart', ['love', 'red', 'valentine']],
    ['doodle:star', 'Star', ['sparkle', 'night', 'gold']],
    ['doodle:sun', 'Sun', ['sunny', 'summer', 'warm', 'day']],
    ['doodle:moon', 'Moon', ['night', 'sleep', 'dream']],
    ['doodle:flower', 'Flower', ['pink', 'garden', 'spring', 'petal']],
    ['doodle:cloud', 'Cloud', ['sky', 'rain', 'weather']],
    ['doodle:squiggle', 'Squiggle', ['line', 'wave', 'scribble']],
    ['doodle:arrow', 'Arrow', ['point', 'direction']],
  ]),
]

/** The picture formats a sticker file can be in. PNG is the default; WebP and SVG are listed as `ext`. */
export const IMAGE_FORMATS = ['png', 'webp', 'svg']

/**
 * Picture packs from sticker-packs.json, with ids and file paths filled in. A pack marked
 * `"ink": true` holds stamps and postal marks: they are pressed into the paper (see isInk).
 */
const IMAGE_PACKS = packData.packs.map((pack) => ({
  id: pack.id,
  label: pack.label,
  kind: 'image',
  items: pack.stickers.map((s) => ({
    id: `img:${pack.id}/${s.file}`,
    label: s.label,
    keywords: s.keywords ?? [],
    w: s.w,
    h: s.h,
    ink: Boolean(pack.ink),
    src: `stickers/${pack.id}/${s.file}.${IMAGE_FORMATS.includes(s.ext) ? s.ext : 'png'}`,
  })),
}))

/** Every pack, in tab order: your picture packs first, then the drawn ones. */
export const PACKS = [...IMAGE_PACKS, ...DRAWN_PACKS].map((pack) => ({
  ...pack,
  items: pack.items.map((item) => ({ ...item, pack: pack.id, packLabel: pack.label })),
}))

/** Older shape, still used by the tray's tab row and by tests. */
export const TRAY_TABS = PACKS.map(({ id, label }) => ({ id, label }))
export const STICKERS = Object.fromEntries(PACKS.map((pack) => [pack.id, pack.items]))

const BY_ID = new Map(PACKS.flatMap((pack) => pack.items).map((item) => [item.id, item]))

/** The sticker with this id, or undefined (a pack may have been removed since it was used). */
export const findSticker = (id) => BY_ID.get(id)

/** 'img', 'stamp', 'tape' or 'doodle': the part of the id before the colon. */
export const kindOf = (id) => id.split(':')[0]

/**
 * Ink is pressed into the paper rather than stuck on it: the drawn rubber stamps, and any picture
 * from a pack marked `"ink": true`. It has no white edge, no shadow and no tone, and its colors
 * multiply into whatever is underneath.
 */
export const isInk = (id) => kindOf(id) === 'stamp' || Boolean(findSticker(id)?.ink)

/** Which looks make sense for a sticker: ink and tape keep their own look. */
export const canOutline = (id) => ['img', 'doodle'].includes(kindOf(id)) && !isInk(id)
export const canTone = (id) => kindOf(id) === 'img' && !isInk(id)

/**
 * Stickers matching a search, best first. Every word you type must match the sticker's name, one of
 * its keywords or its pack. A field that is exactly your word scores most, then a whole word inside
 * a field, then a word start, then the middle of a word; a match in the name gets a small bonus over
 * the same match in a keyword or pack. Ties keep the order the stickers are listed in.
 */
export function searchStickers(query, items = [...BY_ID.values()]) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length) return []
  const scored = []
  items.forEach((item, order) => {
    const fields = [
      { text: item.label, bonus: 0.5 },
      { text: item.packLabel, bonus: 0 },
      ...(item.keywords ?? []).map((text) => ({ text, bonus: 0 })),
    ]
      .filter((f) => f.text)
      .map((f) => ({ ...f, text: f.text.toLowerCase() }))
    let total = 0
    for (const word of words) {
      let best = 0
      for (const { text, bonus } of fields) {
        const parts = text.split(/\s+/)
        let score = 0
        if (text === word) score = 4
        else if (parts.includes(word)) score = 3
        else if (parts.some((part) => part.startsWith(word))) score = 2
        else if (text.includes(word)) score = 1
        if (score) best = Math.max(best, score + bonus)
      }
      if (!best) {
        total = 0
        break
      }
      total += best
    }
    if (total) scored.push({ item, total, order })
  })
  return scored.sort((x, y) => y.total - x.total || x.order - y.order).map((r) => r.item)
}

export const WAX_COLORS = [
  { hex: '#B14126', name: 'Puja red' },
  { hex: '#3A5771', name: 'Wet alley blue' },
  { hex: '#3F6B4A', name: 'Banyan green' },
  { hex: '#6B3F6B', name: 'Jamun plum' },
  { hex: '#B8902B', name: 'Zari gold' },
  { hex: '#7A1F26', name: 'Oxblood' },
  { hex: '#D98A9B', name: 'Rose petal' },
  { hex: '#2B3350', name: 'Midnight' },
  { hex: '#2F6B68', name: 'Teal river' },
  { hex: '#3A3633', name: 'Charcoal' },
]

export const WAX_EMBLEMS = [
  { id: 'rose', label: 'Rose' },
  { id: 'heart', label: 'Heart' },
  { id: 'star', label: 'Star' },
  { id: 'moon', label: 'Moon' },
  { id: 'initial', label: 'Initial' },
]
