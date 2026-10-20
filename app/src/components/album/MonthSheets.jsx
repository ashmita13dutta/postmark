import { Link } from 'react-router-dom'
import { MONTHS, bandsOf } from './bands'
import { monthSheet } from '../../lib/album'

const pad = (n) => String(n).padStart(2, '0')

/**
 * A swipeable row of twelve month sheets. Each is a little calendar page; tap one to open that month
 * in the Calendar. Months that have not come yet are faded.
 */
export default function MonthSheets({ year, moments, today }) {
  return (
    <section className="sheets" aria-label="Month sheets">
      <h2>Month by month</h2>
      <ul className="sheets__row">
        {MONTHS.map((name, i) => {
          const key = `${year}-${pad(i + 1)}`
          const sheet = monthSheet(key, moments, today)
          const coming = key > today.slice(0, 7)
          const body = (
            <>
              <b>{name}</b>
              <small>
                {coming ? 'to come' : `${sheet.stamps} ${sheet.stamps === 1 ? 'stamp' : 'stamps'}`}
              </small>
              <span className="sheet__grid" aria-hidden="true">
                {Array.from({ length: sheet.offset }, (_, j) => (
                  <i key={`p${j}`} className="d d--pad" />
                ))}
                {sheet.cells.map((c) => (
                  <i
                    key={c.day}
                    className={`d d--${c.status}`}
                    style={c.moment ? { background: bandsOf(c.moment.palette) } : undefined}
                  />
                ))}
              </span>
            </>
          )
          return (
            <li key={key} className={coming ? 'sheet sheet--coming' : 'sheet'}>
              {coming ? (
                <div className="sheet__link">{body}</div>
              ) : (
                <Link
                  className="sheet__link"
                  to={`/calendar?month=${key}`}
                  aria-label={`${name} ${year}: ${sheet.stamps} stamps. Open in the Calendar`}
                >
                  {body}
                </Link>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
