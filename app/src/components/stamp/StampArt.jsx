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
 */
export default function StampArt({ colors = [], label }) {
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
      {BANDS.map(({ y, height }, i) => (
        <rect key={i} x="0" y={y} width={W} height={height + 0.5} fill={colors[i] ?? '#e8dfc6'} />
      ))}
    </svg>
  )
}
