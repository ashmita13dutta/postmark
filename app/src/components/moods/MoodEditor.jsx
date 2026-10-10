import { useRef, useState } from 'react'
import { defaultFeeling, feelings } from '../../data/feelings.json'
import palettes from '../../data/palettes.json'
import { namePalette } from '../../engine/colorNames'
import { MAX_LABEL } from '../../engine/moods'
import Stamp from '../stamp/Stamp'
import '../teach/teach.css'
import './moods.css'

const FEELING_IDS = Object.keys(feelings)

/**
 * Make up a mood, or change one: a name and the five colors it should always have. "Start from" fills
 * the colors from a built-in mood's palettes (tap again for the next one), then you change any color.
 * The stamp beside them is what the mood will look like.
 *
 *  - initial:  { label, colors: [{ hex }] x5 } when changing one
 *  - onSave:   async ({ label, colors: hex[] }); a thrown error is shown under the form
 *  - onCancel: closes the form
 */
export default function MoodEditor({ initial, onSave, onCancel, saveLabel = 'Save mood' }) {
  const [label, setLabel] = useState(initial?.label ?? '')
  const [hexes, setHexes] = useState(
    () => initial?.colors.map((c) => c.hex) ?? [...palettes[defaultFeeling][0].colors],
  )
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  // how many palettes of each built-in mood have been tried, so tapping again moves on
  const tried = useRef({})

  const named = namePalette(hexes)

  function startFrom(id) {
    const pool = palettes[id]
    const n = tried.current[id] ?? 0
    tried.current[id] = n + 1
    setHexes([...pool[n % pool.length].colors])
  }

  async function save() {
    setBusy(true)
    setError(null)
    try {
      await onSave({ label, colors: hexes })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="moodedit" aria-label={initial ? 'Change this mood' : 'Make a new mood'}>
      <label className="moodedit__name">
        <span className="teach__label">Name</span>
        <input
          type="text"
          value={label}
          maxLength={MAX_LABEL}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Homesick but cosy"
          autoComplete="off"
        />
      </label>

      <div className="moodedit__colors">
        <ul
          className="moodedit__swatches"
          aria-label="The five colors of this mood. Tap one to change it."
        >
          {named.map((c, i) => (
            <li key={i}>
              <label>
                <span className="moodedit__chip" style={{ background: c.hex }} />
                <input
                  type="color"
                  value={c.hex.toLowerCase()}
                  onChange={(e) =>
                    setHexes((h) => h.map((x, j) => (j === i ? e.target.value.toUpperCase() : x)))
                  }
                  aria-label={`Change ${c.name}`}
                />
              </label>
              <small>{c.name}</small>
            </li>
          ))}
        </ul>
        <Stamp colors={hexes} seed={label || 'mood'} width={84} label="What this mood looks like" />
      </div>

      <p className="teach__label">Start from a built-in mood’s colors</p>
      <div className="moodedit__starts" role="group" aria-label="Start from">
        {FEELING_IDS.map((id) => (
          <button key={id} onClick={() => startFrom(id)}>
            {feelings[id].label}
          </button>
        ))}
      </div>

      {error && (
        <p className="teach__msg teach__msg--err" role="alert">
          {error}
        </p>
      )}
      <div className="teach__actions">
        <button className="teach__save" onClick={save} disabled={busy || !label.trim()}>
          {saveLabel}
        </button>
        <button className="teach__cancel" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </section>
  )
}
