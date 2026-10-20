import { useEffect, useState } from 'react'
import { topics } from '../../data/topics.json'
import { moodLabel } from '../../engine/moods'
import { roman, yearStats } from '../../lib/album'
import { share } from '../../lib/platform'
import { posterFacts, renderQuiltPoster } from '../../lib/shareImage'

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
  const [poster, setPoster] = useState(null) // { url, blob }
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState(null)

  // let go of the picture's memory when it is replaced or the screen is left
  useEffect(() => () => poster && URL.revokeObjectURL(poster.url), [poster])

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
      setPoster({ blob, url: URL.createObjectURL(blob) })
    } catch (err) {
      setNote(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function send() {
    setBusy(true)
    try {
      const file = new File([poster.blob], `postmark-${year}-quilt.png`, { type: 'image/png' })
      setNote(shareNote(await share({ title: `My ${year} in stamps`, files: [file] })))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="shareyear" aria-label="Share your year">
      <h2>Share your year</h2>
      <p>
        A poster of the quilt to send or keep. It has colors and counts only, never the words of a
        note.
      </p>
      {!poster && (
        <button
          className="shareyear__make"
          disabled={busy || yearMoments.length === 0}
          onClick={make}
        >
          {busy ? 'Making it…' : 'Make a quilt poster'}
        </button>
      )}
      {poster && (
        <figure className="shareyear__poster">
          <img src={poster.url} alt={`Your ${year} quilt poster`} />
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
