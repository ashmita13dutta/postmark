import { useState } from 'react'
import { queries } from '../../db/queries'
import { parseTyped } from '../../engine/teach'
import '../teach/teach.css'
import './moods.css'

/**
 * Type the words that bring a mood on straight into it, without needing a note. Commas separate
 * them; "bhalo lagche" is one phrase; "rain + chai" is a combo that counts only when both are in a
 * note. Whatever cannot be taught (filler words, phrases over five words) is left out and listed.
 */
export default function AddWords({ mood, moods }) {
  const [text, setText] = useState('')
  const [note, setNote] = useState(null) // { ok, text }
  const [busy, setBusy] = useState(false)

  async function add(e) {
    e.preventDefault()
    const { entries, combos, skipped } = parseTyped(text, 'feeling', mood.id, moods)
    const left = skipped.length
      ? ` Left out: ${skipped.map((s) => `“${s}”`).join(', ')} (filler words, or more than five words).`
      : ''
    if (!entries.length && !combos.length) {
      setNote({ ok: false, text: `Nothing to add.${left}` })
      return
    }
    setBusy(true)
    try {
      if (entries.length) await queries.teachWords(entries)
      for (const c of combos) await queries.saveCombo(c)
      const added = [
        ...entries.map((x) => `“${x.example}”`),
        ...combos.map((c) => `“${c.example}” together`),
      ]
      setNote({ ok: true, text: `Added ${added.join(', ')}.${left}` })
      setText('')
    } catch (err) {
      setNote({ ok: false, text: err.message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="moods__add" onSubmit={add}>
      <label>
        <span className="teach__label">Add words</span>
        <span className="moods__addrow">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="ghurni, bhalo lagche, rain + chai"
            aria-label={`Add words for ${mood.label}`}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
          />
          <button type="submit" disabled={busy || !text.trim()}>
            Add
          </button>
        </span>
      </label>
      <p className="moods__none">
        Separate them with commas. “rain + chai” counts only when both are in a note.
      </p>
      {note && (
        <p className={note.ok ? 'teach__msg' : 'teach__msg teach__msg--err'} role="status">
          {note.text}
        </p>
      )}
    </form>
  )
}
