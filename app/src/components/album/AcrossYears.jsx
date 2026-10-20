import Stamp from '../stamp/Stamp'
import { parseDay } from '../../lib/dates'

/** "This day across years": the same date in each year that has a stamp for it, side by side. */
export default function AcrossYears({ items, today, onOpen }) {
  const { m, d } = parseDay(today)
  const title = new Date(2000, m - 1, d).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
  })
  return (
    <section className="across" aria-label={`${title} across years`}>
      <h2>{title}, across the years</h2>
      <ul>
        {items.map(({ year, moment }) => (
          <li key={moment.id}>
            <button onClick={() => onOpen(moment)} aria-label={`${title} ${year}`}>
              <Stamp
                colors={moment.palette.map((c) => c.hex)}
                seed={moment.day}
                width={70}
                small
                label=""
              />
              <span>{year}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
