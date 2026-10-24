import { useEffect, useMemo, useState } from 'react'
import { topics } from '../../data/topics.json'
import { moodLabel } from '../../engine/moods'
import { roman, yearStats } from '../../lib/album'
import { share } from '../../lib/platform'
import { medleyQueue, yearMonths } from '../../lib/medley'
import { posterFacts, renderPostmarksStory, renderQuiltPoster } from '../../lib/shareImage'

/** What to tell the person after a share: null when they changed their mind. */
export function shareNote(result) {
  if (result === 'shared') return 'Shared.'
  if (result === 'downloaded') return 'Saved the picture to your downloads.'
  if (result === 'unsupported')
    return 'This browser cannot share pictures. Press and hold the picture to save it.'
  return null
}

/**
 * Share the year: make a quilt poster, look at it, then send it with the share sheet (or save it).
 * The picture holds colors and counts only, never the words of a note.
 */
export default function ShareYear({ year, book, yearMoments, allMoments, today, moods }) {
  const [poster, setPoster] = useState(null) // { url, blob, kind: 'quilt' | 'story' }
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState(null)

  // let go of the picture's memory when it is replaced or the screen is left
  useEffect(() => () => poster && URL.revokeObjectURL(poster.url), [poster])

  // the story card needs at least one song to say anything
  const hasSongs = useMemo(
    () => medleyQueue(yearMonths(year, yearMoments)).length > 0,
    [year, yearMoments],
  )

  async function makeStory() {
    setBusy(true)
    setNote(null)
    try {
      const blob = await renderPostmarksStory({
        year,
        volumeName: `Volume ${roman(book.number)}`,
        months: yearMonths(year, yearMoments),
      })
      setPoster({ blob, url: URL.createObjectURL(blob), kind: 'story' })
    } catch (err) {
      setNote(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function make() {
    setBusy(true)
    setNote(null)
    try {
      const stats = yearStats(year, allMoments, today)
      const facts = posterFacts(stats, {
        feelingLabel: (id) => moodLabel(id, moods),
        topicLabel: (id) => topics[id]?.label ?? id,
      })
      const blob = await renderQuiltPoster({
        year,
        volumeName: `Volume ${roman(book.number)}`,
        moments: yearMoments,
        today,
        facts,
      })
      setPoster({ blob, url: URL.createObjectURL(blob), kind: 'quilt' })
    } catch (err) {
      setNote(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function send() {
    setBusy(true)
    try {
      const story = poster.kind === 'story'
      const file = new File([poster.blob], `postmark-${year}-${story ? 'story' : 'quilt'}.png`, {
        type: 'image/png',
      })
      setNote(
        shareNote(
          await share({
            title: story ? `My ${year} in postmarks` : `My ${year} in stamps`,
            files: [file],
          }),
        ),
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="shareyear" aria-label="Share your year">
      <h2>Share your year</h2>
      <p>
        A poster of the quilt, or a story card with a song for each month, to send or keep. They
        hold colors, counts and song names only, never the words of a note.
      </p>
      {!poster && (
        <div className="shareyear__actions">
          <button
            className="shareyear__make"
            disabled={busy || yearMoments.length === 0}
            onClick={make}
          >
            {busy ? 'Making it…' : 'Make a quilt poster'}
          </button>
          {hasSongs && (
            <button disabled={busy} onClick={makeStory}>
              Make a story card
            </button>
          )}
        </div>
      )}
      {poster && (
        <figure className="shareyear__poster">
          <img
            src={poster.url}
            alt={
              poster.kind === 'story' ? `Your ${year} in postmarks` : `Your ${year} quilt poster`
            }
          />
          <div className="shareyear__actions">
            <button className="shareyear__make" disabled={busy} onClick={send}>
              Share it
            </button>
            <button disabled={busy} onClick={() => setPoster(null)}>
              Close
            </button>
          </div>
        </figure>
      )}
      {note && (
        <p className="shareyear__note" role="status">
          {note}
        </p>
      )}
    </section>
  )
}
