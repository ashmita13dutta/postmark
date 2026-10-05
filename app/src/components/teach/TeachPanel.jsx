import { useMemo, useState } from 'react'
import { feelings } from '../../data/feelings.json'
import { topics } from '../../data/topics.json'
import { entriesFromSelection, suggestSelection, teachableTokens } from '../../engine/teach'
import './teach.css'

const FEELING_IDS = Object.keys(feelings)

// topics grouped for the picker, in file order
const GROUPS = Object.entries(topics).reduce((acc, [id, t]) => {
  ;(acc[t.group] ??= []).push(id)
  return acc
}, {})

/**
 * "This felt different": say how the note really felt (or what it was about), tap the words that
 * show it, and the app remembers them on this phone from then on.
 *
 * Props:
 *  - text:      the note
 *  - mood:      what detectMood read from it (to mark the current guess)
 *  - lexicon:   Map of words already taught (buildLexicon), so they are shown as known
 *  - onSave:    async (entries) => saved entries; the parent stores them
 */
export default function TeachPanel({ text, mood, lexicon, onSave }) {
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState('feeling')
  const [target, setTarget] = useState(null)
  const [selected, setSelected] = useState(() => new Set())
  const [message, setMessage] = useState(null)
  const [busy, setBusy] = useState(false)

  const tokens = useMemo(() => teachableTokens(text, lexicon), [text, lexicon])
  const entries = useMemo(
    () => (target ? entriesFromSelection(tokens, selected, kind, target) : []),
    [tokens, selected, kind, target],
  )
  const canSave = !!target && entries.length > 0 && !busy

  function begin() {
    setOpen(true)
    setMessage(null)
    setTarget(null)
    setSelected(new Set())
  }

  function toggle(i) {
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  async function save() {
    setBusy(true)
    try {
      const saved = await onSave(entries)
      const label = kind === 'feeling' ? feelings[target].label : topics[target].label
      setMessage({
        ok: true,
        text: `Learned ${saved.map((e) => `“${e.example}”`).join(', ')} → ${label}. Your note was read again.`,
      })
      setOpen(false)
    } catch (err) {
      setMessage({ ok: false, text: err.message })
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <div className="teach">
        <button className="teach__open" onClick={begin} disabled={!text.trim()}>
          This felt different
        </button>
        {message && (
          <p className={message.ok ? 'teach__msg' : 'teach__msg teach__msg--err'} role="status">
            {message.text}
          </p>
        )}
      </div>
    )
  }

  return (
    <section className="teach teach--open" aria-label="Teach the app">
      <h3>Teach it</h3>
      <div className="seg seg--small" role="tablist" aria-label="What to teach">
        {[
          ['feeling', 'How it felt'],
          ['topic', 'What it was about'],
        ].map(([k, label]) => (
          <button
            key={k}
            role="tab"
            aria-selected={kind === k}
            className={kind === k ? 'on' : ''}
            onClick={() => {
              setKind(k)
              setTarget(null)
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {kind === 'feeling' ? (
        <div className="chips chips--wrap" role="group" aria-label="The real feeling">
          {FEELING_IDS.map((f) => (
            <button key={f} className={target === f ? 'on' : ''} onClick={() => setTarget(f)}>
              {feelings[f].label}
              {mood?.feeling === f && <small> · now</small>}
            </button>
          ))}
        </div>
      ) : (
        <select
          className="picker"
          value={target ?? ''}
          onChange={(e) => setTarget(e.target.value || null)}
          aria-label="The real topic"
        >
          <option value="">Choose what it was about…</option>
          {Object.entries(GROUPS).map(([group, ids]) => (
            <optgroup key={group} label={group}>
              {ids.map((id) => (
                <option key={id} value={id}>
                  {topics[id].label}
                  {mood?.topic === id ? ' (now)' : ''}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      )}

      <p className="teach__label">Tap the words that show it</p>
      <div className="words words--tap" role="group" aria-label="Words in your note">
        {tokens.map((t, i) => {
          const on = selected.has(t.index)
          const joinsNext =
            on && selected.has(tokens[i + 1]?.index) && tokens[i + 1].sentence === t.sentence
          return (
            <button
              key={t.index}
              className={[
                'word',
                on && 'word--on',
                joinsNext && 'word--joined',
                t.recognized && 'word--known',
                t.stop && 'word--stop',
              ]
                .filter(Boolean)
                .join(' ')}
              aria-pressed={on}
              onClick={() => toggle(t.index)}
            >
              {t.text}
            </button>
          )
        })}
      </div>
      <p className="teach__hint">
        Dim words are ones the app already understands. Words you tap next to each other become one
        phrase, like “passed away”.
      </p>
      <div className="teach__row">
        <button
          className="teach__link"
          onClick={() => setSelected(new Set(suggestSelection(tokens)))}
        >
          Pick the words it doesn’t know
        </button>
        <button className="teach__link" onClick={() => setSelected(new Set())}>
          Clear
        </button>
      </div>

      {entries.length > 0 && (
        <p className="teach__preview">
          Will learn: {entries.map((e) => `“${e.example}”`).join(', ')}
          {target && ` → ${kind === 'feeling' ? feelings[target].label : topics[target].label}`}
        </p>
      )}
      {message && !message.ok && <p className="teach__msg teach__msg--err">{message.text}</p>}

      <div className="teach__actions">
        <button className="teach__save" onClick={save} disabled={!canSave}>
          Teach it
        </button>
        <button className="teach__cancel" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </section>
  )
}
