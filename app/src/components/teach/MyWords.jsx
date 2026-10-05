import { useState } from 'react'
import { feelings } from '../../data/feelings.json'
import { topics } from '../../data/topics.json'
import './teach.css'

const labelOf = (e) =>
  e.kind === 'tint'
    ? 'a color'
    : ((e.kind === 'feeling' ? feelings[e.id]?.label : topics[e.id]?.label) ?? e.id)

/** The words you have taught, with a way to take each one back. Everything stays on this phone. */
export default function MyWords({ lexicon, onForget, onForgetAll }) {
  const [confirm, setConfirm] = useState(false)
  if (!lexicon.length) {
    return (
      <p className="teach__hint">
        Nothing taught yet. If a note reads wrong, tap “This felt different” and teach it.
      </p>
    )
  }
  return (
    <details className="mywords">
      <summary>My words · {lexicon.length}</summary>
      <ul>
        {lexicon.map((e) => (
          <li key={e.key}>
            <span className="mywords__word">{e.example ?? e.word}</span>
            <span className="mywords__arrow">→</span>
            <span className="mywords__target">
              {e.kind === 'tint' && (
                <i className="dot" style={{ background: e.id }} aria-hidden="true" />
              )}{' '}
              {labelOf(e)}
              <small>{e.kind === 'topic' ? ' · topic' : ''}</small>
            </span>
            <button onClick={() => onForget(e.key)} aria-label={`Forget ${e.example ?? e.word}`}>
              ×
            </button>
          </li>
        ))}
      </ul>
      <button
        className="teach__link"
        onClick={() => {
          if (confirm) {
            onForgetAll()
            setConfirm(false)
          } else setConfirm(true)
        }}
        onBlur={() => setConfirm(false)}
      >
        {confirm ? 'Tap again to forget all' : 'Forget all my words'}
      </button>
    </details>
  )
}
