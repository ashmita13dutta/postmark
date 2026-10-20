// Helpers shared by the scripts that train and check the note reader (train-head.mjs,
// personal-check.mjs): reading a file of labelled notes in either format, and turning notes into
// the rows the trainer wants. No model needed, so tests/real.test.js can cover all of it.
import { readFileSync } from 'node:fs'
import { acceptedFeelings } from './metrics.mjs'

/**
 * Labelled notes from a parsed file. Two shapes are accepted:
 *   { "notes": [[text, feeling, topic], ...] }   like tests/corpus/*.json
 *   [[text, feeling, "*"], ...]                  what "Copy them" on the You screen gives you
 * A feeling is one name, a list of acceptable names, or "*". Rows that do not look right (no text,
 * an unknown feeling) are left out and counted, so one bad row never stops a run.
 * @returns {{ notes: [string, string | string[], string | string[]][], skipped: number }}
 */
export function parseNotes(raw, feelingIds) {
  const rows = Array.isArray(raw) ? raw : (raw?.notes ?? [])
  const known = new Set([...feelingIds, '*'])
  const notes = []
  let skipped = 0
  for (const row of rows) {
    const [text, label, topic] = Array.isArray(row) ? row : []
    const labels = Array.isArray(label) ? label : [label]
    const ok =
      typeof text === 'string' &&
      text.trim() !== '' &&
      labels.length > 0 &&
      labels.every((l) => known.has(l))
    if (ok) notes.push([text.trim(), label, topic ?? '*'])
    else skipped++
  }
  return { notes, skipped }
}

/** Read and parse a file of labelled notes. */
export function readNotesFile(path, feelingIds) {
  return parseNotes(JSON.parse(readFileSync(path, 'utf8')), feelingIds)
}

/**
 * Rows for the trainer: { x: embedding, y: probabilities over the feelings }. A note that accepts
 * several feelings is trained towards all of them equally; a note that accepts anything ("*") has
 * nothing to teach and is left out. `copies` repeats every row, to make these notes count for more.
 */
export function softRows(notes, vectors, feelingIds, copies = 1) {
  const rows = []
  const used = []
  notes.forEach((note, i) => {
    const accepted = acceptedFeelings(note[1])
    if (accepted === null) return
    const y = new Array(feelingIds.length).fill(0)
    for (const f of accepted) y[feelingIds.indexOf(f)] += 1 / accepted.length
    for (let c = 0; c < copies; c++) rows.push({ x: vectors[i], y })
    used.push(note)
  })
  return { rows, used }
}
