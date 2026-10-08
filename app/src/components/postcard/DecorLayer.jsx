import { useGesture } from '@use-gesture/react'
import { useRef, useState } from 'react'
import { SCALE_RANGE } from '../../lib/decor'
import Sticker from './Sticker'
import './decor.css'

/**
 * One sticker on the card. Drag to move; pinch with two fingers to resize and turn. While a
 * gesture is going the sticker follows your fingers from local state, and only the finished
 * placement is handed to `onChange` (which saves it).
 */
function Decoration({ deco, palette, selected, locked, onSelect, onChange }) {
  const ref = useRef(null)
  const [live, setLive] = useState(null)
  const p = live ?? deco

  const bind = useGesture(
    {
      onDrag: ({ first, last, movement: [mx, my], memo, pinching, cancel, tap }) => {
        if (pinching) return cancel()
        if (tap) return memo
        const box = ref.current?.parentElement?.getBoundingClientRect()
        if (!box?.width) return memo
        const start = first ? { x: deco.x, y: deco.y } : memo
        const next = {
          ...(live ?? deco),
          x: start.x + mx / box.width,
          y: start.y + my / box.height,
        }
        setLive(next)
        if (last) {
          setLive(null)
          onChange(deco.id, { x: next.x, y: next.y }, { front: true })
        }
        return start
      },
      onPinch: ({ last, offset: [scale, angle] }) => {
        const next = { ...(live ?? deco), scale, rotation: angle }
        setLive(next)
        if (last) {
          setLive(null)
          onChange(deco.id, { scale: next.scale, rotation: next.rotation })
        }
      },
    },
    {
      enabled: !locked,
      drag: { filterTaps: true, threshold: 2 },
      pinch: {
        scaleBounds: { min: SCALE_RANGE.min, max: SCALE_RANGE.max },
        from: () => [deco.scale, deco.rotation],
        rubberband: true,
      },
    },
  )

  return (
    <div
      ref={ref}
      className={`decor${selected ? ' decor--on' : ''}${live ? ' decor--lift' : ''}`}
      data-kind={deco.stickerId.split(':')[0]}
      style={{
        left: `${p.x * 100}%`,
        top: `${p.y * 100}%`,
        zIndex: deco.z,
        transform: `translate(-50%, -50%) rotate(${p.rotation}deg) scale(${p.scale})`,
      }}
      onClick={(e) => {
        e.stopPropagation()
        if (!locked) onSelect(deco.id)
      }}
      {...bind()}
      role="img"
      aria-label={deco.stickerId.replace(':', ' ')}
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
      {/* one shared glossy-highlight filter for the die-cut stickers (see styles/hig.css) */}
      <svg width="0" height="0" aria-hidden="true" style={{ position: 'absolute' }}>
        <filter id="sticker-gloss" x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="2" result="blur" />
          <feSpecularLighting
            in="blur"
            surfaceScale="3"
            specularConstant="0.6"
            specularExponent="20"
            lightingColor="#fff"
            result="spec"
          >
            <fePointLight x="-40" y="-60" z="120" />
          </feSpecularLighting>
          <feComposite in="spec" in2="SourceAlpha" operator="in" result="sheen" />
          <feComposite
            in="SourceGraphic"
            in2="sheen"
            operator="arithmetic"
            k1="0"
            k2="1"
            k3="0.5"
            k4="0"
          />
        </filter>
      </svg>
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
