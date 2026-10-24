import { motion, useReducedMotion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { roman } from '../../lib/album'
import VolumeCover from './VolumeCover'

// how long each step of the ceremony lasts, in ms
const STEPS = [1400, 1500, 1600]

/**
 * The year-end ceremony (spec 6.10), shown once when a finished year has not been closed: the album
 * closes, the final wax seal is pressed on the cover, the volume goes on the shelf and the next one
 * opens. Reduced motion, or the "reveal animation" preference turned off, skips straight to the end.
 *  - year, number: the volume being closed
 *  - moments:      that year's stamps
 *  - stickers:     its cover stickers
 *  - animate:      false to skip the show
 *  - onDone:       called when the person taps the final button
 */
export default function Ceremony({ year, number, moments, stickers, animate = true, onDone }) {
  const reduced = useReducedMotion()
  const still = reduced || !animate
  const [step, setStep] = useState(still ? 3 : 0) // 0 open, 1 closing, 2 sealed, 3 on the shelf

  useEffect(() => {
    if (step >= 3) return undefined
    const timer = setTimeout(() => setStep((s) => s + 1), STEPS[step])
    return () => clearTimeout(timer)
  }, [step])

  const words = [
    `${year} is over.`,
    'Closing the album…',
    'Sealed.',
    `Volume ${roman(number)} is on the shelf.`,
  ][step]

  return (
    <motion.div
      className="ceremony"
      role="dialog"
      aria-label={`Closing the album for ${year}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: still ? 0 : 0.4 }}
    >
      <p className="ceremony__words" aria-live="polite">
        {words}
      </p>
      <div className="ceremony__stage">
        <motion.div
          style={{ transformOrigin: 'left center', transformPerspective: 900 }}
          initial={false}
          animate={{
            rotateY: step === 0 ? -62 : 0,
            scale: step >= 3 ? 0.78 : 1,
            y: step >= 3 ? 14 : 0,
          }}
          transition={still ? { duration: 0 } : { type: 'spring', stiffness: 90, damping: 14 }}
        >
          <VolumeCover
            year={year}
            number={number}
            moments={moments}
            stickers={stickers}
            closed={step >= 2}
            width={210}
          />
        </motion.div>
      </div>
      {step >= 3 ? (
        <motion.div
          className="ceremony__end"
          initial={still ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <p>
            A new volume is open: {year + 1}. Your {year} album stays on the shelf, and you can open
            it any time.
          </p>
          <button className="cover__done" onClick={onDone}>
            Open the new volume
          </button>
        </motion.div>
      ) : (
        <button className="ceremony__skip" onClick={() => setStep(3)}>
          Skip
        </button>
      )}
    </motion.div>
  )
}
