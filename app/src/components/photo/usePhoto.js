import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { paletteFromPixels } from '../../engine/colorExtract'
import { queries } from '../../db/queries'
import {
  filterThumbnail,
  finishPhoto,
  openPhotos,
  pixelsForPalette,
  renderPhoto,
  thumbBase,
} from '../../lib/photo'
import { FILTERS } from '../../lib/photoFilters'

const PREVIEW_EDGE = 560

/**
 * The photo being chosen for today's postcard: pick it (or 3 or 4 for a film strip), try the
 * filters, and see the result live. Nothing is saved until `save(momentId)`, and nothing leaves the
 * phone. `seed` (the day) steadies the grain and the way the photo sits behind the stamp.
 *
 * Returns { has, mode, setMode, frames, filter, setFilter, intensity, setIntensity, preview, thumbs, palette,
 *           busy, error, pick, clear, save }. `palette` is five colors read from the original photo
 *           ({ colors, paletteSource: 'photo' }), or null.
 */
export function usePhoto({ frames, seed }) {
  const [mode, setModeState] = useState('single') // 'single' | 'strip'
  const [bitmaps, setBitmaps] = useState([])
  const [filter, setFilter] = useState('vintage')
  const [intensity, setIntensity] = useState(0.7)
  const [preview, setPreview] = useState(null)
  const [thumbs, setThumbs] = useState({}) // a small sample of the photo for each filter
  // the first photo cut small once, so the filter row stays quick even for a huge photo
  const base = useMemo(() => (bitmaps.length ? thumbBase(bitmaps[0]) : null), [bitmaps])
  const [palette, setPalette] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const wanted = mode === 'strip' ? frames : 1

  // the live preview: redrawn a moment after the last change, small so it stays quick
  const timer = useRef(null)
  useEffect(() => {
    clearTimeout(timer.current)
    if (!bitmaps.length) return undefined
    let live = true
    let url = null
    timer.current = setTimeout(() => {
      setThumbs(
        Object.fromEntries(
          FILTERS.map((f) => [f.id, filterThumbnail(base, { filter: f.id, intensity, seed })]),
        ),
      )
      const canvas = renderPhoto(bitmaps, { kind: mode, filter, intensity, seed }, PREVIEW_EDGE)
      canvas.toBlob((blob) => {
        if (!live || !blob) return
        url = URL.createObjectURL(blob)
        setPreview(url)
      }, 'image/jpeg')
    }, 90)
    return () => {
      live = false
      clearTimeout(timer.current)
      if (url) URL.revokeObjectURL(url)
    }
  }, [bitmaps, base, mode, filter, intensity, seed])

  const setMode = useCallback((next) => {
    setModeState(next)
    // a different mode needs different photos
    setBitmaps([])
    setPreview(null)
    setThumbs({})
    setPalette(null)
    setError(null)
  }, [])

  async function pick(fileList) {
    const files = [...fileList].slice(0, wanted)
    if (!files.length) return
    setBusy(true)
    setError(null)
    try {
      if (files.length < wanted) {
        throw new Error(
          `A film strip needs ${wanted} photos. Pick ${wanted} at once, in the order you want them.`,
        )
      }
      const opened = await openPhotos(files)
      setBitmaps(opened)
      setPalette(paletteFromPixels(pixelsForPalette(opened)))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  function clear() {
    setBitmaps([])
    setPreview(null)
    setThumbs({})
    setPalette(null)
    setError(null)
  }

  /** Make the kept picture and its thumbnail and store them with the postcard. */
  async function save(momentId) {
    if (!bitmaps.length) return null
    const settings = { kind: mode, filter, intensity, seed }
    const { blob, thumb } = await finishPhoto(bitmaps, settings)
    return queries.setMedia(momentId, {
      kind: mode,
      blob,
      thumb,
      filter,
      intensity,
      layoutSeed: seed,
    })
  }

  return {
    has: bitmaps.length > 0,
    mode,
    setMode,
    frames: wanted,
    filter,
    setFilter,
    intensity,
    setIntensity,
    preview,
    thumbs,
    palette,
    busy,
    error,
    pick,
    clear,
    save,
  }
}
