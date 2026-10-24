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
 * Photos can come from the camera (one at a time: a film strip collects them until it has enough) or
 * from the photo library (a strip takes all its frames at once, or a few at a time).
 *
 * Returns { has, mode, setMode, frames, waiting, filter, setFilter, intensity, setIntensity, preview,
 *           thumbs, palette, busy, error, pick, loadSaved, clear, save }. `waiting` is how many frames of a
 *           strip are chosen so far. `palette` is five colors read from the original photo
 *           ({ colors, paletteSource: 'photo' }), or null.
 */
export function usePhoto({ frames, seed }) {
  const [mode, setModeState] = useState('single') // 'single' | 'strip'
  const [bitmaps, setBitmaps] = useState([])
  const [pending, setPending] = useState([]) // frames of a strip chosen so far
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
    setPending([])
    setPreview(null)
    setThumbs({})
    setPalette(null)
    setError(null)
  }, [])

  async function pick(fileList) {
    const added = [...fileList]
    if (!added.length) return
    // a strip keeps collecting frames until it has enough; one photo replaces whatever there was
    const all = mode === 'strip' ? [...pending, ...added] : added.slice(0, 1)
    setError(null)
    if (all.length < wanted) {
      setPending(all)
      return
    }
    setBusy(true)
    try {
      const opened = await openPhotos(all.slice(0, wanted))
      setPending([])
      setBitmaps(opened)
      setPalette(paletteFromPixels(pixelsForPalette(opened)))
    } catch (err) {
      setPending([])
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  /** Open a saved photo's unfiltered originals again, to change its look (not once sealed). */
  async function loadSaved(media) {
    if (!media?.sources?.length) return
    setBusy(true)
    setError(null)
    try {
      const opened = await openPhotos(media.sources)
      setModeState(media.kind)
      setPending([])
      setFilter(media.filter)
      setIntensity(media.intensity)
      setBitmaps(opened)
      setPalette(paletteFromPixels(pixelsForPalette(opened)))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  function clear() {
    setPending([])
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
    const { blob, thumb, sources } = await finishPhoto(bitmaps, settings)
    return queries.setMedia(momentId, {
      kind: mode,
      blob,
      thumb,
      sources,
      filter,
      intensity,
      layoutSeed: seed,
    })
  }

  return {
    has: bitmaps.length > 0,
    mode,
    setMode,
    frames, // how many photos a film strip has (the setting)
    waiting: pending.length,
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
    loadSaved,
    clear,
    save,
  }
}
