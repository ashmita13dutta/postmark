import { useLiveQuery } from 'dexie-react-hooks'
import { STICKER_PREF_DEFAULTS, stickerPrefs } from '../../db/stickerPrefs'

/** Recent, saved and default-look for the sticker tray, kept in step with the database. */
export default function useStickerPrefs() {
  const prefs = useLiveQuery(() => stickerPrefs.getAll(), [], STICKER_PREF_DEFAULTS)
  return {
    ...prefs,
    used: stickerPrefs.used,
    toggleSaved: stickerPrefs.toggleSaved,
    setStyle: stickerPrefs.setStyle,
  }
}
