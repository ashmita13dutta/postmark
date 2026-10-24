import { roman } from '../../lib/album'

/**
 * The bookshelf: one spine per year, "Volume I" the oldest. The open volume is pulled out a little,
 * and a closed one (its year is over and its ceremony has been done) carries a dot of wax.
 */
export default function Shelf({ books, year, closedYears = [], onPick }) {
  return (
    <div className="shelf" role="tablist" aria-label="Volumes">
      {books.map((b) => (
        <button
          key={b.year}
          role="tab"
          aria-selected={b.year === year}
          className={`${b.year === year ? 'spine spine--out' : 'spine'}${closedYears.includes(b.year) ? ' spine--closed' : ''}`}
          onClick={() => onPick(b.year)}
        >
          <span className="spine__vol">Volume {roman(b.number)}</span>
          <span className="spine__year">{b.year}</span>
        </button>
      ))}
    </div>
  )
}
