import { AnimatePresence } from 'framer-motion'
import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Screen from '../app/Screen'
import Shelf from '../components/album/Shelf'
import Quilt from '../components/album/Quilt'
import MonthSheets from '../components/album/MonthSheets'
import YearCard from '../components/album/YearCard'
import YearInPostmarks from '../components/album/YearInPostmarks'
import ShareYear, { shareNote } from '../components/album/ShareYear'
import AcrossYears from '../components/album/AcrossYears'
import Ceremony from '../components/album/Ceremony'
import CoverEditor from '../components/album/CoverEditor'
import VolumeCover from '../components/album/VolumeCover'
import { queries } from '../db/queries'
import { sameDayAcrossYears, volumes } from '../lib/album'
import { buildMoods } from '../engine/moods'
import { todayKey } from '../lib/dates'
import { coverPackIds, yearsToClose } from '../lib/volumes'
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
  const volumeRows = useLiveQuery(() => queries.allVolumes(), [], NO_ROWS)
  const animate = useLiveQuery(() => queries.getSetting('revealAnimation'), [], true)
  // /album?ceremony=2025 plays the ceremony for a year without closing it (a testing tool on You)
  const replay = Number(useSearchParams()[0].get('ceremony')) || null
  const [picked, setPicked] = useState(null)
  const [deciding, setDeciding] = useState(false) // the cover editor is open
  const [glow, setGlow] = useState(null) // the month "Year in postmarks" is showing
  const [done, setDone] = useState(false)
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

  // volumes: which years are closed, and which year's ceremony is due (real stamps only)
  const closedYears = useMemo(
    () => volumeRows.filter((v) => v.closedAt != null).map((v) => v.year),
    [volumeRows],
  )
  const due = useMemo(() => {
    const real = moments.filter((m) => m.demo !== true)
    return yearsToClose(real, today, closedYears)
  }, [moments, today, closedYears])
  const ceremonyYear = replay ?? (done ? null : (due[due.length - 1] ?? null))
  const cover = volumeRows.find((v) => v.year === year)?.coverStickers ?? NO_ROWS
  const coverPacks = useMemo(
    () =>
      coverPackIds(
        moments.filter((m) => m.day.startsWith(`${year}-`)),
        today,
      ),
    [moments, year, today],
  )
  const ceremonyBook = books.find((b) => b.year === ceremonyYear)

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
      <Shelf books={books} year={year} closedYears={closedYears} onPick={setPicked} />

      <section className="cover" aria-label={`Cover of volume ${book.number}`}>
        <VolumeCover
          year={year}
          number={book.number}
          moments={thisYearMoments}
          stickers={cover}
          closed={closedYears.includes(year)}
          width={104}
        />
        <div>
          <h2>
            Volume {book.number}, {year}
          </h2>
          <p>
            {closedYears.includes(year)
              ? 'Closed and sealed. It stays here to read any time.'
              : year === thisYear
                ? 'Open. It closes with a small ceremony the first time you come back after 31 December.'
                : 'Waiting to be closed.'}
          </p>
          <button className="cover__edit" onClick={() => setDeciding(true)}>
            Decorate the cover
          </button>
        </div>
      </section>

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

      <YearInPostmarks key={year} year={year} moments={thisYearMoments} onGlow={setGlow} />
      <Quilt
        year={year}
        moments={thisYearMoments}
        today={today}
        onOpen={setOpen}
        glowMonth={glow}
      />
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

      {deciding && (
        <CoverEditor
          key={year}
          year={year}
          number={book.number}
          moments={thisYearMoments}
          closed={closedYears.includes(year)}
          stickers={cover}
          packIds={coverPacks}
          onClose={() => setDeciding(false)}
          onSave={async (list) => {
            await queries.setCover(year, list)
            setDeciding(false)
          }}
        />
      )}
      {ceremonyYear && ceremonyBook && (
        <Ceremony
          key={ceremonyYear}
          year={ceremonyYear}
          number={ceremonyBook.number}
          moments={moments.filter((m) => m.day.startsWith(`${ceremonyYear}-`))}
          stickers={volumeRows.find((v) => v.year === ceremonyYear)?.coverStickers ?? NO_ROWS}
          animate={animate !== false}
          onDone={async () => {
            if (!replay) await queries.closeVolumes(today)
            setDone(true)
            if (replay) window.history.back()
          }}
        />
      )}

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
