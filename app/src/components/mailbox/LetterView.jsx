import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { queries } from '../../db/queries'
import { parseDay } from '../../lib/dates'
import DecorLayer from '../postcard/DecorLayer'
import PostcardCard, { PostcardBack, PostcardFront } from '../postcard/PostcardCard'
import Stamp from '../stamp/Stamp'
import './letter-view.css'

const noop = () => {}
const monthYear = (day) => {
  const { y, m } = parseDay(day)
  return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}

/**
 * An opened postcard, full screen: the stamp first, then it turns over to the note with
 * everything that was stuck on it.
 *  - mode: 'read' (an ordinary postcard), 'yearago' (shown beside today's stamp), or 'delayed'
 *          (arrives with an apology slip from the postal service)
 *  - thisYear: today's postcard, shown next to last year's in 'yearago' mode
 */
export default function LetterView({ moment, mode = 'read', thisYear, onClose }) {
  const decorations = useLiveQuery(() => queries.decorationsFor(moment.id), [moment.id], [])
  const [flipped, setFlipped] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setFlipped(true), 700)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="letter" role="dialog" aria-modal="true" aria-label="Your postcard">
      <div className="letter__inner">
        {mode === 'delayed' && (
          <aside className="letter__slip">
            <span className="lbl">From the postal service</span>
            <p>
              We are sorry. This one was delayed in transit, and it has taken a while to find you.
              Please accept our apologies and this postcard, a little worn at the corner.
            </p>
          </aside>
        )}

        {mode === 'yearago' && (
          <div className="letter__pair" aria-label="A year ago and today">
            <figure>
              <Stamp
                colors={moment.palette.map((c) => c.hex)}
                seed={moment.day}
                width={64}
                small
                label=""
              />
              <figcaption>{monthYear(moment.day)}</figcaption>
            </figure>
            <span className="letter__arrow" aria-hidden="true">
              →
            </span>
            <figure>
              {thisYear ? (
                <Stamp
                  colors={thisYear.palette.map((c) => c.hex)}
                  seed={thisYear.day}
                  width={64}
                  small
                  label=""
                />
              ) : (
                <span className="letter__blank" />
              )}
              <figcaption>Today</figcaption>
            </figure>
          </div>
        )}

        <PostcardCard
          flipped={flipped}
          onFrontClick={() => setFlipped(true)}
          front={<PostcardFront moment={moment} />}
          back={
            <PostcardBack moment={moment}>
              <DecorLayer
                decorations={decorations}
                palette={moment.palette}
                locked
                onSelect={noop}
                onChange={noop}
              />
            </PostcardBack>
          }
        />

        <div className="letter__actions">
          <button className="letter__flip" onClick={() => setFlipped((f) => !f)}>
            {flipped ? 'Show the stamp' : 'Read the note'}
          </button>
          <button className="letter__close" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
