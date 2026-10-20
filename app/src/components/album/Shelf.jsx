import { roman } from '../../lib/album'

/**
 * The bookshelf: one spine per year, "Volume I" the oldest. The open volume is pulled out a little.
 */
export default function Shelf({ books, year, onPick }) {
  return (
    <div className="shelf" role="tablist" aria-label="Volumes">
      {books.map((b) => (
        <button
          key={b.year}
          role="tab"
          aria-selected={b.year === year}
          className={b.year === year ? 'spine spine--out' : 'spine'}
          onClick={() => onPick(b.year)}
        >
          <span className="spine__vol">Volume {roman(b.number)}</span>
          <span className="spine__year">{b.year}</span>
        </button>
      ))}
    </div>
  )
}
