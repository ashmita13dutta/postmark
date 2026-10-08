import { motion, useReducedMotion } from 'framer-motion'
import { parseDay } from '../../lib/dates'
import Postmark from '../postmark/Postmark'
import Stamp from '../stamp/Stamp'
import './letter.css'

export const shortDate = (day) => {
  const { y, m, d } = parseDay(day)
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/** The front of a postcard: its stamp with the postmark across the corner. Extra bits go below. */
export function PostcardFront({ moment, children }) {
  return (
    <>
      <div className="pcard__stamp">
        <Stamp
          colors={moment.palette.map((c) => c.hex)}
          no={moment.stampNo}
          seed={moment.day}
          width={150}
          label={`Stamp: ${moment.palette.map((c) => c.name).join(', ')}`}
        />
        <div className="pcard__mark">
          <Postmark day={moment.day} city={moment.city} />
        </div>
      </div>
      {children}
    </>
  )
}

/** The back of a postcard: who it is from, the note, and whatever is stuck on top (children). */
export function PostcardBack({ moment, children }) {
  return (
    <>
      <div className="pcard__head">
        <span className="lbl">From: {shortDate(moment.day)}</span>
        <span className="pcard__to">to future you</span>
      </div>
      <p className="pcard__note">{moment.note}</p>
      {children}
    </>
  )
}

/**
 * A postcard that turns over in 3D. `front` and `back` are the two faces' contents.
 *  - flipped:      show the back
 *  - onFrontClick: optional; makes the front a button (e.g. tap to flip)
 *  - instant:      skip the turn
 */
export default function PostcardCard({ flipped, front, back, onFrontClick, instant }) {
  const reduced = useReducedMotion()
  return (
    <div className="pcard__stage">
      <motion.div
        className="pcard"
        initial={false}
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={
          reduced || instant ? { duration: 0 } : { type: 'spring', stiffness: 120, damping: 17 }
        }
      >
        <div
          className="pcard__face pcard__front"
          onClick={onFrontClick}
          role={onFrontClick ? 'button' : undefined}
          aria-label={onFrontClick ? 'Flip the postcard over' : undefined}
          aria-hidden={flipped}
        >
          {front}
        </div>
        <div className="pcard__face pcard__back" aria-hidden={!flipped}>
          {back}
        </div>
      </motion.div>
    </div>
  )
}
