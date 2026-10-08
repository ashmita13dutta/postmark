import { motion, useReducedMotion } from 'framer-motion'
import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import Screen from '../app/Screen'
import Postmark from '../components/postmark/Postmark'
import Stamp from '../components/stamp/Stamp'
import Stamper from '../components/stamper/Stamper'
import { queries } from '../db/queries'
import { now } from '../lib/clock'
import { daysUntil, parseDay, todayKey } from '../lib/dates'
import { seededRng } from '../lib/rng'
import './reveal.css'

const SPRING = { type: 'spring', stiffness: 260, damping: 20 }
const MAX_CONFETTI = 12 // spec 8.3: never more than 15

// When each beat of the ~3s reveal starts, in seconds (spec 8.3).
// The stamper starts at `stamper`, presses at 1.0 and holds until `postmark`, when it lifts and
// the print is revealed underneath.
const AT = {
  stamp: 0.3,
  bands: 0.6,
  stamper: 0.4,
  postmark: 1.15,
  ambient: 1.6,
  five: 2.1,
  buttons: 2.6,
}
const STAMPER_SECONDS = 1.0

const SOURCE_TAG = {
  moment: '✦ from your words',
  manual: 'your own colors',
  photo: 'from your photo',
}

function shortDate(day) {
  const { y, m, d } = parseDay(day)
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

/** A few specks of ink flicked out around the print when the stamper lifts. */
function Splatter({ day, instant }) {
  const dots = useMemo(() => {
    const rnd = seededRng(`splat:${day}`)
    return Array.from({ length: 9 }, () => {
      const a = rnd() * Math.PI * 2
      const r = 58 + rnd() * 16
      return { x: Math.cos(a) * r, y: Math.sin(a) * r, s: 2 + rnd() * 3.5 }
    })
  }, [day])
  return (
    <div className="reveal__splatter" aria-hidden="true">
      {dots.map((p, i) => (
        <motion.i
          key={i}
          style={{ width: p.s, height: p.s, x: p.x, y: p.y }}
          initial={instant ? false : { scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 0.7 }}
          transition={{ ...SPRING, delay: AT.postmark + i * 0.01 }}
        />
      ))}
    </div>
  )
}

/** A handful of confetti pieces in the day's colors, placed the same way every time. */
function Confetti({ colors, day, instant }) {
  const pieces = useMemo(() => {
    const rnd = seededRng(`confetti:${day}`)
    return Array.from({ length: MAX_CONFETTI }, (_, i) => ({
      color: colors[i % colors.length],
      x: (rnd() * 2 - 1) * 150,
      y: (rnd() * 2 - 1) * 150 + 20,
      rot: rnd() * 360,
      w: 6 + rnd() * 5,
      h: 10 + rnd() * 6,
      delay: AT.ambient + rnd() * 0.5,
    }))
  }, [colors, day])
  return (
    <div className="reveal__confetti" aria-hidden="true">
      {pieces.map((p, i) => (
        <motion.i
          key={i}
          style={{ background: p.color, width: p.w, height: p.h }}
          initial={instant ? false : { x: p.x * 0.4, y: p.y - 200, rotate: 0, opacity: 0 }}
          animate={{ x: p.x, y: p.y, rotate: p.rot, opacity: 0.9 }}
          transition={{ ...SPRING, damping: 14, delay: p.delay }}
        />
      ))}
    </div>
  )
}

export default function Reveal() {
  const day = todayKey()
  const moment = useLiveQuery(async () => (await queries.getMomentByDay(day)) ?? null, [day])
  const setting = useLiveQuery(() => queries.getSetting('revealAnimation'), [])
  const reducedMotion = useReducedMotion()
  const [skipped, setSkipped] = useState(false)

  if (moment === undefined || setting === undefined) return <Screen caption="Postmark" title=" " />
  // nothing stamped today, so nothing to reveal
  if (moment === null) return <Navigate to="/" replace />

  const instant = skipped || reducedMotion || !setting
  const colors = moment.palette.map((c) => c.hex)
  const dueIn = daysUntil(moment.sealedUntil, now())
  const t = (s) => (instant ? 0 : s)
  const rise = (delay) => ({
    initial: instant ? false : { opacity: 0, y: 18 },
    animate: { opacity: 1, y: 0 },
    transition: { ...SPRING, delay },
  })

  return (
    // remounting on skip is what makes every animation jump to its end state at once
    <Screen key={instant ? 'end' : 'play'} caption={`Stamp No. ${moment.stampNo}`} title="Stamped.">
      <div
        className="reveal__stage"
        onClick={() => setSkipped(true)}
        role="presentation"
        data-testid="reveal-stage"
      >
        <motion.div
          className="reveal__drop"
          initial={instant ? false : { y: -90, opacity: 0, rotate: -6 }}
          animate={{ y: 0, opacity: 1, rotate: 0 }}
          transition={{ ...SPRING, stiffness: 180, damping: 11, delay: t(AT.stamp) }}
        >
          <Stamp
            colors={colors}
            no={moment.stampNo}
            seed={day}
            width={190}
            label={`Today's stamp: ${moment.palette.map((c) => c.name).join(', ')}`}
            pour={{ delay: t(AT.bands), instant }}
          />
        </motion.div>

        <div className="reveal__print">
          <motion.div
            className="reveal__postmark-wrap"
            initial={instant ? false : { scale: 0.94, opacity: 0, rotate: -12 }}
            animate={{ scale: [0.94, 1.04, 1], opacity: 1, rotate: -12 }}
            transition={
              instant
                ? { duration: 0 }
                : { duration: 0.35, times: [0, 0.5, 1], ease: 'easeOut', delay: AT.postmark }
            }
          >
            <Postmark day={day} city={moment.city} />
          </motion.div>
          <Splatter day={day} instant={instant} />
          {!instant && <Stamper delay={AT.stamper} duration={STAMPER_SECONDS} />}
        </div>

        <Confetti colors={colors} day={day} instant={instant} />
        {!reducedMotion && (
          <div className="reveal__sparkles" aria-hidden="true">
            <i>✦</i>
            <i>✦</i>
            <i>✦</i>
          </div>
        )}
        {!instant && (
          <motion.p
            className="reveal__skip"
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.4, delay: AT.buttons }}
          >
            Tap to skip
          </motion.p>
        )}
      </div>

      <motion.section className="reveal__five" {...rise(t(AT.five))} aria-label="Today's five">
        <h2 className="lbl">Today&apos;s five</h2>
        <ul>
          {moment.palette.map((c) => (
            <li key={c.hex + c.name}>
              <i style={{ background: c.hex }} />
              {c.name}
            </li>
          ))}
        </ul>
        <p className="reveal__tag">{SOURCE_TAG[moment.paletteSource] ?? ''}</p>
      </motion.section>

      <motion.div className="reveal__actions" {...rise(t(AT.buttons))}>
        <Link className="reveal__primary" to="/">
          Back to Today
        </Link>
        <p className="reveal__badge">
          Sealed until {shortDate(new Date(moment.sealedUntil).toLocaleDateString('en-CA'))} ·{' '}
          {dueIn} {dueIn === 1 ? 'day' : 'days'}
        </p>
      </motion.div>
    </Screen>
  )
}
