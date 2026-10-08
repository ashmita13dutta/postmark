import { useId } from 'react'

// A slightly wobbly disc, like wax that has been pressed and has squeezed out at the edges.
const BLOB =
  'M50 5 C62 3 72 9 79 17 C90 20 96 31 94 43 C99 54 95 66 87 74 C84 86 72 93 60 93 C52 99 40 98 33 91 C21 90 11 81 10 69 C2 59 3 46 10 37 C10 23 21 13 34 12 C39 7 44 5 50 5Z'

const EMBLEMS = {
  heart: 'M50 70 C32 58 30 44 39 39 C45 36 50 40 50 45 C50 40 55 36 61 39 C70 44 68 58 50 70Z',
  star: 'M50 30 L55.5 43.5 L70 44.5 L59 54 L62.5 68 L50 60.5 L37.5 68 L41 54 L30 44.5 L44.5 43.5Z',
  moon: 'M56 31 A20 20 0 1 0 68 58 A15 15 0 0 1 56 31Z',
}

/**
 * A stick of sealing wax pressed into a postcard.
 *  - color:   the wax, any hex
 *  - emblem:  'heart' | 'star' | 'moon' | 'initial'
 *  - initial: the letter shown when emblem is 'initial'
 *  - size:    px
 */
export default function WaxSeal({ color = '#B14126', emblem = 'heart', initial = '', size = 96 }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label="Wax seal">
      <defs>
        <radialGradient id={`${uid}g`} cx="0.35" cy="0.3" r="0.85">
          <stop offset="0" stopColor="#fff" stopOpacity=".45" />
          <stop offset="0.45" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity=".4" />
        </radialGradient>
      </defs>
      <path d={BLOB} fill={color} />
      <path d={BLOB} fill={`url(#${uid}g)`} />
      <circle
        cx="50"
        cy="50"
        r="31"
        fill="none"
        stroke="#000"
        strokeOpacity=".28"
        strokeWidth="2"
      />
      <circle
        cx="50"
        cy="50"
        r="31"
        fill="none"
        stroke="#fff"
        strokeOpacity=".22"
        strokeWidth="1"
        transform="translate(1 1)"
      />
      {emblem === 'initial' ? (
        <text
          x="50"
          y="63"
          textAnchor="middle"
          fontSize="36"
          fontFamily="var(--font-display)"
          fill="#000"
          fillOpacity=".38"
        >
          {(initial || '').slice(0, 1).toUpperCase()}
        </text>
      ) : (
        <path d={EMBLEMS[emblem] ?? EMBLEMS.heart} fill="#000" fillOpacity=".34" />
      )}
    </svg>
  )
}
