import { motion, useReducedMotion } from 'framer-motion'
import { findFrame, findPaper } from '../../data/papers'
import { parseDay } from '../../lib/dates'
import { FrameLayer, PaperLayer } from './PaperLayer'
import PhotoPeek from '../photo/PhotoPeek'
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
        <PhotoPeek momentId={moment.id} seed={moment.day} />
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

/**
 * The back of a postcard: who it is from, the note, and whatever is stuck on top (children). The
 * photo shows through the paper, turned the other way round (it is the same photo, seen from behind).
 */
export function PostcardBack({ moment, children }) {
  return (
    <>
      <div className="pcard__show" aria-hidden="true">
        <PhotoPeek momentId={moment.id} seed={moment.day} back scale={0.8} />
      </div>
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
 *  - look:         { paper, frame } ids from papers.json, as saved on the moment (both optional)
 *  - palette:      the day's five colors, for papers that use them
 */
export default function PostcardCard({
  flipped,
  front,
  back,
  onFrontClick,
  instant,
  look,
  palette,
}) {
  const reduced = useReducedMotion()
  const paper = findPaper(look?.paper)
  const frame = findFrame(look?.frame)
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
        <div
          className="pcard__face pcard__back"
          aria-hidden={!flipped}
          data-lines={paper.lines === false ? 'off' : undefined}
        >
          <PaperLayer paper={paper} palette={palette} />
          <FrameLayer frame={frame} />
          {back}
        </div>
      </motion.div>
    </div>
  )
}
