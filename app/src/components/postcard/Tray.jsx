import { motion, useDragControls, useReducedMotion } from 'framer-motion'
import { useState } from 'react'
import { STICKERS, TRAY_TABS } from '../../data/stickers'
import Sticker, { stickerSize } from './Sticker'
import './tray.css'

// How far the tray slides down when collapsed, leaving the handle and tabs showing.
const COLLAPSED_Y = 124

/**
 * The decorate tray: a bottom sheet you drag by its handle (or tap the handle) between open and
 * collapsed. Tapping a sticker hands its id to `onPick`.
 */
export default function Tray({ palette, onPick }) {
  const [tab, setTab] = useState(TRAY_TABS[0].id)
  const [open, setOpen] = useState(true)
  const controls = useDragControls()
  const reduced = useReducedMotion()

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
        onClick={() => setOpen((o) => !o)}
      >
        <i />
      </button>
      <div className="tray__tabs" role="tablist" aria-label="Sticker kinds">
        {TRAY_TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={tab === t.id ? 'on' : ''}
            onClick={() => {
              setTab(t.id)
              setOpen(true)
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      <ul className="tray__items">
        {STICKERS[tab].map((s) => {
          const { width, height } = stickerSize(s.id)
          // fit the sticker into a 72px tile without changing its shape
          const k = Math.min(1, 72 / Math.max(width, height))
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
            </li>
          )
        })}
      </ul>
    </motion.section>
  )
}
