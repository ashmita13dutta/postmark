import { FRAMES, PAPERS, findFrame, findPaper } from '../../data/papers'
import { FrameLayer, PaperLayer } from './PaperLayer'

// A postcard is 300 px wide at full size; a tile draws the whole card at this fraction, so a gingham
// check or a stitched border looks the way it will on the card, only smaller.
const MINI = 0.17

function MiniCard({ paper, frame, palette }) {
  return (
    <span className="tray__swatch">
      <span className="tray__mini" style={{ transform: `scale(${MINI})` }}>
        <PaperLayer paper={paper} palette={palette} />
        <FrameLayer frame={frame} />
      </span>
    </span>
  )
}

/**
 * The tiles on the tray's Paper and Frames tabs. Each is a tiny postcard showing that choice, with
 * the other choice (the frame for a paper tile, the paper for a frame tile) as it is right now.
 * `kind` is 'paper' or 'frames'. Tapping a tile picks it; the picked one is ringed.
 */
export default function LookTiles({ kind, paperId, frameId, palette, onPaper, onFrame }) {
  const papers = kind === 'paper'
  const paper = findPaper(paperId)
  const frame = findFrame(frameId)
  const chosen = papers ? paper : frame
  return (
    <ul className="tray__items">
      {(papers ? PAPERS : FRAMES).map((item) => {
        const on = item.id === chosen.id
        return (
          <li key={item.id}>
            <button
              className={on ? 'tray__item tray__look on' : 'tray__item tray__look'}
              aria-pressed={on}
              aria-label={`${papers ? 'Paper' : 'Frame'}: ${item.label}`}
              onClick={() => (papers ? onPaper(item.id) : onFrame(item.id))}
            >
              <MiniCard
                paper={papers ? item : paper}
                frame={papers ? frame : item}
                palette={palette}
              />
              <span className="tray__cap">{item.label}</span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
