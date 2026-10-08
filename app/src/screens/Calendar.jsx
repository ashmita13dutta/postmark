import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Screen from '../app/Screen'
import Postmark from '../components/postmark/Postmark'
import Stamp from '../components/stamp/Stamp'
import { queries } from '../db/queries'
import { monthDays, monthLayout } from '../lib/calendar'
import { now } from '../lib/clock'
import { addMonths, daysUntil, monthKey, parseDay, todayKey } from '../lib/dates'
import { currentStreak } from '../lib/streak'
import './calendar.css'

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const SPRING = { type: 'spring', stiffness: 260, damping: 20 }

const longDate = (day) => {
  const { y, m, d } = parseDay(day)
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}
const monthTitle = (key) => {
  const { y, m } = monthLayout(key)
  return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

/** Tap a stamp: it lifts into a preview. A sealed postcard shows its stamp but not its note. */
function Preview({ moment, today, onClose }) {
  const reduced = useReducedMotion()
  const sealed = now() < moment.sealedUntil
  const fade = reduced ? { duration: 0 } : SPRING

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <motion.div
      className="cal__scrim"
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduced ? 0 : 0.18 }}
    >
      <motion.div
        className="cal__sheet"
        role="dialog"
        aria-modal="true"
        aria-label={`Stamp for ${longDate(moment.day)}`}
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: 40, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.95 }}
        transition={fade}
      >
        <div className="cal__big">
          <Stamp
            colors={moment.palette.map((c) => c.hex)}
            no={moment.stampNo}
            seed={moment.day}
            width={170}
            label={`Stamp: ${moment.palette.map((c) => c.name).join(', ')}`}
          />
          <div className="cal__big-mark">
            <Postmark day={moment.day} city={moment.city} />
          </div>
        </div>
        <h2>{longDate(moment.day)}</h2>
        <p className="cal__names">{moment.palette.map((c) => c.name).join(' · ')}</p>
        {sealed ? (
          <p className="cal__sealed">
            Sealed until{' '}
            {new Date(moment.sealedUntil).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'short',
            })}{' '}
            · {plural(daysUntil(moment.sealedUntil, now()), 'day')}. Your note opens on delivery.
          </p>
        ) : (
          <p className="cal__note">{moment.note}</p>
        )}
        <div className="cal__actions">
          {moment.day === today && (
            <Link className="cal__link" to="/">
              Open on Today
            </Link>
          )}
          <button className="cal__close" onClick={onClose}>
            Close
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

export default function Calendar() {
  const today = todayKey()
  const thisMonth = monthKey(today)
  const [month, setMonth] = useState(thisMonth)
  const [open, setOpen] = useState(null) // the moment whose preview is showing

  const moments = useLiveQuery(() => queries.momentsInMonth(month), [month], [])
  const allDays = useLiveQuery(async () => (await queries.allMoments()).map((m) => m.day), [], [])
  const firstMonth = allDays.length ? monthKey(allDays[0]) : thisMonth

  const byDay = useMemo(() => new Map(moments.map((m) => [m.day, m])), [moments])
  const { offset } = monthLayout(month)
  const days = monthDays(month)
  const nowMs = now()

  const isCurrent = month === thisMonth
  const blanks = days.filter((d) => d < today && !byDay.has(d)).length
  const streak = currentStreak(allDays, today)
  const streakLine = [
    streak > 0 ? `${streak}-day streak` : 'No streak yet',
    blanks > 0 ? `${plural(blanks, 'blank')} to fill` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <Screen caption="Your month" title="Calendar">
      <header className="cal__head">
        <button
          className="cal__nav"
          aria-label="Previous month"
          onClick={() => setMonth((k) => addMonths(k, -1))}
          disabled={month <= firstMonth}
        >
          ‹
        </button>
        <div className="cal__month">
          <h2>{monthTitle(month)}</h2>
          <p>{plural(moments.length, 'stamp')}</p>
        </div>
        <button
          className="cal__nav"
          aria-label="Next month"
          onClick={() => setMonth((k) => addMonths(k, 1))}
          disabled={isCurrent}
        >
          ›
        </button>
      </header>
      <p className="cal__streak">{streakLine}</p>

      <div className="cal__weekdays" aria-hidden="true">
        {WEEKDAYS.map((w, i) => (
          <span key={i}>{w}</span>
        ))}
      </div>
      <ol className="cal__grid" aria-label={monthTitle(month)}>
        {Array.from({ length: offset }, (_, i) => (
          <li key={`pad${i}`} aria-hidden="true" />
        ))}
        {days.map((day) => {
          const moment = byDay.get(day)
          const n = parseDay(day).d
          if (moment) {
            const sealed = nowMs < moment.sealedUntil
            return (
              <li key={day}>
                <button
                  className="cal__cell cal__cell--stamp"
                  onClick={() => setOpen(moment)}
                  aria-label={`${longDate(day)}, stamped${sealed ? ', sealed' : ''}`}
                >
                  <Stamp
                    colors={moment.palette.map((c) => c.hex)}
                    seed={day}
                    width={38}
                    small
                    label=""
                  />
                  {sealed && <i className="cal__wax" aria-hidden="true" />}
                  <span className="cal__n">{n}</span>
                </button>
              </li>
            )
          }
          if (day === today) {
            return (
              <li key={day}>
                <Link
                  className="cal__cell cal__cell--today"
                  to="/"
                  aria-label={`${longDate(day)}, not stamped yet`}
                >
                  <span className="cal__ghost cal__ghost--today" />
                  <span className="cal__n">{n}</span>
                </Link>
              </li>
            )
          }
          return (
            <li key={day}>
              <div
                className={`cal__cell ${day < today ? 'cal__cell--blank' : 'cal__cell--future'}`}
                aria-label={`${longDate(day)}${day < today ? ', no stamp' : ''}`}
              >
                <span className={day < today ? 'cal__ghost' : 'cal__ghost cal__ghost--none'} />
                <span className="cal__n">{n}</span>
              </div>
            </li>
          )
        })}
      </ol>

      <AnimatePresence>
        {open && (
          <Preview key={open.id} moment={open} today={today} onClose={() => setOpen(null)} />
        )}
      </AnimatePresence>
    </Screen>
  )
}
