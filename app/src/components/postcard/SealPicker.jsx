import { useState } from 'react'
import { WAX_COLORS, WAX_EMBLEMS } from '../../data/stickers'
import WaxSeal from './WaxSeal'
import './sealpicker.css'

/**
 * "Choose your wax seal": colour and emblem, with a live preview. `onSeal({ color, emblem,
 * initial? })` is called when you confirm; `onCancel` when you back out.
 */
export default function SealPicker({ busy, error, onSeal, onCancel }) {
  const [color, setColor] = useState(WAX_COLORS[0].hex)
  const [emblem, setEmblem] = useState('heart')
  const [initial, setInitial] = useState('')
  const [problem, setProblem] = useState(null)

  function confirm() {
    if (emblem === 'initial' && !initial.trim()) {
      setProblem('Type a letter for your seal')
      return
    }
    onSeal(
      emblem === 'initial'
        ? { color, emblem, initial: initial.trim().slice(0, 1).toUpperCase() }
        : { color, emblem },
    )
  }

  return (
    <div className="sealpick__scrim" onClick={onCancel}>
      <section
        className="sealpick"
        role="dialog"
        aria-modal="true"
        aria-label="Choose your wax seal"
        onClick={(e) => e.stopPropagation()}
      >
        <h2>Choose your wax seal</h2>
        <p className="sealpick__sub">Once it is sealed, the note is hidden until it arrives.</p>
        <div className="sealpick__preview">
          <WaxSeal color={color} emblem={emblem} initial={initial} size={104} />
        </div>

        <div className="sealpick__row" role="radiogroup" aria-label="Wax color">
          {WAX_COLORS.map((c) => (
            <button
              key={c.hex}
              role="radio"
              aria-checked={color === c.hex}
              aria-label={c.name}
              className={`sealpick__dot${color === c.hex ? ' on' : ''}`}
              style={{ background: c.hex }}
              onClick={() => setColor(c.hex)}
            />
          ))}
        </div>

        <div className="sealpick__row" role="radiogroup" aria-label="Emblem">
          {WAX_EMBLEMS.map((e) => (
            <button
              key={e.id}
              role="radio"
              aria-checked={emblem === e.id}
              className={`sealpick__chip${emblem === e.id ? ' on' : ''}`}
              onClick={() => {
                setEmblem(e.id)
                setProblem(null)
              }}
            >
              {e.label}
            </button>
          ))}
        </div>

        {emblem === 'initial' && (
          <label className="sealpick__initial">
            Your letter
            <input
              value={initial}
              maxLength={1}
              autoCapitalize="characters"
              onChange={(e) => {
                setInitial(e.target.value)
                setProblem(null)
              }}
              aria-invalid={!!problem}
            />
          </label>
        )}
        {(problem || error) && (
          <p className="sealpick__error" role="alert">
            {problem ?? error}
          </p>
        )}

        <div className="sealpick__actions">
          <button className="sealpick__no" onClick={onCancel} disabled={busy}>
            Not yet
          </button>
          <button className="sealpick__go" onClick={confirm} disabled={busy}>
            Seal it
          </button>
        </div>
      </section>
    </div>
  )
}
