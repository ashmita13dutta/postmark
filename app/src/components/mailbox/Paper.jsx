import { useId } from 'react'
import { seededRng } from '../../lib/rng'

const PAPER_SRC = `${import.meta.env.BASE_URL}wax/paper.png`

/** A straight edge with a hand-torn wobble: the same wobble every time (seeded). */
function rough(points, seed, amp = 1.4, step = 13) {
  const rnd = seededRng(seed)
  let d = `M${points[0][0]} ${points[0][1]}`
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1]
    const [x1, y1] = points[i]
    const len = Math.hypot(x1 - x0, y1 - y0)
    const n = Math.max(1, Math.round(len / step))
    for (let k = 1; k <= n; k++) {
      const t = k / n
      const jitter = k === n ? 0 : (rnd() - 0.5) * 2 * amp
      const nx = -(y1 - y0) / len
      const ny = (x1 - x0) / len
      d += ` L${(x0 + (x1 - x0) * t + nx * jitter).toFixed(1)} ${(y0 + (y1 - y0) * t + ny * jitter).toFixed(1)}`
    }
  }
  return `${d}Z`
}

export const SHAPES = {
  back: rough([[0, 0], [270, 0], [270, 190], [0, 190]], 'env-back', 1.6),
  // the delayed envelope has its top-right corner torn off
  tornBack: rough(
    [[0, 0], [222, 0], [236, 14], [229, 26], [247, 36], [270, 31], [270, 190], [0, 190]],
    'env-torn',
    1.6,
  ),
  front: rough([[0, 0], [135, 125], [270, 0], [270, 190], [0, 190]], 'env-front', 1.2),
  flap: rough([[0, 0], [270, 0], [135, 125]], 'env-flap', 1.5, 11),
}

const TONES = {
  // the roasted shade of the photographed paper: a touch deeper and warmer
  roast: { wash: '#7a4a1c', washOpacity: 0.2, edge: '#5a3a18' },
  // a year-old letter: faded and lighter
  aged: { wash: '#fff6e0', washOpacity: 0.16, edge: '#7a6544' },
}

/**
 * One layer of an envelope cut from a real photograph of aged, creased paper. `part` is 'back'
 * (the inside), 'front' (the pocket), or 'flap'. All three share one 270 x 190 envelope box; the
 * flap is only 130 tall.
 */
export default function Paper({ part, tone = 'roast', torn = false, className, style, ...rest }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const t = TONES[tone] ?? TONES.roast
  const d = part === 'back' && torn ? SHAPES.tornBack : SHAPES[part]
  const h = part === 'flap' ? 130 : 190
  // each part reads a different stretch of the photo, so the pocket and flap never look copied
  const shift = { back: [-40, 0], front: [0, 0], flap: [30, -40] }[part]
  const inside = part === 'back'
  return (
    <svg
      className={className}
      style={style}
      viewBox={`0 0 270 ${h}`}
      width="270"
      height={h}
      aria-hidden="true"
      {...rest}
    >
      <defs>
        <pattern
          id={`${uid}p`}
          patternUnits="userSpaceOnUse"
          width="340"
          height="226"
          patternTransform={`translate(${shift[0]} ${shift[1]})`}
        >
          <image href={PAPER_SRC} width="340" height="226" preserveAspectRatio="none" />
        </pattern>
        <radialGradient id={`${uid}v`} cx="0.5" cy="0.5" r="0.75">
          <stop offset="0.55" stopColor={t.edge} stopOpacity="0" />
          <stop offset="1" stopColor={t.edge} stopOpacity={inside ? 0.5 : 0.38} />
        </radialGradient>
        <linearGradient id={`${uid}s`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#000" stopOpacity={part === 'flap' ? 0.1 : 0.0} />
          <stop offset="1" stopColor="#000" stopOpacity={part === 'flap' ? 0.0 : 0.1} />
        </linearGradient>
      </defs>
      <path d={d} fill={`url(#${uid}p)`} />
      <path d={d} fill={t.wash} fillOpacity={inside ? t.washOpacity + 0.28 : t.washOpacity} />
      <path d={d} fill={`url(#${uid}s)`} />
      <path d={d} fill={`url(#${uid}v)`} />
      {part === 'front' && (
        <path
          d="M0 190 L100 105 M270 190 L170 105"
          fill="none"
          stroke={t.edge}
          strokeOpacity=".28"
          strokeWidth="1.3"
        />
      )}
      <path d={d} fill="none" stroke={t.edge} strokeOpacity=".55" strokeWidth="1" />
    </svg>
  )
}
