import { DEFAULT_STYLE } from '../data/stickers'
import { pushRecent, toggleFavorite } from '../lib/stickerPrefs'
import { db as defaultDb } from './schema'

const KEYS = { recent: 'stickerRecent', favorites: 'stickerFavorites', style: 'stickerStyle' }

export const STICKER_PREF_DEFAULTS = { recent: [], favorites: [], style: DEFAULT_STYLE }

/**
 * What you did last in the sticker tray, kept in the settings table so it stays on this phone:
 * recently used stickers, saved (hearted) stickers, and the tone and outline new stickers start with.
 */
export function makeStickerPrefs(db) {
  async function getAll() {
    const [recent, favorites, style] = await db.settings.bulkGet(Object.values(KEYS))
    return {
      recent: recent?.value ?? [],
      favorites: favorites?.value ?? [],
      style: { ...DEFAULT_STYLE, ...style?.value },
    }
  }

  const put = (key, value) => db.settings.put({ key, value })

  /** Call when a sticker is placed. */
  async function used(id) {
    const { recent } = await getAll()
    await put(KEYS.recent, pushRecent(recent, id))
  }

  /** Heart or un-heart a sticker. Returns the new list. */
  async function toggleSaved(id) {
    const { favorites } = await getAll()
    const next = toggleFavorite(favorites, id)
    await put(KEYS.favorites, next)
    return next
  }

  /** Change what a new sticker starts with: { tone?, outline? }. */
  async function setStyle(patch) {
    const { style } = await getAll()
    await put(KEYS.style, { ...style, ...patch })
  }

  return { getAll, used, toggleSaved, setStyle }
}

export const stickerPrefs = makeStickerPrefs(defaultDb)
