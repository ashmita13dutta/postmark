import { useAnimate, useReducedMotion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { queries } from '../../db/queries'
import WaxSeal from '../postcard/WaxSeal'
import LetterView from './LetterView'
import './open-ritual.css'
import Paper from './Paper'

const DEFAULT_WAX = { color: '#B14126', emblem: 'rose' }

/**
 * The opening ritual (spec 8.6): tap the envelope, the wax seal cracks in two, the flap opens,
 * and the postcard slides out. When it has finished the postcard is marked opened and shown in
 * full. With Reduce Motion on, it skips straight to the postcard.
 *
 *  - moment: the delivered postcard
 *  - seal:   its wax seal ({ color, emblem, initial? }), if it has one
 */
export default function OpenRitual({ moment, seal, onClose }) {
  const reduced = useReducedMotion()
  const [scope, animate] = useAnimate()
  const [phase, setPhase] = useState(reduced ? 'letter' : 'closed') // closed | opening | letter
  const started = useRef(false)
  const wax = seal ?? DEFAULT_WAX

  // record that it has been opened, once, whichever way we got to the letter
  const marked = useRef(false)
  async function markOpened() {
    if (marked.current) return
    marked.current = true
    await queries.markOpened(moment.id).catch(() => {})
  }

  useEffect(() => {
    if (reduced) markOpened()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced])

  async function open() {
    if (started.current) return
    started.current = true
    setPhase('opening')
    await Promise.all([
      animate('[data-p="waxL"]', { x: -18, y: 14, rotate: -20, opacity: 0 }, { duration: 0.5 }),
      animate('[data-p="waxR"]', { x: 18, y: 14, rotate: 20, opacity: 0 }, { duration: 0.5 }),
      animate('[data-p="hint"]', { opacity: 0 }, { duration: 0.2 }),
    ])
    await animate('[data-p="flap"]', { rotateX: 180 }, { duration: 0.55, ease: 'easeInOut' })
    await animate('[data-p="flap"]', { zIndex: 0 }, { duration: 0 })
    await animate('[data-p="card"]', { y: [100, -80] }, { duration: 0.75, ease: 'easeOut' })
    await markOpened()
    setPhase('letter')
  }

  if (phase === 'letter') return <LetterView moment={moment} onClose={onClose} />

  return (
    <div
      className="ritual"
      ref={scope}
      onClick={onClose}
      role="dialog"
      aria-label="Open your postcard"
    >
      <div className="ritual__stage" onClick={(e) => e.stopPropagation()}>
        <button
          className="ritual__env"
          onClick={open}
          disabled={phase === 'opening'}
          aria-label="Open the envelope"
        >
          <Paper part="back" className="ritual__back" />
          <span className="ritual__card" data-p="card" style={{ transform: 'translateY(100px)' }} />
          <Paper part="front" className="ritual__front" />
          <Paper part="flap" className="ritual__flap" data-p="flap" />
          <span className="ritual__wax">
            <span data-p="waxL" className="ritual__half ritual__half--l">
              <WaxSeal color={wax.color} emblem={wax.emblem} initial={wax.initial} size={84} />
            </span>
            <span data-p="waxR" className="ritual__half ritual__half--r">
              <WaxSeal color={wax.color} emblem={wax.emblem} initial={wax.initial} size={84} />
            </span>
          </span>
        </button>
        <p className="ritual__hint" data-p="hint">
          Tap to open
        </p>
        <button className="ritual__later" onClick={onClose}>
          Not yet
        </button>
      </div>
    </div>
  )
}
