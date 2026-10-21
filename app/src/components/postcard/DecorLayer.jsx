import { useGesture } from '@use-gesture/react'
import { useEffect, useRef, useState } from 'react'
import { SCALE_RANGE, clampPlacement } from '../../lib/decor'
import { canOutline, canTone, findSticker, isInk } from '../../data/stickers'
import Sticker from './Sticker'
import StickerFilters from './StickerFilters'
import './decor.css'

const same = (a, b) =>
  Math.abs(a.x - b.x) < 1e-6 &&
  Math.abs(a.y - b.y) < 1e-6 &&
  Math.abs(a.scale - b.scale) < 1e-6 &&
  Math.abs(a.rotation - b.rotation) < 1e-6

/** How long a finished placement is held on screen while it saves, before the saved one takes over. */
const HOLD_MS = 700

/**
 * One sticker on the card. Drag to move; pinch with two fingers to resize and turn. While a
 * gesture is going the sticker follows your fingers from local state, and only the finished
 * placement is handed to `onChange` (which saves it). The finished placement stays on screen until
 * the saved one arrives, so the sticker never jumps back to where it was for a moment.
 */
function Decoration({ deco, palette, selected, locked, onSelect, onChange }) {
  const ref = useRef(null)
  const [live, setLive] = useState(null)
  const [held, setHeld] = useState(false) // a gesture has finished and its placement is still saving
  const current = live ?? deco
  const p = current

  // the saved placement has arrived (or saving failed and it is time to let go): drop the held one
  useEffect(() => {
    if (!live || !held) return undefined
    const release = () => {
      setHeld(false)
      setLive(null)
    }
    if (same(live, deco)) {
      release()
      return undefined
    }
    const timer = setTimeout(release, HOLD_MS)
    return () => clearTimeout(timer)
  }, [live, held, deco])

  const finish = (next, patch, opts) => {
    // keep what is shown the same as what will be saved (limits, wrapped turns)
    const final = { ...next, ...clampPlacement(next) }
    setHeld(true)
    setLive(final)
    onChange(deco.id, patch(final), opts)
  }

  const bind = useGesture(
    {
      onDrag: ({ first, last, movement: [mx, my], memo, pinching, cancel, tap }) => {
        if (pinching) return cancel()
        if (tap) return memo
        const box = ref.current?.parentElement?.getBoundingClientRect()
        if (!box?.width) return memo
        const start = first ? { x: current.x, y: current.y } : memo
        setHeld(false) // a new gesture takes over from any placement still being held
        const next = {
          ...current,
          x: start.x + mx / box.width,
          y: start.y + my / box.height,
        }
        if (last) finish(next, (f) => ({ x: f.x, y: f.y }), { front: true })
        else setLive(next)
        return start
      },
      onPinch: ({ first, last, offset: [scale, angle] }) => {
        if (first) setHeld(false)
        const next = { ...current, scale, rotation: angle }
        if (last) finish(next, (f) => ({ scale: f.scale, rotation: f.rotation }))
        else setLive(next)
      },
    },
    {
      enabled: !locked,
      drag: { filterTaps: true, threshold: 2 },
      pinch: {
        scaleBounds: { min: SCALE_RANGE.min, max: SCALE_RANGE.max },
        from: () => [current.scale, current.rotation],
        rubberband: true,
      },
    },
  )

  return (
    <div
      ref={ref}
      className={`decor${selected ? ' decor--on' : ''}${live && !held ? ' decor--lift' : ''}`}
      data-kind={deco.stickerId.split(':')[0]}
      data-tone={canTone(deco.stickerId) ? (deco.tone ?? 'original') : undefined}
      data-outline={canOutline(deco.stickerId) ? ((deco.outline ?? true) ? '1' : '0') : undefined}
      data-ink={isInk(deco.stickerId) ? '1' : undefined}
      style={{
        left: `${p.x * 100}%`,
        top: `${p.y * 100}%`,
        zIndex: deco.z,
        // the shadow is measured against this, so it keeps falling straight down as the sticker turns
        '--rot': `${p.rotation}deg`,
        transform: `translate(-50%, -50%) rotate(${p.rotation}deg) scale(${p.scale})`,
      }}
      onClick={(e) => {
        e.stopPropagation()
        if (!locked) onSelect(deco.id)
      }}
      {...bind()}
      role="img"
      aria-label={findSticker(deco.stickerId)?.label ?? deco.stickerId.replace(':', ' ')}
    >
      <Sticker id={deco.stickerId} palette={palette} />
    </div>
  )
}

/** Everything stuck on the back of a postcard, over the note. */
export default function DecorLayer({
  decorations,
  palette,
  selectedId,
  locked,
  onSelect,
  onChange,
}) {
  return (
    <div className="decor-layer" onClick={() => onSelect(null)}>
      <StickerFilters />
      {decorations.map((d) => (
        <Decoration
          key={d.id}
          deco={d}
          palette={palette}
          selected={d.id === selectedId}
          locked={locked}
          onSelect={onSelect}
          onChange={onChange}
        />
      ))}
    </div>
  )
}
