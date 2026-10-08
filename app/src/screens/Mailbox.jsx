import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import Screen from '../app/Screen'
import Envelope from '../components/mailbox/Envelope'
import LetterView from '../components/mailbox/LetterView'
import OpenRitual from '../components/mailbox/OpenRitual'
import Stamp from '../components/stamp/Stamp'
import { queries } from '../db/queries'
import { now } from '../lib/clock'
import { daysUntil, monthKey, parseDay, todayKey } from '../lib/dates'
import { groupByMonth, headlineGroup, nextDelivery, yearAgoLetter } from '../lib/mailbox'
import './mailbox.css'

const NO_MOMENTS = []
const NO_SEALS = new Map()
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`
const monthName = (key) => {
  const { y, m } = parseDay(`${key}-01`)
  return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'long' })
}
const monthYear = (key) => {
  const { y, m } = parseDay(`${key}-01`)
  return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}
const dayNumber = (day) => parseDay(day).d

/** The envelopes still to open and the stamps already opened, for one month. */
function MonthGrid({ group, seals, onOpen }) {
  const waiting = group.moments.filter((m) => m.openedAt == null)
  const opened = group.moments.filter((m) => m.openedAt != null)
  return (
    <>
      {waiting.length > 0 && (
        <>
          <h3 className="lbl mb__sub">Waiting to open</h3>
          <ul className="mb__grid">
            {waiting.map((m) => (
              <li key={m.id}>
                <button
                  className="mb__item"
                  onClick={() => onOpen(m, 'ritual')}
                  aria-label={`Open the postcard from ${dayNumber(m.day)} ${monthName(group.monthKey)}`}
                >
                  <Envelope seal={seals.get(m.id)} width={92} />
                  <span className="mb__n">{dayNumber(m.day)}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {opened.length > 0 && (
        <>
          <h3 className="lbl mb__sub">Opened</h3>
          <ul className="mb__grid mb__grid--opened">
            {opened.map((m) => (
              <li key={m.id}>
                <button
                  className="mb__item"
                  onClick={() => onOpen(m, 'read')}
                  aria-label={`Read the postcard from ${dayNumber(m.day)} ${monthName(group.monthKey)}`}
                >
                  <Stamp
                    colors={m.palette.map((c) => c.hex)}
                    seed={m.day}
                    width={40}
                    small
                    label=""
                  />
                  <span className="mb__n">{dayNumber(m.day)}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  )
}

export default function Mailbox() {
  const today = todayKey()
  const nowMs = now()
  // undefined until loaded, so the empty state never flashes before the postcards arrive
  const loadedDelivered = useLiveQuery(() => queries.deliveredMoments(now()), [])
  const loadedAll = useLiveQuery(() => queries.allMoments(), [])
  const loadedSeals = useLiveQuery(() => queries.allSeals(), [])
  const ready = loadedDelivered && loadedAll && loadedSeals
  const delivered = loadedDelivered ?? NO_MOMENTS
  const all = loadedAll ?? NO_MOMENTS
  const seals = loadedSeals ?? NO_SEALS
  const [delayed, setDelayed] = useState(null)
  const [open, setOpen] = useState(null) // { moment, mode }

  // decided once per month, the first time the Mailbox is opened (spec 6.5)
  useEffect(() => {
    let live = true
    queries.delayedForMonth(monthKey(today)).then((m) => live && setDelayed(m))
    return () => {
      live = false
    }
  }, [today])

  const groups = useMemo(() => groupByMonth(delivered), [delivered])
  const headline = headlineGroup(groups)
  const older = groups.filter((g) => g !== headline)
  const yearAgo = useMemo(() => yearAgoLetter(delivered, today), [delivered, today])
  const thisYear = all.find((m) => m.day === today)
  const next = nextDelivery(all, nowMs)

  if (!ready) return <Screen caption="On the 1st" title="Mailbox" />

  const show = (moment, mode) => setOpen({ moment, mode })
  const close = () => setOpen(null)

  return (
    <Screen caption="On the 1st" title="Mailbox">
      {(yearAgo || delayed) && (
        <ul className="mb__special">
          {yearAgo && (
            <li>
              <button className="mb__card" onClick={() => show(yearAgo, 'yearago')}>
                <Envelope kind="aged" seal={seals.get(yearAgo.id)} width={84} />
                <span>
                  <strong>A letter from past you</strong>
                  <small>From {monthYear(monthKey(yearAgo.day))}</small>
                </span>
              </button>
            </li>
          )}
          {delayed && (
            <li>
              <button className="mb__card" onClick={() => show(delayed, 'delayed')}>
                <Envelope kind="delayed" seal={seals.get(delayed.id)} width={84} />
                <span>
                  <strong>Delayed in transit</strong>
                  <small>An old postcard has finally arrived</small>
                </span>
              </button>
            </li>
          )}
        </ul>
      )}

      {headline ? (
        <section className="mb__batch" aria-label={`${monthName(headline.monthKey)} postcards`}>
          <h2>Your {monthName(headline.monthKey)} has arrived</h2>
          <p className="mb__count">
            {plural(headline.total, 'postcard')} · {headline.opened} of {headline.total} opened
          </p>
          <div
            className="mb__bar"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={headline.total}
            aria-valuenow={headline.opened}
            aria-label="Postcards opened"
          >
            <i style={{ width: `${(headline.opened / headline.total) * 100}%` }} />
          </div>
          <MonthGrid group={headline} seals={seals} onOpen={show} />
        </section>
      ) : (
        <section className="mb__quiet">
          <div className="mb__ghosts" aria-hidden="true">
            <Envelope kind="ghost" width={96} />
            <Envelope kind="ghost" width={96} />
            <Envelope kind="ghost" width={96} />
          </div>
          <h2>{delivered.length > 0 ? 'You are all caught up' : 'Nothing has arrived yet'}</h2>
          <p>
            {next
              ? `Next delivery in ${plural(daysUntil(next, nowMs), 'day')}, on ${new Date(next).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}.`
              : 'Stamp a day and seal the postcard. Your first one arrives on the 1st of next month.'}
          </p>
        </section>
      )}

      {headline && next && (
        <p className="mb__next">Next delivery in {plural(daysUntil(next, nowMs), 'day')}</p>
      )}

      {older.length > 0 && (
        <section className="mb__older" aria-label="Earlier months">
          <h2 className="lbl">Earlier months</h2>
          {older.map((g) => (
            <details key={g.monthKey} className="mb__month">
              <summary>
                <span>{monthYear(g.monthKey)}</span>
                <small>
                  {g.opened} of {g.total} opened
                </small>
              </summary>
              <MonthGrid group={g} seals={seals} onOpen={show} />
            </details>
          ))}
        </section>
      )}

      {open?.mode === 'ritual' && (
        <OpenRitual
          key={open.moment.id}
          moment={open.moment}
          seal={seals.get(open.moment.id)}
          onClose={close}
        />
      )}
      {open && open.mode !== 'ritual' && (
        <LetterView
          key={open.moment.id}
          moment={open.moment}
          mode={open.mode}
          thisYear={thisYear}
          onClose={close}
        />
      )}
    </Screen>
  )
}
