import { useState } from 'react'
import { WAX_COLORS } from '../../data/stickers'
import WaxSeal from './WaxSeal'
import './sealpicker.css'

/**
 * "Choose your wax seal": pick the wax colour, with a live preview of the pressed seal.
 * `onSeal({ color, emblem })` is called when you confirm; `onCancel` when you back out.
 */
export default function SealPicker({ busy, error, onSeal, onCancel }) {
  const [color, setColor] = useState(WAX_COLORS[0].hex)
  const emblem = 'rose'

  function confirm() {
    onSeal({ color, emblem })
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
          <WaxSeal color={color} emblem={emblem} size={120} />
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

        {error && (
          <p className="sealpick__error" role="alert">
            {error}
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
