import { motion } from 'framer-motion'

// Bands of color, top to bottom. Weights give the uneven stripes seen in the mockup.
const WEIGHTS = [34, 20, 24, 14, 8]
const TOTAL = WEIGHTS.reduce((a, b) => a + b, 0)
const W = 300
const H = 330

// Computed once: each band's top and height in viewBox units.
let top = 0
const BANDS = WEIGHTS.map((weight) => {
  const height = (weight / TOTAL) * H
  const band = { y: top, height }
  top += height
  return band
})

/**
 * The stamp's artwork: color is shape only, no text. `colors` is the day's palette
 * (5 hex values); missing entries render as neutral paper so an empty stamp still draws.
 *
 * `pour` (optional, { delay, instant }) makes the bands pour in top to bottom, each a beat after
 * the last, using only transform. `instant` draws the finished stamp straight away.
 */
export default function StampArt({ colors = [], label, pour }) {
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height="100%"
      preserveAspectRatio="none"
      role="img"
      aria-label={label}
      style={{ display: 'block' }}
    >
      {BANDS.map(({ y, height }, i) => {
        const rect = { x: 0, y, width: W, height: height + 0.5, fill: colors[i] ?? '#e8dfc6' }
        if (!pour) return <rect key={i} {...rect} />
        return (
          <motion.rect
            key={i}
            {...rect}
            style={{ transformBox: 'fill-box', transformOrigin: 'top' }}
            initial={pour.instant ? false : { scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{
              type: 'spring',
              stiffness: 260,
              damping: 20,
              delay: (pour.delay ?? 0) + i * 0.08,
            }}
          />
        )
      })}
    </svg>
  )
}
