import { stampTilt } from '../../lib/rng'
import StampArt from './StampArt'
import './stamp.css'

/**
 * A perforated postage stamp.
 *  - colors:  5 hex values (the day's palette)
 *  - no:      stamp number, shown as "No. 267"
 *  - seed:    any stable string (normally the day, 'YYYY-MM-DD'); drives the tilt so it
 *             never changes between renders
 *  - width:   CSS width in px; height follows the stamp's 5:6 shape
 *  - label:   accessible description, e.g. the palette names
 */
export default function Stamp({ colors, no, seed = '', width = 180, tilt, label, children }) {
  const deg = tilt ?? (seed ? stampTilt(seed) : 0)
  return (
    <div className="stamp" style={{ width, transform: `rotate(${deg}deg)` }}>
      {/* the shadow sits on the wrapper because the mask on .stamp__paper would clip it */}
      <div className="stamp__paper perf">
        <div className="stamp__art">
          <StampArt colors={colors} label={label} />
        </div>
        {no != null && <div className="stamp__no">No. {no}</div>}
      </div>
      {children}
    </div>
  )
}
