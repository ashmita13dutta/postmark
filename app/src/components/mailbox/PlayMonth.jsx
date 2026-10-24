import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { parseDay } from '../../lib/dates'
import { slideshowOrder, stepAround } from '../../lib/slideshow'
import Postmark from '../postmark/Postmark'
import SongLine from '../song/SongLine'
import Stamp from '../stamp/Stamp'
import './playmonth.css'

const SECONDS = 5

const longDate = (day) => {
  const { y, m, d } = parseDay(day)
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

/**
 * "Play my month" (spec 8.6): a slideshow through the month's postcards, each showing its stamp, its
 * date and place, and its song with a way to hear it. It shows no note: opening a postcard stays a
 * ritual of its own. Nothing plays here; a song opens as a search on Spotify or YouTube. It moves on
 * every few seconds (starts paused for anyone who prefers reduced motion) and can be paused or stepped.
 *  - moments:   the month's delivered postcards
 *  - seed:      the month, so a shuffle is the same each time
 *  - shuffle:   true for a shuffled order
 */
export default function PlayMonth({ moments, seed, shuffle, onClose }) {
  const reduced = useReducedMotion()
  const order = useMemo(() => slideshowOrder(moments, shuffle, seed), [moments, shuffle, seed])
  const [at, setAt] = useState(0)
  const [playing, setPlaying] = useState(!reduced)
  const moment = order[at]
  const go = (by) => setAt((i) => stepAround(i, by, order.length))

  useEffect(() => {
    if (!playing || order.length < 2) return undefined
    const timer = setTimeout(() => setAt((i) => stepAround(i, 1, order.length)), SECONDS * 1000)
    return () => clearTimeout(timer)
  }, [playing, at, order.length])

  if (!moment) return null
  return (
    <div className="playmonth" role="dialog" aria-label="Play my month">
      <p className="playmonth__count">
        {at + 1} of {order.length}
      </p>
      <AnimatePresence mode="wait">
        <motion.div
          className="playmonth__card"
          key={moment.id}
          initial={reduced ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduced ? undefined : { opacity: 0, y: -10 }}
          transition={{ duration: reduced ? 0 : 0.28 }}
        >
          <div className="playmonth__stamp">
            <Stamp
              colors={moment.palette.map((c) => c.hex)}
              no={moment.stampNo}
              seed={moment.day}
              width={170}
              label={`Stamp: ${moment.palette.map((c) => c.name).join(', ')}`}
            />
            <div className="playmonth__mark">
              <Postmark day={moment.day} city={moment.city} />
            </div>
          </div>
          <h2>{longDate(moment.day)}</h2>
          {moment.songTitle ? (
            <SongLine moment={moment} tagged />
          ) : (
            <p className="playmonth__none">No song this day.</p>
          )}
        </motion.div>
      </AnimatePresence>
      {playing && order.length > 1 && (
        <i
          key={`${moment.id}-${at}`}
          className="playmonth__bar"
          style={{ '--secs': `${SECONDS}s` }}
        />
      )}
      <div className="playmonth__controls">
        <button onClick={() => go(-1)} aria-label="Previous postcard" disabled={order.length < 2}>
          ‹
        </button>
        <button onClick={() => setPlaying((p) => !p)} disabled={order.length < 2}>
          {playing ? 'Pause' : 'Play'}
        </button>
        <button onClick={() => go(1)} aria-label="Next postcard" disabled={order.length < 2}>
          ›
        </button>
        <button className="playmonth__close" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  )
}
