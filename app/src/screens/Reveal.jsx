import { motion, useReducedMotion } from 'framer-motion'
import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import Screen from '../app/Screen'
import Stamp from '../components/stamp/Stamp'
import { queries } from '../db/queries'
import { now } from '../lib/clock'
import { daysUntil, parseDay, todayKey } from '../lib/dates'
import { seededRng } from '../lib/rng'
import './reveal.css'

const SPRING = { type: 'spring', stiffness: 260, damping: 20 }
const MAX_CONFETTI = 12 // spec 8.3: never more than 15

// When each beat of the ~3s reveal starts, in seconds (spec 8.3).
const AT = { stamp: 0.3, bands: 0.6, postmark: 1.0, ambient: 1.5, five: 2.0, buttons: 2.5 }

const SOURCE_TAG = {
  moment: '✦ from your words',
  manual: 'your own colors',
  photo: 'from your photo',
}

function shortDate(day) {
  const { y, m, d } = parseDay(day)
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

/** The postmark: two rings with the date running round the top. */
function Postmark({ day }) {
  const { y, m, d } = parseDay(day)
  const date = new Date(y, m - 1, d)
    .toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    .toUpperCase()
  return (
    <svg
      className="reveal__postmark"
      viewBox="0 0 100 100"
      role="img"
      aria-label={`Postmarked ${date}`}
    >
      <defs>
        <path id="pm-arc" d="M 50 50 m -33 0 a 33 33 0 1 1 66 0 a 33 33 0 1 1 -66 0" />
      </defs>
      <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeWidth="2.2" />
      <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="1" />
      <text fontSize="9.5" letterSpacing="1.6" fill="currentColor" fontFamily="var(--font-mono)">
        <textPath href="#pm-arc" startOffset="2%">
          POSTMARK · {date} ·
        </textPath>
      </text>
      <text
        x="50"
        y="55"
        textAnchor="middle"
        fontSize="15"
        fill="currentColor"
        fontFamily="var(--font-display)"
      >
        ✦
      </text>
    </svg>
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

        <motion.div
          className="reveal__postmark-wrap"
          initial={instant ? false : { scale: 1.7, opacity: 0, rotate: -24 }}
          animate={{ scale: [1.7, 0.92, 1], opacity: 1, rotate: -12 }}
          transition={
            instant
              ? { duration: 0 }
              : { duration: 0.45, times: [0, 0.6, 1], ease: 'easeOut', delay: AT.postmark }
          }
        >
          <Postmark day={day} />
        </motion.div>

        <Confetti colors={colors} day={day} instant={instant} />
        {!reducedMotion && (
          <div className="reveal__sparkles" aria-hidden="true">
            <i>✦</i>
            <i>✦</i>
            <i>✦</i>
          </div>
        )}
        {!instant && <p className="reveal__skip">Tap to skip</p>}
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
