import { MONTHS, bandsOf, shortDay } from './bands'
import { quiltRows } from '../../lib/album'
import { useMemo } from 'react'

/**
 * The color quilt: a row for every month and a square for every day, each stamped day a little flag
 * of its five colors. Tap a stamped square to lift that stamp.
 */
export default function Quilt({ year, moments, today, onOpen }) {
  const rows = useMemo(() => quiltRows(year, moments, today), [year, moments, today])
  return (
    <section className="quilt" aria-label={`Your ${year} as a quilt, one square a day`}>
      <h2>The quilt</h2>
      <div className="quilt__rows">
        {rows.map((row) => (
          <div className="quilt__row" key={row.key}>
            <span className="quilt__month">{MONTHS[row.month - 1].slice(0, 3)}</span>
            <div className="quilt__cells">
              {row.cells.map((c) =>
                c.moment ? (
                  <button
                    key={c.day}
                    className={c.day === today ? 'sq sq--stamp sq--today' : 'sq sq--stamp'}
                    style={{ background: bandsOf(c.moment.palette) }}
                    onClick={() => onOpen(c.moment)}
                    aria-label={`${shortDay(c.day)}, stamped`}
                  />
                ) : (
                  <span
                    key={c.day}
                    className={`sq sq--${c.status}`}
                    role="img"
                    aria-label={`${shortDay(c.day)}${c.status === 'blank' ? ', no stamp' : ''}`}
                  />
                ),
              )}
            </div>
          </div>
        ))}
      </div>
      <p className="quilt__legend">
        <i className="sq sq--stamp" style={{ background: 'var(--postmark)' }} /> stamped
        <i className="sq sq--blank" /> no stamp
        <i className="sq sq--future" /> still to come
      </p>
    </section>
  )
}
