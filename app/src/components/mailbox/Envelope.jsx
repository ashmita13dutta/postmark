import WaxSeal from '../postcard/WaxSeal'
import './envelope.css'
import Paper from './Paper'

const DEFAULT_WAX = { color: '#B14126', emblem: 'rose' }

/**
 * A closed envelope for the Mailbox.
 *  - kind:  'closed' (roasted paper, wax seal), 'aged' (faded year-ago letter), 'delayed' (torn corner and
 *           extra postmarks), or 'ghost' (a faint silhouette for "nothing here yet")
 *  - seal:  { color, emblem, initial? }; defaults to red wax for a postcard that was never sealed
 *  - width: px
 */
export default function Envelope({ kind = 'closed', seal, width = 108 }) {
  const height = (width * 190) / 270
  const tone = kind === 'aged' ? 'aged' : 'roast'
  const wax = seal ?? DEFAULT_WAX

  if (kind === 'ghost') {
    return (
      <div className="env env--ghost" style={{ width, height }} aria-hidden="true">
        <svg viewBox="0 0 270 190" width={width} height={height} fill="none">
          <rect x="2" y="2" width="266" height="186" rx="6" />
          <path d="M2 4 L135 123 L268 4" />
        </svg>
      </div>
    )
  }

  return (
    <div className={`env env--${kind}`} style={{ width, height }}>
      <div className="env__paper" style={{ transform: `scale(${width / 270})` }}>
        <Paper part="back" tone={tone} torn={kind === 'delayed'} />
        <Paper part="front" tone={tone} />
        <Paper part="flap" tone={tone} className="env__flap" />
        {kind === 'delayed' && (
          <svg viewBox="0 0 270 190" width="270" height="190" className="env__marks">
            <g fill="none" stroke="#534AB7" strokeOpacity=".6" strokeWidth="3">
              <circle cx="62" cy="150" r="26" />
              <circle cx="62" cy="150" r="19" strokeWidth="1.5" />
              <circle cx="206" cy="154" r="22" strokeOpacity=".45" />
              <path d="M92 168 l60 -10 M92 178 l60 -10 M92 188 l60 -10" strokeWidth="2" />
            </g>
          </svg>
        )}
      </div>
      <span className="env__wax" style={{ width: width * 0.3, height: width * 0.3 }}>
        <WaxSeal color={wax.color} emblem={wax.emblem} initial={wax.initial} size={width * 0.3} />
      </span>
    </div>
  )
}
