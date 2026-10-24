import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { PACKS } from '../../data/stickers'
import { queries } from '../../db/queries'
import { parseDay } from '../../lib/dates'
import { GOLDEN_STREAK, STICKER_STREAK, earnedRewards, pastMonths } from '../../lib/rewards'
import { longestStreak } from '../../lib/streak'
import Stamp from '../stamp/Stamp'
import './rewards.css'

const NO_ROWS = []
const GOLD = ['#F6E3A1', '#E9C25B', '#D4A02F', '#B9801C', '#F3D98B']
const SHOWN_MONTHS = 6
const PREVIEW_STICKERS = 3
const PACKS_SHOWN = 3

const monthShort = (key) => {
  const { y, m } = parseDay(`${key}-01`)
  return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'short' })
}
const monthLong = (key) => {
  const { y, m } = parseDay(`${key}-01`)
  return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}

/** A few of a pack's own stickers, the biggest first so they read at a small size. */
function packPreview(packId) {
  const pack = PACKS.find((p) => p.id === packId)
  return (pack?.items ?? [])
    .filter((s) => s.src && !s.ink)
    .sort((a, b) => b.w * b.h - a.w * a.h)
    .slice(0, PREVIEW_STICKERS)
}

/**
 * The rewards shelf on the Mailbox (spec 8.6): a golden stamp for a 20-day streak, a sticker for 7, a
 * badge for each month with no blank days (greyed when it had some), and a named sticker pack for
 * each delivered month. Earned ones are remembered the first time the shelf is opened, and a new one
 * says "New". Stamps from the demo tools show up too, marked "Demo", so the shelf can be tried.
 *  - moments: every stamp, demo ones included
 *  - today:   'YYYY-MM-DD'
 */
export default function RewardsShelf({ moments, today }) {
  const stored = useLiveQuery(() => queries.allRewards(), [], NO_ROWS)
  const [allPacks, setAllPacks] = useState(false)
  const real = useMemo(() => moments.filter((m) => m.demo !== true), [moments])

  // remember anything newly earned from real stamps
  useEffect(() => {
    queries.syncRewards(today)
  }, [real, today])
  // "New" fades once the shelf has been on screen for a while
  useEffect(() => {
    if (!stored.some((r) => r.seen === false)) return undefined
    const timer = setTimeout(() => queries.markRewardsSeen(), 6000)
    return () => clearTimeout(timer)
  }, [stored])

  const view = useMemo(() => {
    const realIds = new Set(earnedRewards(real, today).map((r) => r.id))
    const earned = new Map(earnedRewards(moments, today).map((r) => [r.id, r]))
    const isNew = new Set(stored.filter((r) => r.seen === false).map((r) => r.id))
    const months = pastMonths(moments, today).slice(-SHOWN_MONTHS).reverse()
    const packs = [...earned.values()]
      .filter((r) => r.kind === 'month-pack')
      .sort((a, b) => (a.monthKey < b.monthKey ? 1 : -1))
    return {
      best: longestStreak(moments.map((m) => m.day)),
      earned,
      months,
      packs,
      demo: (id) => !realIds.has(id),
      isNew: (id) => isNew.has(id),
    }
  }, [moments, real, today, stored])

  const golden = view.earned.has('golden-stamp')
  const sticker = view.earned.has('streak-sticker')
  const tag = (id) =>
    view.demo(id) ? (
      <em className="rw__tag">Demo</em>
    ) : view.isNew(id) ? (
      <em className="rw__tag rw__tag--new">New</em>
    ) : null

  return (
    <section className="rw" aria-label="Keepsakes">
      <h2 className="lbl">Keepsakes</h2>

      <ul className="rw__row">
        <li className={`rw__tile${golden ? '' : ' rw__tile--locked'}`}>
          <Stamp colors={GOLD} seed="golden" width={54} small label="" />
          <strong>Golden stamp</strong>
          <small>
            {golden ? 'A 20-day streak' : `${GOLDEN_STREAK} days in a row · best ${view.best}`}
          </small>
          {golden && tag('golden-stamp')}
        </li>
        <li className={`rw__tile${sticker ? '' : ' rw__tile--locked'}`}>
          <span className="rw__seal" aria-hidden="true">
            {STICKER_STREAK}
          </span>
          <strong>Week streak</strong>
          <small>
            {sticker ? 'A 7-day streak' : `${STICKER_STREAK} days in a row · best ${view.best}`}
          </small>
          {sticker && tag('streak-sticker')}
        </li>
      </ul>

      {view.months.length > 0 && (
        <>
          <h3 className="rw__sub">Complete months</h3>
          <ul className="rw__row rw__row--months">
            {view.months.map((month) => {
              const done = month.blanks === 0
              return (
                <li
                  key={month.key}
                  className={`rw__tile rw__tile--month${done ? '' : ' rw__tile--locked'}`}
                >
                  <span className="rw__ring" aria-hidden="true">
                    {monthShort(month.key)}
                  </span>
                  <small>
                    {done ? 'Complete' : `${month.blanks} blank${month.blanks === 1 ? '' : 's'}`}
                  </small>
                  {done && tag(`complete-month:${month.key}`)}
                  <span className="rw__sr">
                    {monthLong(month.key)}: {done ? 'complete' : `${month.blanks} blank days`}
                  </span>
                </li>
              )
            })}
          </ul>
        </>
      )}

      {view.packs.length > 0 && (
        <>
          <h3 className="rw__sub">Month packs</h3>
          <ul className="rw__packs">
            {(allPacks ? view.packs : view.packs.slice(0, PACKS_SHOWN)).map((p) => (
              <li key={p.id} className="rw__pack">
                <div className="rw__stickers" aria-hidden="true">
                  {packPreview(p.packId).map((s) => (
                    <img
                      key={s.id}
                      src={`${import.meta.env.BASE_URL}${s.src}`}
                      alt=""
                      draggable={false}
                    />
                  ))}
                </div>
                <span>
                  <small>
                    {view.isNew(p.id) ? 'New pack unlocked' : 'Pack'} · {monthLong(p.monthKey)}
                  </small>
                  <strong>{p.name}</strong>
                  <small>
                    Find it in the sticker tray: {PACKS.find((x) => x.id === p.packId)?.label}
                  </small>
                </span>
                {tag(p.id)}
              </li>
            ))}
          </ul>
          {view.packs.length > PACKS_SHOWN && (
            <button className="rw__more" onClick={() => setAllPacks((v) => !v)}>
              {allPacks ? 'Show fewer' : `Show all ${view.packs.length} packs`}
            </button>
          )}
        </>
      )}

      {view.months.length === 0 && (
        <p className="rw__quiet">
          Badges and a sticker pack arrive with each delivered month. Stamp for a week to earn your
          first streak sticker.
        </p>
      )}
    </section>
  )
}
