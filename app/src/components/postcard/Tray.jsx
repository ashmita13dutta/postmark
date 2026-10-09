import { motion, useDragControls, useReducedMotion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { PACKS, findSticker, searchStickers } from '../../data/stickers'
import Sticker, { stickerSize } from './Sticker'
import './tray.css'

// How far the tray slides down when collapsed, leaving the handle and the row of tabs showing.
const COLLAPSED_Y = 200
// A sticker is shown inside a tile no bigger than this many px.
const TILE_ART = 72

function HeartIcon({ filled }) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        d="M12 20.5s-7.3-4.5-9.4-9C1 8 3.2 4.6 6.6 4.6c2 0 3.5 1.1 5.4 3.2 1.9-2.1 3.4-3.2 5.4-3.2 3.4 0 5.6 3.4 4 6.9-2.1 4.5-9.4 9-9.4 9z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M15.5 15.5 21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

/**
 * The decorate tray: a bottom sheet you drag by its handle (or tap the handle) between open and
 * collapsed. A row of tabs holds your Recent and Saved stickers and every pack; the magnifier
 * swaps that row for a search box that looks through every pack at once. Tapping a sticker hands
 * its id to `onPick`; the heart on a tile saves it.
 *
 * `prefs` is useStickerPrefs(): { recent, favorites, toggleSaved }. The screen can own the open /
 * closed state (`open`, `onOpenChange`) so it can fold the tray away when a sticker is selected and
 * its toolbar needs the room; without them the tray looks after itself.
 */
export default function Tray({ palette, onPick, prefs, open: openProp, onOpenChange }) {
  const { recent, favorites, toggleSaved } = prefs
  const [tab, setTab] = useState(PACKS[0]?.id ?? 'recent')
  const [ownOpen, setOwnOpen] = useState(true)
  const open = openProp ?? ownOpen
  const setOpen = onOpenChange ?? setOwnOpen
  const [searching, setSearching] = useState(false)
  const [query, setQuery] = useState('')
  const controls = useDragControls()
  const reduced = useReducedMotion()

  // ids can outlive their sticker (a pack was removed), so look each one up
  const known = (ids) => ids.map(findSticker).filter(Boolean)
  const recentItems = known(recent)
  const savedItems = known(favorites)

  const tabs = [
    ...(recentItems.length ? [{ id: 'recent', label: 'Recent' }] : []),
    ...(savedItems.length ? [{ id: 'saved', label: 'Saved' }] : []),
    ...PACKS.map(({ id, label }) => ({ id, label })),
  ]
  const activeTab = tabs.some((t) => t.id === tab) ? tab : tabs[0]?.id

  // with a dozen or more packs the row scrolls sideways, so keep the chosen one in view
  const tabListRef = useRef(null)
  useEffect(() => {
    tabListRef.current
      ?.querySelector('[aria-selected="true"]')
      ?.scrollIntoView?.({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }, [activeTab, searching])

  const q = query.trim()
  const items = q
    ? searchStickers(q)
    : activeTab === 'recent'
      ? recentItems
      : activeTab === 'saved'
        ? savedItems
        : (PACKS.find((p) => p.id === activeTab)?.items ?? [])

  return (
    <motion.section
      className="tray"
      aria-label="Decorate"
      drag="y"
      dragControls={controls}
      dragListener={false}
      dragConstraints={{ top: 0, bottom: COLLAPSED_Y }}
      dragElastic={0.08}
      dragMomentum={false}
      animate={{ y: open ? 0 : COLLAPSED_Y }}
      transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 300, damping: 30 }}
      onDragEnd={(_, info) => {
        // snap by where it was let go, or which way it was flicked
        if (info.velocity.y > 300) setOpen(false)
        else if (info.velocity.y < -300) setOpen(true)
        else setOpen(info.point.y < window.innerHeight - 200)
      }}
    >
      <button
        className="tray__handle"
        aria-label={open ? 'Collapse stickers' : 'Show stickers'}
        aria-expanded={open}
        onPointerDown={(e) => controls.start(e)}
        onClick={() => setOpen(!open)}
      >
        <i />
      </button>

      {searching ? (
        <div className="tray__search" role="search">
          <SearchIcon />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search stickers"
            aria-label="Search stickers"
            autoFocus
          />
          <button
            onClick={() => {
              setSearching(false)
              setQuery('')
            }}
          >
            Cancel
          </button>
        </div>
      ) : (
        <div className="tray__tabs">
          <button
            className="tray__searchbtn"
            aria-label="Search stickers"
            onClick={() => {
              setSearching(true)
              setOpen(true)
            }}
          >
            <SearchIcon />
          </button>
          <div className="tray__tablist" role="tablist" aria-label="Sticker packs" ref={tabListRef}>
            {tabs.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={activeTab === t.id}
                className={activeTab === t.id ? 'on' : ''}
                onClick={() => {
                  setTab(t.id)
                  setOpen(true)
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {items.length ? (
        <ul className="tray__items">
          {items.map((s) => {
            const { width, height } = stickerSize(s.id)
            // fit the sticker into the tile without changing its shape
            const k = Math.min(1, TILE_ART / Math.max(width, height))
            const saved = favorites.includes(s.id)
            return (
              <li key={s.id}>
                <button
                  className="tray__item"
                  onClick={() => onPick(s.id)}
                  aria-label={`Add ${s.label}`}
                >
                  <span style={{ width: width * k, height: height * k }}>
                    <span
                      style={{ transform: `scale(${k})`, transformOrigin: '0 0', display: 'block' }}
                    >
                      <Sticker id={s.id} palette={palette} />
                    </span>
                  </span>
                </button>
                <button
                  className={saved ? 'tray__heart on' : 'tray__heart'}
                  aria-pressed={saved}
                  aria-label={saved ? `Remove ${s.label} from Saved` : `Save ${s.label}`}
                  onClick={() => toggleSaved(s.id)}
                >
                  <HeartIcon filled={saved} />
                </button>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="tray__empty">
          {q ? `No stickers match “${q}”. Try a simpler word.` : 'Nothing here yet.'}
        </p>
      )}
    </motion.section>
  )
}
