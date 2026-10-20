/**
 * "Teach it": when a note reads wrong, you say how it really felt (or what it was about) and tap
 * the words that show it. These helpers turn a note into tappable words and your taps into
 * lexicon entries. Pure, so it is easy to test; saving lives in db/queries.js.
 */
import { feelings } from '../data/feelings.json'
import { topics } from '../data/topics.json'
import { isKnownWord, unstretch } from './mood'

const MAX_PHRASE = 5
/** A combo is two to four words (or phrases) that have to be in the note together. */
export const MAX_COMBO_PARTS = 4

// Filler words: never worth teaching on their own ("the" or "was" tells you nothing about a mood).
const STOP = new Set(
  (
    'i me my myself we our you your he him his she her it its they them their a an the and or but if so of to in on at by for with about as into from up out over off ' +
    'was were is am are be been being do did does done have has had having will would can could should shall may might must this that these those there here ' +
    'then than too very just also yes all any some one two three again ever today day went got get getting back after before when while what which who how why because ' +
    // Hindi / Hinglish
    'aaj aajke hai hain ho hoon tha thi the ka ki ke ko mein se par pe aur bhi toh hi ek kuch bas phir ab jab kal ye yeh wo woh mera meri mere mujhe hum ham tum aap kya ' +
    // Bengali in English letters
    'ami tumi ta ti ei kichu ekta ar o ase ache holo hoyeche shathe por'
  ).split(' '),
)

/**
 * The note as tappable words. `recognized` is true when the engine already understands the word
 * (so a suggestion list can skip it); `stop` marks filler words.
 * @returns {{ index: number, text: string, word: string, sentence: number, recognized: boolean, stop: boolean }[]}
 */
export function teachableTokens(text, lexicon) {
  const out = []
  let sentence = 0
  for (const m of text.matchAll(/[\p{L}'’`]+|[.!?;\n]+/gu)) {
    if (/^[.!?;\n]/.test(m[0])) {
      sentence++
      continue
    }
    const word = unstretch(m[0].toLowerCase().replace(/['’`]/g, ''))
    if (!word) continue
    out.push({
      index: out.length,
      text: m[0],
      word,
      sentence,
      recognized: isKnownWord(word, lexicon),
      stop: STOP.has(word),
    })
  }
  return out
}

/** The words worth offering first: ones the engine does not understand and that are not filler. */
export function suggestSelection(tokens) {
  return tokens.filter((t) => !t.recognized && !t.stop && t.word.length >= 3).map((t) => t.index)
}

/**
 * Your taps become lexicon entries. Words you tap next to each other (in one sentence) become one
 * phrase ("passed" + "away" -> "passedaway"), up to five words. A lone filler word is skipped.
 * @param {ReturnType<typeof teachableTokens>} tokens
 * @param {Iterable<number>} selected token indexes
 * @param {'feeling'|'topic'|'tint'} kind
 * @param {string} id a feeling, topic or color (or, for a feeling, the id of one of your moods)
 * @param {Map} [moods] your moods (buildMoods)
 * @returns {{ word: string, kind: string, id: string, parts: number }[]}
 */
export function entriesFromSelection(tokens, selected, kind, id, moods) {
  const known =
    kind === 'feeling'
      ? feelings[id] || moods?.has(id)
      : kind === 'topic'
        ? topics[id]
        : kind === 'tint' && /^#[0-9A-Fa-f]{6}$/.test(id ?? '')
  if (!known) throw new Error(`Unknown ${kind}: ${id}`)
  const picked = [...new Set(selected)].sort((a, b) => a - b).filter((i) => tokens[i])
  const runs = []
  for (const i of picked) {
    const last = runs[runs.length - 1]
    const prev = last?.[last.length - 1]
    const adjacent =
      prev !== undefined && i === prev + 1 && tokens[i].sentence === tokens[prev].sentence
    if (adjacent && last.length < MAX_PHRASE) last.push(i)
    else runs.push([i])
  }
  const entries = []
  for (const run of runs) {
    const word = run.map((i) => tokens[i].word).join('')
    if (run.length === 1 && (tokens[run[0]].stop || word.length < 2)) continue
    entries.push({
      word,
      kind,
      id,
      parts: run.length,
      example: run.map((i) => tokens[i].text).join(' '), // as you typed it, for the "My words" list
    })
  }
  return entries
}

/**
 * Your taps as ONE combo instead of separate words: "rain" and "chai", tapped apart, count only when
 * both are in a note. It uses the same runs as entriesFromSelection (neighbouring taps are one
 * phrase), so it needs at least two separate runs, and at most MAX_COMBO_PARTS.
 * @returns {{ kind: string, target: string, parts: {word: string, parts: number}[], example: string } | null}
 */
export function comboFromSelection(tokens, selected, kind, id, moods) {
  if (kind === 'tint') return null
  const entries = entriesFromSelection(tokens, selected, kind, id, moods)
  const words = new Set(entries.map((e) => e.word))
  if (entries.length < 2 || entries.length > MAX_COMBO_PARTS || words.size !== entries.length)
    return null
  return {
    kind,
    target: id,
    parts: entries.map(({ word, parts }) => ({ word, parts })),
    example: entries.map((e) => e.example).join(' + '),
  }
}

/**
 * Words typed straight into a mood instead of tapped in a note. Separate them with commas;
 * "bhalo lagche" is one phrase; "rain + chai" is a combo (both must be in the note).
 *   "ghurni, bhalo lagche, rain + chai" -> two words and one combo
 * Anything that is only filler ("the"), empty, or longer than five words is left out and returned in
 * `skipped`, so the screen can say so.
 * @returns {{ entries: object[], combos: object[], skipped: string[] }}
 */
export function parseTyped(text, kind, id, moods) {
  const entries = []
  const combos = []
  const skipped = []
  const one = (piece) => {
    const tokens = teachableTokens(piece.replace(/[.!?;\n]+/g, ' '), undefined)
    if (!tokens.length || tokens.length > MAX_PHRASE) return null
    return (
      entriesFromSelection(
        tokens,
        tokens.map((t) => t.index),
        kind,
        id,
        moods,
      )[0] ?? null
    )
  }
  for (const segment of String(text ?? '').split(/[,;\n]+/)) {
    const clean = segment.trim()
    if (!clean) continue
    if (clean.includes('+')) {
      const parts = clean.split('+').map(one)
      const words = new Set(parts.map((p) => p?.word))
      if (parts.some((p) => !p) || parts.length > MAX_COMBO_PARTS || words.size !== parts.length) {
        skipped.push(clean)
      } else {
        combos.push({
          kind,
          target: id,
          parts: parts.map(({ word, parts: n }) => ({ word, parts: n })),
          example: parts.map((p) => p.example).join(' + '),
        })
      }
      continue
    }
    const entry = one(clean)
    if (entry) entries.push(entry)
    else skipped.push(clean)
  }
  return { entries, combos, skipped }
}

/** A readable form of a stored word for lists: "passedaway" is stored joined, shown as typed. */
export function describeEntry(entry) {
  return entry.example ?? entry.word
}
