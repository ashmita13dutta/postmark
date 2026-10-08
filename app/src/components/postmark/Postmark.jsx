import { useId } from 'react'
import { parseDay } from '../../lib/dates'
import './postmark.css'

/**
 * The postmark: outer ring, POSTMARK over the top, the city (or stars) under, and a date box.
 * Drawn in `currentColor`, so the parent picks the ink.
 *  - day:  'YYYY-MM-DD'
 *  - city: optional; shown in capitals along the bottom arc
 */
export default function Postmark({ day, city }) {
  // two copies on one screen must not share path ids
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const { y, m, d } = parseDay(day)
  const dayMonth = new Date(y, m - 1, d)
    .toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    .toUpperCase()
  return (
    <svg
      className="postmark"
      viewBox="0 0 120 120"
      role="img"
      aria-label={`Postmarked ${dayMonth} ${y}`}
    >
      <defs>
        <path id={`${uid}-top`} d="M27 60 a33 33 0 0 1 66 0" />
        <path id={`${uid}-bottom`} d="M27 62 a33 33 0 0 0 66 0" />
      </defs>
      <g fill="none" stroke="currentColor">
        <circle cx="60" cy="60" r="46" strokeWidth="2.2" />
        <circle cx="60" cy="60" r="26" strokeWidth="1" />
        <path d="M38 60h44" strokeWidth="1" />
      </g>
      <g fill="currentColor" fontFamily="var(--font-mono)" fontSize="8.5" letterSpacing="2">
        <text textAnchor="middle">
          <textPath href={`#${uid}-top`} startOffset="50%">
            POSTMARK
          </textPath>
        </text>
        <text textAnchor="middle">
          <textPath href={`#${uid}-bottom`} startOffset="50%">
            {city ? city.toUpperCase() : '✦ ✦ ✦'}
          </textPath>
        </text>
      </g>
      <text
        x="60"
        y="56"
        textAnchor="middle"
        fontSize="12"
        fill="currentColor"
        fontFamily="var(--font-display)"
      >
        {dayMonth}
      </text>
      <text
        x="60"
        y="72"
        textAnchor="middle"
        fontSize="10"
        fill="currentColor"
        fontFamily="var(--font-mono)"
      >
        {y}
      </text>
    </svg>
  )
}
