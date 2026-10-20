import { useMemo } from 'react'
import { topics } from '../../data/topics.json'
import { moodLabel } from '../../engine/moods'
import { roman, yearStats } from '../../lib/album'

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

/**
 * "Year so far" (spec 6.9): the numbers that say what the year was like. Cities and songs are left
 * out until the app records them. For a finished year it reads "the year".
 */
export default function YearCard({ year, moments, today, moods, book }) {
  const s = useMemo(() => yearStats(year, moments, today), [year, moments, today])
  const current = year === Number(today.slice(0, 4))
  return (
    <section className="year" aria-label={`Volume ${roman(book.number)}, ${year}`}>
      <p className="lbl">
        Volume {roman(book.number)} · {year} · {current ? 'year so far' : 'the year'}
      </p>
      <h2>
        <b>{s.stamps}</b> {s.stamps === 1 ? 'stamp' : 'stamps'}
        <small> in {plural(s.daysSoFar, 'day')}</small>
      </h2>
      <dl className="year__facts">
        {s.topColor && (
          <div>
            <dt>Most common color</dt>
            <dd>
              <i className="dot" style={{ background: s.topColor.hex }} aria-hidden="true" />{' '}
              {s.topColor.name}
              <small> in {plural(s.topColor.stamps, 'stamp')}</small>
            </dd>
          </div>
        )}
        {s.topFeeling && (
          <div>
            <dt>Felt most often</dt>
            <dd>
              {moodLabel(s.topFeeling.id, moods)}
              <small> {plural(s.topFeeling.count, 'day')}</small>
            </dd>
          </div>
        )}
        {s.topTopic && (
          <div>
            <dt>Wrote about most</dt>
            <dd>
              {topics[s.topTopic.id]?.label ?? s.topTopic.id}
              <small> {plural(s.topTopic.count, 'day')}</small>
            </dd>
          </div>
        )}
        <div>
          <dt>Rainy days</dt>
          <dd>{s.rainyDays}</dd>
        </div>
        <div>
          <dt>Longest streak</dt>
          <dd>{plural(s.longestStreak, 'day')}</dd>
        </div>
        <div>
          <dt>Complete months</dt>
          <dd>{s.completeMonths}</dd>
        </div>
      </dl>
      {current && s.currentStreak > 0 && (
        <p className="year__note">{plural(s.currentStreak, 'day')} in a row right now.</p>
      )}
      {s.blanks > 0 && (
        <p className="year__note">
          {plural(s.blanks, 'blank day')}
          {current ? ' so far' : ''}. They show as empty squares in the quilt.
        </p>
      )}
    </section>
  )
}
