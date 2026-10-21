import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useState } from 'react'
import { queries } from '../../db/queries'
import { cleanName } from '../../lib/profile'
import Envelope from '../mailbox/Envelope'
import Postmark from '../postmark/Postmark'
import Stamp from '../stamp/Stamp'
import './onboarding.css'

// A pleasant sample day for the first frame
const SAMPLE = ['#2F7FD8', '#F25C9A', '#FFC93C', '#9AD9F2', '#FFF8EC']
const SPRING = { type: 'spring', stiffness: 220, damping: 20 }

/**
 * The welcome, three frames: a stamp builds itself, a postcard goes in the mail, and you say who you
 * are. It never asks for anything the app cannot use yet (no location, photos or notifications), and
 * on the last frame it asks the browser to keep your stamps. "Skip" is on every frame.
 *  - onDone: called after what you entered is saved
 */
export default function Onboarding({ onDone }) {
  const reduced = useReducedMotion()
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [busy, setBusy] = useState(false)
  const move = reduced ? { duration: 0 } : SPRING

  async function finish(save) {
    setBusy(true)
    try {
      if (save) {
        if (cleanName(name)) await queries.setSetting('name', cleanName(name))
        if (cleanName(city)) await queries.setSetting('homeCity', cleanName(city))
      }
      await queries.setSetting('onboarded', true)
      // ask the browser to keep the stamps; harmless if it says no (the You screen explains)
      await navigator.storage?.persist?.().catch(() => false)
    } finally {
      setBusy(false)
      onDone()
    }
  }

  const frames = [
    {
      title: 'Every day becomes a stamp',
      text: 'Write a line about your day. Its mood becomes five colors, and the colors become a little stamp.',
      art: (
        <div className="welcome__art welcome__art--stamp">
          <Stamp
            colors={SAMPLE}
            no={1}
            seed="welcome"
            width={190}
            pour={{ delay: 0.25, instant: reduced }}
            label="A sample stamp"
          />
          <motion.div
            className="welcome__mark"
            initial={reduced ? false : { opacity: 0, scale: 2.2, rotate: -14 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ ...move, delay: reduced ? 0 : 0.95 }}
          >
            <Postmark day="2026-10-09" />
          </motion.div>
        </div>
      ),
    },
    {
      title: 'Your postcards go in the mail',
      text: 'Seal a day with wax and it is posted to future you. You’ll open them on the 1st.',
      art: (
        <div className="welcome__art">
          <motion.div
            initial={reduced ? false : { y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={move}
          >
            <Envelope seal={{ color: '#B14126', emblem: 'rose' }} width={230} />
          </motion.div>
        </div>
      ),
    },
    {
      title: 'Stamp your first moment',
      text: 'Tell the postmaster who is posting. You can change this any time on You.',
      artLast: true, // the form goes under the words, not above them
      art: (
        <div className="welcome__form">
          <label>
            <span className="lbl">Your name</span>
            <input
              type="text"
              value={name}
              maxLength={30}
              placeholder="What should we call you?"
              autoComplete="off"
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label>
            <span className="lbl">Home city</span>
            <input
              type="text"
              value={city}
              maxLength={40}
              placeholder="Where you post from"
              autoComplete="off"
              onChange={(e) => setCity(e.target.value)}
            />
          </label>
          <p>Everything you write stays on this phone. Nothing is sent anywhere.</p>
        </div>
      ),
    },
  ]
  const frame = frames[step]
  const last = step === frames.length - 1

  return (
    <div className="welcome" role="dialog" aria-modal="true" aria-label="Welcome to Postmark">
      <button className="welcome__skip" onClick={() => finish(false)} disabled={busy}>
        Skip
      </button>
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          className="welcome__frame"
          initial={reduced ? false : { opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reduced ? undefined : { opacity: 0, x: -40 }}
          transition={{ duration: reduced ? 0 : 0.25 }}
        >
          {!frame.artLast && frame.art}
          <h1>{frame.title}</h1>
          <p className="welcome__text">{frame.text}</p>
          {frame.artLast && <div className="welcome__after">{frame.art}</div>}
        </motion.div>
      </AnimatePresence>
      <div className="welcome__foot">
        <div className="welcome__dots" aria-hidden="true">
          {frames.map((_, i) => (
            <i key={i} className={i === step ? 'on' : ''} />
          ))}
        </div>
        <button
          className="welcome__next"
          disabled={busy}
          onClick={() => (last ? finish(true) : setStep((s) => s + 1))}
        >
          {last ? 'Start' : 'Next'}
        </button>
      </div>
    </div>
  )
}
