import { useAnimate } from 'framer-motion'
import { useEffect, useRef } from 'react'
import Stamp from '../stamp/Stamp'
import WaxSeal from './WaxSeal'
import './sealsequence.css'

const KRAFT = '#d8c6a0'
const KRAFT_DARK = '#c2ad82'

/**
 * Seal & send: the postcard slides into an envelope, the flap closes, the wax seal presses down,
 * and the envelope flies toward the Mailbox tab. Calls `onDone` when it has landed.
 *
 * The postcard is already sealed in the database by the time this plays; this is only the show.
 * Only transform and opacity animate.
 */
export default function SealSequence({ moment, seal, onDone }) {
  const [scope, animate] = useAnimate()
  const doneRef = useRef(onDone)
  useEffect(() => {
    doneRef.current = onDone
  })

  useEffect(() => {
    let live = true
    const step = async (selector, keyframes, options) => {
      if (!live) return
      await animate(selector, keyframes, options)
    }
    ;(async () => {
      await step('[data-p="env"]', { opacity: [0, 1], y: [30, 0] }, { duration: 0.35 })
      await step(
        '[data-p="card"]',
        { y: [0, 100], scale: [1, 0.86] },
        { duration: 0.7, ease: 'easeInOut' },
      )
      await step('[data-p="flap"]', { rotateX: [180, 0] }, { duration: 0.5, ease: 'easeInOut' })
      await step(
        '[data-p="wax"]',
        { opacity: [0, 1, 1], scale: [2.2, 0.88, 1] },
        { duration: 0.4, times: [0, 0.65, 1], ease: 'easeOut' },
      )
      await step('[data-p="env"]', { scale: [1, 1.03, 1] }, { duration: 0.2 })
      await step(
        '[data-p="env"]',
        { y: [0, 360], x: [0, 4], scale: [1, 0.22], rotate: [0, -6], opacity: [1, 1, 0] },
        { duration: 0.75, ease: [0.5, 0, 0.8, 0.4], times: [0, 0.8, 1] },
      )
      if (live) doneRef.current()
    })()
    return () => {
      live = false
    }
  }, [animate])

  return (
    <div className="sealseq" ref={scope} aria-hidden="true">
      <div className="sealseq__env" data-p="env" style={{ opacity: 0 }}>
        <svg className="sealseq__back" viewBox="0 0 270 190" width="270" height="190">
          <rect width="270" height="190" rx="6" fill={KRAFT_DARK} />
        </svg>
        <div className="sealseq__card" data-p="card">
          <Stamp colors={moment.palette.map((c) => c.hex)} seed={moment.day} width={54} small />
        </div>
        <svg className="sealseq__front" viewBox="0 0 270 190" width="270" height="190">
          <path d="M0 0 L135 125 L270 0 V190 H0 Z" fill={KRAFT} />
          <path d="M0 0 L135 125 L270 0" fill="none" stroke={KRAFT_DARK} strokeWidth="2" />
          <path d="M0 190 L100 105 M270 190 L170 105" stroke={KRAFT_DARK} strokeWidth="1.5" />
        </svg>
        <svg
          className="sealseq__flap"
          data-p="flap"
          viewBox="0 0 270 130"
          width="270"
          height="130"
          style={{ transform: 'rotateX(180deg)' }}
        >
          <path d="M0 0 H270 L135 125 Z" fill="#cdb98f" stroke={KRAFT_DARK} strokeWidth="2" />
        </svg>
        <div className="sealseq__wax" data-p="wax" style={{ opacity: 0 }}>
          <WaxSeal color={seal.color} emblem={seal.emblem} initial={seal.initial} size={64} />
        </div>
      </div>
    </div>
  )
}
