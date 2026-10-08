const RED = '#B14126'
const PURPLE = '#534AB7'

// Size of each sticker in px at scale 1. The decoration's `scale` multiplies this.
const SIZES = {
  stamp: { width: 132, height: 52 },
  handle: { width: 132, height: 60 },
  tape: { width: 112, height: 30 },
  doodle: { width: 60, height: 60 },
}

const STAMP_TEXT = {
  fragile: { lines: ['FRAGILE'], color: RED },
  urgent: { lines: ['URGENT'], color: RED },
  handle: { lines: ['HANDLE', 'WITH CARE'], color: PURPLE },
  return: { lines: ['RETURN TO', 'SENDER'], color: PURPLE },
}

export function stickerSize(id) {
  const [kind, name] = id.split(':')
  if (kind === 'stamp') return STAMP_TEXT[name]?.lines.length > 1 ? SIZES.handle : SIZES.stamp
  return SIZES[kind] ?? SIZES.doodle
}

function RubberStamp({ name }) {
  const { lines, color } = STAMP_TEXT[name]
  const { width, height } = stickerSize(`stamp:${name}`)
  const size = lines.length > 1 ? 14 : 19
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} fill="none">
      <g stroke={color} opacity=".82">
        <rect x="2" y="2" width={width - 4} height={height - 4} rx="4" strokeWidth="2.4" />
        <rect x="6" y="6" width={width - 12} height={height - 12} rx="2" strokeWidth="1" />
      </g>
      <g
        fill={color}
        opacity=".85"
        fontFamily="var(--font-mono)"
        fontWeight="700"
        textAnchor="middle"
      >
        {lines.map((line, i) => (
          <text
            key={line}
            x={width / 2}
            y={height / 2 + (lines.length > 1 ? (i === 0 ? -3 : 13) : 7)}
            fontSize={size}
            letterSpacing="1.5"
          >
            {line}
          </text>
        ))}
      </g>
    </svg>
  )
}

function Tape({ color }) {
  const { width, height } = SIZES.tape
  const edge = Array.from({ length: 8 }, (_, i) => `L${i % 2 ? 0 : 4} ${(i + 1) * 3.75}`).join(' ')
  const edgeR = Array.from(
    { length: 8 },
    (_, i) => `L${i % 2 ? width : width - 4} ${height - (i + 1) * 3.75}`,
  ).join(' ')
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height}>
      <path d={`M0 0 ${edge} H${width} ${edgeR} Z`} fill={color} opacity=".78" />
      <path
        d={`M6 ${height / 2} H${width - 6}`}
        stroke="#fff"
        strokeOpacity=".4"
        strokeWidth="14"
        strokeDasharray="2 8"
      />
    </svg>
  )
}

const DOODLES = {
  heart: (
    <path
      d="M30 52 C8 36 6 18 18 12 C25 9 30 14 30 19 C30 14 35 9 42 12 C54 18 52 36 30 52Z"
      fill={RED}
    />
  ),
  star: (
    <path
      d="M30 6 L36.5 22 L54 23 L40.5 34 L45 51 L30 41.5 L15 51 L19.5 34 L6 23 L23.5 22Z"
      fill="#E7C64B"
      stroke="#B8902B"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
  ),
  sun: (
    <g>
      <circle cx="30" cy="30" r="12" fill="#E7C64B" />
      <g stroke="#E39544" strokeWidth="3" strokeLinecap="round">
        <path d="M30 6v7M30 47v7M6 30h7M47 30h7M13 13l5 5M42 42l5 5M47 13l-5 5M18 42l-5 5" />
      </g>
    </g>
  ),
  moon: (
    <path
      d="M40 8 A22 22 0 1 0 52 40 A17 17 0 0 1 40 8Z"
      fill="#8FA3C4"
      stroke="#5B6470"
      strokeWidth="1.5"
    />
  ),
  flower: (
    <g>
      {[0, 72, 144, 216, 288].map((a) => (
        <ellipse
          key={a}
          cx="30"
          cy="16"
          rx="8"
          ry="11"
          fill="#ED93B1"
          transform={`rotate(${a} 30 30)`}
        />
      ))}
      <circle cx="30" cy="30" r="7" fill="#E7C64B" />
    </g>
  ),
  cloud: (
    <path
      d="M16 44 A12 12 0 0 1 17 20 A15 15 0 0 1 45 22 A11 11 0 0 1 44 44Z"
      fill="#EAF1F7"
      stroke="#8FA3C4"
      strokeWidth="2"
      strokeLinejoin="round"
    />
  ),
  squiggle: (
    <path
      d="M5 36 Q12 14 19 36 T33 36 T47 36 T57 28"
      fill="none"
      stroke={PURPLE}
      strokeWidth="4"
      strokeLinecap="round"
    />
  ),
  arrow: (
    <path
      d="M6 38 Q22 8 46 22 M46 22 L36 16 M46 22 L42 33"
      fill="none"
      stroke="#2A2620"
      strokeWidth="3.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
}

/**
 * One sticker, drawn at its natural size. `palette` is the day's five swatches ({hex}), used by
 * tape. Unknown ids draw nothing, so an old postcard never breaks the screen.
 */
export default function Sticker({ id, palette = [] }) {
  const [kind, name] = id.split(':')
  if (kind === 'stamp' && STAMP_TEXT[name]) return <RubberStamp name={name} />
  if (kind === 'tape') return <Tape color={palette[Number(name)]?.hex ?? '#D5A737'} />
  if (kind === 'doodle' && DOODLES[name]) {
    return (
      <svg viewBox="0 0 60 60" width={SIZES.doodle.width} height={SIZES.doodle.height}>
        {DOODLES[name]}
      </svg>
    )
  }
  return null
}
