import { AnimatePresence } from 'framer-motion'
import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Screen from '../app/Screen'
import Shelf from '../components/album/Shelf'
import Quilt from '../components/album/Quilt'
import MonthSheets from '../components/album/MonthSheets'
import YearCard from '../components/album/YearCard'
import ShareYear, { shareNote } from '../components/album/ShareYear'
import AcrossYears from '../components/album/AcrossYears'
import { queries } from '../db/queries'
import { sameDayAcrossYears, volumes } from '../lib/album'
import { buildMoods } from '../engine/moods'
import { todayKey } from '../lib/dates'
import { share } from '../lib/platform'
import { renderStampCard } from '../lib/shareImage'
import { Preview } from './Calendar'
import '../components/album/album.css'

const NO_ROWS = []

/**
 * Album: the year as a book. A shelf of volumes (one per year), the "year so far" card, a quilt with
 * one square for every day, a swipeable row of month sheets, and the same day in other years.
 * Tapping a stamped square lifts that day's stamp, like the Calendar does.
 */
export default function Album() {
  const today = todayKey()
  const moments = useLiveQuery(() => queries.allMoments(), [], NO_ROWS)
  const moodRows = useLiveQuery(() => queries.getMoods(), [], NO_ROWS)
  const moods = useMemo(() => buildMoods(moodRows), [moodRows])
  const [picked, setPicked] = useState(null)
  const [open, setOpen] = useState(null) // the stamp being looked at

  const books = useMemo(() => volumes(moments, today), [moments, today])
  const thisYear = Number(today.slice(0, 4))
  const year = books.some((b) => b.year === picked) ? picked : thisYear
  const book = books.find((b) => b.year === year)
  const thisYearMoments = useMemo(
    () => moments.filter((m) => m.day.startsWith(`${year}-`)),
    [moments, year],
  )
  const across = useMemo(() => sameDayAcrossYears(moments, today), [moments, today])

  // a favourite stamp as a picture (colors, date and names only; never its note)
  async function shareStamp(moment) {
    try {
      const blob = await renderStampCard({ moment })
      const file = new File([blob], `postmark-stamp-${moment.day}.png`, { type: 'image/png' })
      return shareNote(await share({ title: 'A stamp from my Postmark', files: [file] }))
    } catch {
      return 'Could not make the picture.'
    }
  }

  return (
    <Screen caption="Your year" title="Album">
      <Shelf books={books} year={year} onPick={setPicked} />

      {book.stamps === 0 ? (
        <section className="album__empty">
          <h2>Volume {book.number} is still blank</h2>
          <p>
            {year === thisYear
              ? 'Every stamp you make this year will be sewn into the quilt.'
              : `There are no stamps from ${year}.`}
          </p>
          {year === thisYear && <Link to="/">Stamp today</Link>}
        </section>
      ) : (
        <YearCard year={year} moments={moments} today={today} moods={moods} book={book} />
      )}

      <Quilt year={year} moments={thisYearMoments} today={today} onOpen={setOpen} />
      <MonthSheets year={year} moments={thisYearMoments} today={today} />
      {across.length >= 2 && <AcrossYears items={across} today={today} onOpen={setOpen} />}
      <ShareYear
        key={year}
        year={year}
        book={book}
        yearMoments={thisYearMoments}
        allMoments={moments}
        today={today}
        moods={moods}
      />

      <AnimatePresence>
        {open && (
          <Preview
            key={open.id}
            moment={open}
            today={today}
            onClose={() => setOpen(null)}
            onShare={shareStamp}
          />
        )}
      </AnimatePresence>
    </Screen>
  )
}
