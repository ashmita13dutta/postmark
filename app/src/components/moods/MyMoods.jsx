import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { queries } from '../../db/queries'
import { MAX_MOODS, buildMoods } from '../../engine/moods'
import MoodEditor from './MoodEditor'
import MoodStrip from './MoodStrip'
import './moods.css'

const NO_ROWS = []

/** " and its 1 word" or " and its 3 words" for the delete button; nothing when it has none. */
const deleteNote = (words) =>
  words.length ? ` and its ${words.length} word${words.length === 1 ? '' : 's'}` : ''

/**
 * You > My moods: the feelings you made up. Each shows its colors and the words you taught it (a ×
 * takes a word back), and can be changed or deleted. Words are taught from a note: Today > Not
 * quite? > Teach it, where a new mood can be made on the spot too.
 */
export default function MyMoods() {
  const rows = useLiveQuery(() => queries.getMoods(), [], NO_ROWS)
  const lexicon = useLiveQuery(() => queries.getLexicon(), [], NO_ROWS)
  const moods = useMemo(() => buildMoods(rows), [rows])
  // 'new', a mood id being changed, or null
  const [editing, setEditing] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [error, setError] = useState(null)

  const wordsOf = (id) => lexicon.filter((w) => w.kind === 'feeling' && w.id === id)
  const attempt = (action) =>
    action().catch((err) => {
      setError(err.message)
    })

  return (
    <section className="moods" aria-label="My moods">
      <h2>My moods</h2>
      <p>
        Moods you make up, each with its own five colors. Teach one the words that bring it on and
        your stamp uses exactly those colors.
      </p>

      {moods.size > 0 && (
        <ul className="moods__list">
          {[...moods.values()].map((m) => (
            <li key={m.id}>
              {editing === m.id ? (
                <MoodEditor
                  initial={m}
                  onSave={async (input) => {
                    await queries.saveMood({ id: m.id, ...input })
                    setEditing(null)
                  }}
                  onCancel={() => setEditing(null)}
                />
              ) : (
                <>
                  <div className="moods__head">
                    <MoodStrip mood={m} />
                    <span className="moods__name">{m.label}</span>
                  </div>
                  {wordsOf(m.id).length > 0 ? (
                    <ul className="moods__words" aria-label={`Words for ${m.label}`}>
                      {wordsOf(m.id).map((w) => (
                        <li key={w.key}>
                          {w.example ?? w.word}
                          <button
                            onClick={() => attempt(() => queries.forgetWord(w.key))}
                            aria-label={`Forget ${w.example ?? w.word}`}
                          >
                            ×
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="moods__none">
                      No words yet. On Today, tap “Not quite?”, then “Teach it”, and tap the words
                      that bring this mood on.
                    </p>
                  )}
                  <div className="moods__row">
                    <button onClick={() => setEditing(m.id)}>Change</button>
                    <button
                      className="moods__delete"
                      onClick={() => {
                        if (confirm === m.id) {
                          setConfirm(null)
                          attempt(() => queries.deleteMood(m.id))
                        } else setConfirm(m.id)
                      }}
                      onBlur={() => setConfirm(null)}
                    >
                      {confirm === m.id
                        ? `Tap again to delete it${deleteNote(wordsOf(m.id))}`
                        : 'Delete'}
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {editing === 'new' ? (
        <MoodEditor
          onSave={async (input) => {
            await queries.saveMood(input)
            setEditing(null)
          }}
          onCancel={() => setEditing(null)}
          saveLabel="Make this mood"
        />
      ) : (
        <button
          className="moods__new"
          onClick={() => setEditing('new')}
          disabled={moods.size >= MAX_MOODS}
        >
          + Make a new mood
        </button>
      )}
      {error && (
        <p className="teach__msg teach__msg--err" role="alert">
          {error}
        </p>
      )}
    </section>
  )
}
