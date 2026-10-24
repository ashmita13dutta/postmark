import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { PACKS } from '../../data/stickers'
import { queries } from '../../db/queries'
import { now } from '../../lib/clock'
import { dayKey, parseDay } from '../../lib/dates'
import { collectionStats } from '../../lib/collection'
import { earnedRewards } from '../../lib/rewards'
import './collection.css'

const NO_ROWS = []
const PREVIEW = 3
const monthName = (key) => {
  const { y, m } = parseDay(`${key}-01`)
  return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
}
const times = (n) => (n === 1 ? 'once' : `${n} times`)

/** A few of a pack's own pictures (the biggest first, so they read small); drawn packs have none. */
const previewOf = (pack) =>
  pack.items
    .filter((s) => s.src && !s.ink)
    .sort((a, b) => b.w * b.h - a.w * a.h)
    .slice(0, PREVIEW)

/**
 * You > Your stickers: every sticker pack, how many stickers it has, how often you have used it, and
 * which delivered months featured it. Nothing is locked; this is the collection and how you use it.
 * Counts come from your own stamps (demo postcards are left out). A faded card says city packs are
 * still to come.
 */
export default function StickerCollection() {
  const moments = useLiveQuery(() => queries.allMoments(), [], NO_ROWS)
  const decorations = useLiveQuery(() => queries.allDecorations(), [], NO_ROWS)

  const stats = useMemo(() => {
    const real = moments.filter((m) => m.demo !== true)
    const ids = new Set(real.map((m) => m.id))
    const rewards = earnedRewards(real, dayKey(now()))
    return collectionStats(
      PACKS,
      decorations.filter((d) => ids.has(d.momentId)),
      rewards,
    )
  }, [moments, decorations])
  const previews = useMemo(() => new Map(PACKS.map((p) => [p.id, previewOf(p)])), [])

  return (
    <details className="collection">
      <summary>
        <span>Your stickers</span>
        <small>
          {PACKS.length} packs · {stats.stickers} stickers
        </small>
      </summary>
      <p className="collection__lede">
        {stats.used
          ? `You have put ${stats.used} stickers on ${stats.postcards} ${stats.postcards === 1 ? 'postcard' : 'postcards'}.`
          : 'Every pack is open to you. Stickers go on the back of a postcard, from the tray.'}
        {stats.top && (
          <>
            {' '}
            Used most: <b>{stats.top.label}</b> ({stats.top.packLabel}), {times(stats.top.count)}.
          </>
        )}
      </p>
      <ul className="collection__packs" aria-label="Sticker packs">
        {stats.packs.map((p) => (
          <li key={p.id} className="collection__pack">
            <div className="collection__pics" aria-hidden="true">
              {previews.get(p.id).length ? (
                previews
                  .get(p.id)
                  .map((s) => (
                    <img
                      key={s.id}
                      src={`${import.meta.env.BASE_URL}${s.src}`}
                      alt=""
                      draggable={false}
                    />
                  ))
              ) : (
                <span>{p.kind === 'drawn' ? '✎' : '✦'}</span>
              )}
            </div>
            <b>{p.label}</b>
            <small>
              {p.count} stickers · {p.used ? `used ${times(p.used)}` : 'not used yet'}
            </small>
            {p.months.slice(0, 2).map((m) => (
              <em key={m.monthKey}>
                ★ {m.name} · {monthName(m.monthKey)}
              </em>
            ))}
          </li>
        ))}
        <li className="collection__pack collection__pack--soon">
          <div className="collection__pics" aria-hidden="true">
            <span>?</span>
          </div>
          <b>City packs</b>
          <small>Kolkata and more: not drawn yet</small>
        </li>
      </ul>
    </details>
  )
}
