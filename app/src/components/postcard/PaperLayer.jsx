import { frameStyle, hasFrame, paperStyle } from '../../data/papers'
import './paper.css'

/**
 * The paper itself: a background from papers.json with a little grain on top. Fills its parent and
 * sits behind the note (the parent has to be a stacking context, like a postcard face).
 */
export function PaperLayer({ paper, palette }) {
  return <div className="paper" style={paperStyle(paper, palette)} aria-hidden="true" />
}

/** The frame around the edge of a postcard, over the paper and under the stickers. */
export function FrameLayer({ frame }) {
  if (!hasFrame(frame)) return null
  return (
    <div
      className={frame.band ? 'frame frame--band' : 'frame'}
      style={frameStyle(frame)}
      aria-hidden="true"
    />
  )
}
