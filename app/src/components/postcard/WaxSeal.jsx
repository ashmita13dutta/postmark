import { useId } from 'react'
import { hexToRgb } from '../../lib/color'

const SEAL_SRC = `${import.meta.env.BASE_URL}wax/seal-rose.png`
// the photo is 480 x 505: sit it in a square box so every caller can keep sizing it as before
const BOX = 505

const mix = ([r, g, b], [r2, g2, b2], t) => [r + (r2 - r) * t, g + (g2 - g) * t, b + (b2 - b) * t]
const channel = (rgbs, i) => rgbs.map((c) => (c[i] / 255).toFixed(3)).join(' ')

/** Five wax tones, from the deepest groove to the brightest shine, for any wax colour. */
export function waxRamp(hex) {
  const base = hexToRgb(hex)
  return [
    mix(base, [10, 2, 2], 0.7),
    mix(base, [10, 2, 2], 0.38),
    base,
    mix(base, [255, 245, 235], 0.3),
    mix(base, [255, 250, 245], 0.72),
  ]
}

/** A small, steady tilt per seal, so a stack of same-colour seals never looks stamped by a machine. */
function tiltFor(seed) {
  let h = 2166136261
  for (const ch of String(seed)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  return (((h >>> 0) % 2100) / 100 - 10.5).toFixed(1)
}

/**
 * A real stick of sealing wax pressed into a postcard: a photograph of a rose seal, recoloured
 * through its own light and shadow so the relief, sheen and rough rim stay real in any colour.
 *  - color:   the wax, any hex
 *  - emblem:  kept for older seals ('heart', 'star', 'moon', 'initial', 'rose'); every seal now
 *             carries the rose impression
 *  - initial: unused, kept so stored seals still load
 *  - size:    px
 *  - seed:    anything steady (a moment id); picks this seal's tilt
 */
export default function WaxSeal({ color = '#B14126', emblem, initial, seed, size = 96 }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const ramp = waxRamp(color)
  return (
    <svg
      viewBox={`0 0 ${BOX} ${BOX}`}
      width={size}
      height={size}
      role="img"
      aria-label="Wax seal"
      data-emblem={emblem}
      data-initial={initial}
      style={{ overflow: 'visible' }}
    >
      <defs>
        <filter id={`${uid}w`} colorInterpolationFilters="sRGB" x="0" y="0" width="1" height="1">
          <feColorMatrix
            type="matrix"
            values="0.43 1.43 0.14 0 0  0.43 1.43 0.14 0 0  0.43 1.43 0.14 0 0  0 0 0 1 0"
          />
          <feComponentTransfer>
            <feFuncR type="table" tableValues={channel(ramp, 0)} />
            <feFuncG type="table" tableValues={channel(ramp, 1)} />
            <feFuncB type="table" tableValues={channel(ramp, 2)} />
          </feComponentTransfer>
        </filter>
        <filter id={`${uid}s`} x="-20%" y="-20%" width="140%" height="150%">
          <feDropShadow dx="0" dy="9" stdDeviation="9" floodColor="#2a0d08" floodOpacity="0.38" />
        </filter>
      </defs>
      <g
        filter={`url(#${uid}s)`}
        transform={`rotate(${tiltFor(seed ?? color)} ${BOX / 2} ${BOX / 2})`}
      >
        <image
          href={SEAL_SRC}
          x={(BOX - 480) / 2}
          y="0"
          width="480"
          height="505"
          filter={`url(#${uid}w)`}
        />
      </g>
    </svg>
  )
}
