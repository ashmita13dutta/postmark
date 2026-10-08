import WaxSeal from '../postcard/WaxSeal'
import './envelope.css'

const KRAFT = '#d8c6a0'
const KRAFT_DARK = '#c2ad82'
const FLAP = '#cdb98f'
const AGED = '#e3d6b8'
const AGED_DARK = '#cfc09b'

// the same envelope shape everywhere: a back, a pocket with side panels, and a flap down to the V
const POCKET = 'M0 0 L135 125 L270 0 V190 H0 Z'
const FLAP_SHAPE = 'M0 0 H270 L135 125 Z'
// the delayed envelope has its top-right corner torn off
const TORN_BACK = 'M0 0 H222 L236 14 L229 26 L247 36 L270 31 V190 H0 Z'

const DEFAULT_WAX = { color: '#B14126', emblem: 'heart' }

/**
 * A closed envelope for the Mailbox.
 *  - kind:  'closed' (kraft, wax seal), 'aged' (faded year-ago letter), 'delayed' (torn corner and
 *           extra postmarks), or 'ghost' (a faint silhouette for "nothing here yet")
 *  - seal:  { color, emblem, initial? }; defaults to red wax for a postcard that was never sealed
 *  - width: px
 */
export default function Envelope({ kind = 'closed', seal, width = 108 }) {
  const height = (width * 190) / 270
  const aged = kind === 'aged'
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
      <svg viewBox="0 0 270 190" width={width} height={height}>
        <path
          d={kind === 'delayed' ? TORN_BACK : 'M0 0 H270 V190 H0 Z'}
          fill={aged ? AGED_DARK : KRAFT_DARK}
        />
        <path d={POCKET} fill={aged ? AGED : KRAFT} />
        <path
          d={FLAP_SHAPE}
          fill={aged ? '#dccdac' : FLAP}
          stroke={aged ? AGED_DARK : KRAFT_DARK}
          strokeWidth="2"
        />
        <path
          d="M0 190 L100 105 M270 190 L170 105"
          stroke={aged ? AGED_DARK : KRAFT_DARK}
          strokeWidth="1.5"
        />
        {kind === 'delayed' && (
          <g fill="none" stroke="#534AB7" strokeOpacity=".6" strokeWidth="3">
            <circle cx="62" cy="150" r="26" />
            <circle cx="62" cy="150" r="19" strokeWidth="1.5" />
            <circle cx="206" cy="154" r="22" strokeOpacity=".45" />
            <path d="M92 168 l60 -10 M92 178 l60 -10 M92 188 l60 -10" strokeWidth="2" />
          </g>
        )}
      </svg>
      <span className="env__wax" style={{ width: width * 0.28, height: width * 0.28 }}>
        <WaxSeal color={wax.color} emblem={wax.emblem} initial={wax.initial} size={width * 0.28} />
      </span>
    </div>
  )
}
