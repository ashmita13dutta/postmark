/** Pure list helpers for the tray's "Recent" and "Saved" tabs. */

/** How many recently used stickers the tray remembers. */
export const MAX_RECENT = 12

/** The sticker you just used goes to the front; it is never listed twice. */
export function pushRecent(list, id, max = MAX_RECENT) {
  return [id, ...list.filter((x) => x !== id)].slice(0, max)
}

/** Saved stickers: newest first. Tapping the heart again removes it. */
export function toggleFavorite(list, id) {
  return list.includes(id) ? list.filter((x) => x !== id) : [id, ...list]
}
