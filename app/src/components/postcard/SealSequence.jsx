import { useAnimate } from 'framer-motion'
import { useEffect, useRef } from 'react'
import Paper from '../mailbox/Paper'
import Stamp from '../stamp/Stamp'
import WaxSeal from './WaxSeal'
import './sealsequence.css'


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
        <Paper part="back" className="sealseq__back" />
        <div className="sealseq__card" data-p="card">
          <Stamp colors={moment.palette.map((c) => c.hex)} seed={moment.day} width={54} small />
        </div>
        <Paper part="front" className="sealseq__front" />
        <Paper
          part="flap"
          className="sealseq__flap"
          data-p="flap"
          style={{ transform: 'rotateX(180deg)' }}
        />
        <div className="sealseq__wax" data-p="wax" style={{ opacity: 0 }}>
          <WaxSeal color={seal.color} emblem={seal.emblem} initial={seal.initial} size={84} />
        </div>
      </div>
    </div>
  )
}
