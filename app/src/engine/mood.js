/**
 * Reads a note and works out how the day FELT and what it was ABOUT.
 *
 *   detectMood({ text, hour, month }) -> { feeling, topic, ... }
 *
 * No network, no AI: it counts keyword hits from feelings.json / topics.json / emoji.json, with a
 * few touches that matter in real journal writing:
 *   - negation:   "not happy" does not count as joyful (it leans disappointed instead)
 *   - intensity:  "so happy" counts for more
 *   - the ending: for feelings, words near the end of a note, and after "but", count for more
 *   - phrases:    "ice cream" and "road trip" match as one word
 *   - emoji:      a 😍 or 😴 counts like a word
 * When nothing matches it falls back to the topic's usual mood, then the time of day and season.
 * Pure: the caller passes the local hour and month (see contextAt) so time travel stays testable.
 */
import emojiData from '../data/emoji.json'
import tintData from '../data/tints.json'
import typoGuard from '../data/notTypos.json'
import { hexToOklab, oklabDistance } from '../lib/color'
import { defaultFeeling, feelings } from '../data/feelings.json'
import { fallback, topics } from '../data/topics.json'

const FEELING_IDS = Object.keys(feelings)
const TOPIC_IDS = Object.keys(topics)

// "didnt" and "cant" are written without apostrophes because we strip them before matching
const NEGATORS = new Set([
  'not',
  'no',
  'never',
  'cant',
  'cannot',
  'dont',
  'didnt',
  'wasnt',
  'isnt',
  'arent',
  'werent',
  'wont',
  'wouldnt',
  'couldnt',
  'shouldnt',
  'without',
  'hardly',
  'barely',
  'neither',
  'nor',
  'nahi',
  'nahin',
  'nhi',
  'nai',
  'nei',
])
// The longest phrase we try to match, in words ("on top of the world" is 5)
const MAX_PHRASE = 5
// "no plans", "without sugar": these only reach the very next word
const DETERMINER_NEGATORS = new Set(['no', 'without', 'neither', 'nor'])
// "can't stop smiling", "couldn't help laughing": a double negative, so it is positive
const CANT = new Set(['cant', 'couldnt', 'cannot'])
// "would have been more fun than...", "could have been better": the good thing did not happen
const CANT_PLAIN = new Set(['could', 'can'])
const COUNTERFACTUAL = new Set(['would', 'could', 'should'])
const STOP_WORDS = new Set(['stop', 'help'])
// "almost cried", "nearly gave up": it did not quite happen, so the feeling word is ignored
const ALMOST = new Set(['almost', 'nearly'])
// "missed the bus" is not "missed you": after 'missed' these words mean something that was not caught
const MISSED_THINGS = new Set([
  'the',
  'a',
  'an',
  'two',
  'three',
  'four',
  'last',
  'class',
  'classes',
  'call',
  'calls',
  'bus',
  'train',
  'metro',
  'flight',
  'deadline',
  'exam',
  'meeting',
  'lecture',
  'lunch',
  'dinner',
  'breakfast',
  'turn',
  'another',
  'both',
  'my',
  'our',
])
const MISSED_OBJECTS = new Set([
  'bus',
  'train',
  'metro',
  'flight',
  'class',
  'call',
  'calls',
  'deadline',
  'exam',
  'lecture',
  'lunch',
  'dinner',
  'breakfast',
  'meeting',
  'turn',
  'classes',
  'alarm',
])
// Negators that follow the word they negate (Hindi/Bengali word order)
const POSTPOSED_NEGATORS = new Set(['nahi', 'nahin', 'nhi', 'nai', 'nei'])
const INTENSIFIERS = new Set([
  'so',
  'very',
  'really',
  'super',
  'extremely',
  'absolutely',
  'totally',
  'incredibly',
  'utterly',
  'truly',
  'too',
  'soo',
  'sooo',
  'bohot',
  'bahut',
  'bahot',
  'itna',
  'itni',
  'kaafi',
  'kafi',
  'ekdum',
  'ekdom',
  'khub',
  'onek',
  'ato',
])
const CONTRAST = new Set([
  'but',
  'however',
  'though',
  'although',
  'anyway',
  'except',
  'yet',
  'then',
  'until',
  'eventually',
])
// Negating one of these ("not happy") points toward disappointed. Negating anything else is ignored.
const POSITIVE = new Set([
  'joyful',
  'content',
  'peaceful',
  'dreamy',
  'excited',
  'proud',
  'loving',
  'grateful',
  'inspired',
])
// Feelings that can be loud. An emphatic note in one of these gets a vivid palette.
const VIVID_FEELINGS = new Set(['joyful', 'excited', 'proud', 'loving', 'angry'])

/**
 * The forms a keyword can take in a note: rain -> rains, rained, raining. We expand the keyword
 * (instead of trimming what was typed) so a short word is never mistaken for a longer one:
 * "notes" will never match plain "not", and "longing" will never match "long".
 */
export function inflections(word) {
  const forms = new Set([word])
  if (word.length < 3) return [...forms]
  const e = word.endsWith('e')
  const y = word.endsWith('y') && !/[aeiou]y$/.test(word)
  forms.add(/(s|x|z|ch|sh)$/.test(word) ? `${word}es` : y ? `${word.slice(0, -1)}ies` : `${word}s`)
  forms.add(y ? `${word.slice(0, -1)}ied` : e ? `${word}d` : `${word}ed`)
  forms.add(e ? `${word.slice(0, -1)}ing` : `${word}ing`)
  // panic -> panicked/panicking
  if (word.endsWith('c')) {
    forms.add(`${word}ked`)
    forms.add(`${word}king`)
  }
  // short consonant-vowel-consonant words double the last letter: run -> running, stop -> stopped
  if (word.length <= 4 && /[^aeiou][aeiou][^aeiouwxy]$/.test(word)) {
    const last = word.slice(-1)
    forms.add(`${word}${last}ed`)
    forms.add(`${word}${last}ing`)
  }
  return [...forms]
}

/**
 * Lowercase, drop apostrophes, split into words, and number the sentences and clauses.
 * A clause ends at a comma or a full stop, so "no plans, so serene" keeps "no" away from "serene".
 */
export function tokenize(text) {
  const cleaned = text.toLowerCase().replace(/['’`]/g, '')
  const out = []
  let sentence = 0
  let clause = 0
  for (const m of cleaned.matchAll(/\p{L}+|[.!?;\n,]+/gu)) {
    if (/^[.!?;\n,]/.test(m[0])) {
      if (/[.!?;\n]/.test(m[0])) sentence++
      clause++
    } else out.push({ word: m[0], sentence, clause })
  }
  return out
}

// ---- lookup tables, built once ----

/** word -> { kind: 'feeling' | 'topic', id }. Exact keywords first, then their inflections. */
const index = new Map()
/** Inflections that two different entries both want. Exact keywords always win; this is for review. */
export const ambiguousForms = []

const entries = [
  ...FEELING_IDS.map((id) => ({ kind: 'feeling', id, words: feelings[id].keywords })),
  ...TOPIC_IDS.map((id) => ({ kind: 'topic', id, words: topics[id].keywords })),
]
const hintFor = (kind, id, w) => (kind === 'topic' ? topics[id].hints?.[w] : undefined)
// Weak words are ambiguous ("quiet", "refreshed", "notes", "spilled"): they count for half, so a
// clearer signal elsewhere in the note wins. Listed per entry as "weak" in the data files.
const weakOf = (kind, id) => new Set((kind === 'topic' ? topics[id] : feelings[id]).weak ?? [])
const info = (kind, id, w) => ({
  kind,
  id,
  hint: hintFor(kind, id, w),
  weak: weakOf(kind, id).has(w),
})
for (const { kind, id, words } of entries) for (const w of words) index.set(w, info(kind, id, w))
for (const { kind, id, words } of entries) {
  for (const w of words) {
    for (const form of inflections(w)) {
      const prev = index.get(form)
      if (!prev) index.set(form, info(kind, id, w))
      else if (prev.id !== id || prev.kind !== kind) {
        // an exact keyword of another entry is fine (it wins); only flag two inflections colliding
        const exactOwner = entries.some((e) => e.words.includes(form))
        if (!exactOwner)
          ambiguousForms.push(`"${form}" wanted by ${kind}:${id} and ${prev.kind}:${prev.id}`)
      }
    }
  }
}

// ---- tints: words that ask for a color ("breezy morning" -> bright blue) ----

/** word -> { color, name }. Written joined for phrases; single words also match their forms. */
const tintIndex = new Map()
for (const { color, name, words } of tintData.tints) {
  for (const w of words) tintIndex.set(w, { color, name })
}
for (const { color, name, words } of tintData.tints) {
  for (const w of words) {
    for (const form of inflections(w))
      if (!tintIndex.has(form)) tintIndex.set(form, { color, name })
  }
}
const HEX = /^#[0-9A-Fa-f]{6}$/

const stripVS = (s) => s.replace(/️/g, '') // emoji variation selector (invisible)
const emojiTable = []
for (const [id, list] of Object.entries(emojiData.feelings))
  for (const e of list) emojiTable.push({ e: stripVS(e), kind: 'feeling', id })
for (const [id, list] of Object.entries(emojiData.topics))
  for (const e of list) emojiTable.push({ e: stripVS(e), kind: 'topic', id })

const keywordCount = (id) => topics[id].keywords.length
// the real keywords only (not the forms we generate from them): typos are matched against these
const exactWords = new Set(entries.flatMap((e) => e.words))

// ---- typos ----

function transposes(w) {
  const out = []
  for (let i = 0; i < w.length - 1; i++) out.push(w.slice(0, i) + w[i + 1] + w[i] + w.slice(i + 2))
  return out
}
// Real words that are two swapped letters away from a keyword. They are NOT typos ("quite" is not "quiet").
const NOT_TYPOS = new Set(typoGuard)

/**
 * A keyword with two adjacent letters swapped ("tierd" -> tired, "excietd" -> excited). Only for
 * words of 5+ letters that we do not know, and only when exactly one entry matches, so it never
 * guesses between two meanings. We tried allowing any single wrong, missing or extra letter and
 * it was a disaster ("stopping" became "shopping", "yellow" became "mellow"): real words are
 * almost never two swapped letters away from a keyword, but they are very often one edit away.
 * Typo matches count a little less.
 */
export function typoOwner(word) {
  if (word.length < 5 || index.has(word) || NOT_TYPOS.has(word)) return null
  let owner = null
  for (const c of transposes(word)) {
    if (!exactWords.has(c)) continue
    const o = index.get(c)
    if (!o) continue
    if (owner && (owner.id !== o.id || owner.kind !== o.kind)) return null
    owner = o
  }
  return owner && { ...owner, typo: true }
}

// ---- the engine ----

/** Local hour and month for a timestamp. Use with now() from lib/clock.js. */
export function contextAt(ms) {
  const d = new Date(ms)
  return { hour: d.getHours(), month: d.getMonth() + 1 }
}

/**
 * Stretched words: "uffff" -> "uff", "sooo" -> "so", "yaaay" -> "yay". Keeps two letters when the
 * two-letter form is a word we know ("soo", "uff"), otherwise one.
 */
export function unstretch(word) {
  if (!/(.)\1{2,}/.test(word)) return word
  const two = word.replace(/(.)\1{2,}/g, '$1$1')
  const one = word.replace(/(.)\1+/g, '$1')
  const known = (w) => index.has(w) || NEGATORS.has(w) || INTENSIFIERS.has(w) || CONTRAST.has(w)
  if (known(two)) return two
  if (known(one)) return one
  return two
}

/**
 * Your own taught words, ready for lookup. Each entry is { word, kind: 'feeling' | 'topic', id,
 * parts }: `word` is the word or phrase written joined ("bekaar", "passedaway") and `parts` how
 * many words it is. Single words also match their usual forms (taught "cook" also matches
 * "cooked"), but never over a word you taught exactly.
 * @returns {Map<string, object>}
 */
export function buildLexicon(entries = []) {
  const map = new Map()
  const tints = new Map() // words you tied to a color
  const valid = (e) =>
    !!e?.word &&
    (e.kind === 'feeling'
      ? feelings[e.id]
      : e.kind === 'topic'
        ? topics[e.id]
        : e.kind === 'tint' && HEX.test(e.id ?? ''))
  const target = (e) => (e.kind === 'tint' ? tints : map)
  const info = (e) =>
    e.kind === 'tint'
      ? { color: e.id.toUpperCase(), name: e.example ?? e.word, taught: true }
      : { kind: e.kind, id: e.id, hint: undefined, weak: false, taught: true }
  for (const e of entries) if (valid(e)) target(e).set(e.word, info(e))
  for (const e of entries) {
    if (!valid(e) || e.parts !== 1) continue
    for (const form of inflections(e.word)) if (!target(e).has(form)) target(e).set(form, info(e))
  }
  Object.defineProperty(map, 'tints', { value: tints })
  return map
}

/**
 * The colors a note asks for. Phrases first ("morning breeze"), then single words; a word right
 * after a "no"/"not" does not count ("no breeze today"). Returns each match with its weight.
 */
function findTints(text, userTints) {
  const lookup = (key) => userTints?.get(key) ?? tintIndex.get(key)
  const tokens = tokenize(text).map((tk) => ({ ...tk, word: unstretch(tk.word) }))
  const n = tokens.length
  const found = []
  for (let i = 0; i < n; i++) {
    let owner = null
    let span = 1
    for (let len = Math.min(MAX_PHRASE, n - i); len >= 2 && !owner; len--) {
      const parts = tokens.slice(i, i + len)
      if (!parts.every((p) => p.sentence === tokens[i].sentence)) continue
      owner = lookup(parts.map((p) => p.word).join('')) ?? null
      if (owner) span = len
    }
    if (!owner) owner = lookup(tokens[i].word) ?? null
    if (!owner) continue
    const negated = [i - 1, i - 2].some(
      (j) => j >= 0 && tokens[j].clause === tokens[i].clause && NEGATORS.has(tokens[j].word),
    )
    if (!negated) {
      found.push({
        color: owner.color,
        name: owner.name,
        word: tokens
          .slice(i, i + span)
          .map((p) => p.word)
          .join(' '),
        at: i,
        weight: (span >= 2 ? 1.5 : 1) * (owner.taught ? 1.5 : 1),
      })
    }
    i += span - 1
  }
  return found
}

/** Up to two clearly different colors, strongest first (a tie goes to what was said first). */
function pickTints(found) {
  const byColor = new Map()
  for (const h of found) {
    const cur = byColor.get(h.color) ?? { ...h, weight: 0 }
    cur.weight += h.weight
    cur.at = Math.min(cur.at, h.at)
    byColor.set(h.color, cur)
  }
  const ranked = [...byColor.values()].sort((a, b) => b.weight - a.weight || a.at - b.at)
  const chosen = []
  for (const r of ranked) {
    const lab = hexToOklab(r.color)
    if (chosen.every((c) => oklabDistance(hexToOklab(c.color), lab) >= 0.08)) chosen.push(r)
    if (chosen.length === 2) break
  }
  // strong: a phrase ("morning breeze"), something you taught, or the same color asked for twice
  return chosen.map(({ color, name, word, weight }) => ({
    color,
    name,
    word,
    strong: weight >= 1.5,
  }))
}

function findHits(text, lexicon) {
  const lookup = (key) => lexicon?.get(key) ?? index.get(key)
  const tokens = tokenize(text).map((t) => ({ ...t, word: unstretch(t.word) }))
  const n = tokens.length
  const lastContrast = tokens.reduce((last, t, i) => (CONTRAST.has(t.word) ? i : last), -1)
  const hits = []

  const sameSentence = (i, j) => tokens[j].sentence === tokens[i].sentence
  const sameClause = (i, j) => tokens[j].clause === tokens[i].clause
  const negatedAt = (i, span = 1, kind = 'feeling') => {
    // English: "not happy" (the negator comes before). A topic is only negated right next to it
    // ("no exams"); "didn't enjoy the movie" says nothing against the movie.
    const reach = kind === 'topic' ? 1 : 3
    for (let j = Math.max(0, i - reach); j < i; j++) {
      if (!sameClause(i, j)) continue
      const w = tokens[j].word
      if (!NEGATORS.has(w)) continue
      if (DETERMINER_NEGATORS.has(w) && i - j > 1) continue // "no plans" is not "not ..."
      if (CANT.has(w) && STOP_WORDS.has(tokens[j + 1]?.word)) continue // "can't stop smiling" is positive
      // "could not stop smiling", "can not stop": the negator is the word 'not' after could/can
      if (w === 'not' && CANT_PLAIN.has(tokens[j - 1]?.word) && STOP_WORDS.has(tokens[j + 1]?.word))
        continue
      return true
    }
    // counterfactual: "would have been more fun", "could have been better"
    for (let j = Math.max(0, i - 4); j < i; j++) {
      if (sameClause(i, j) && COUNTERFACTUAL.has(tokens[j].word) && tokens[j + 1]?.word === 'have')
        return true
    }
    // Hindi and Bengali: "khush nahi hoon", "mast nai laglo" (the negator comes after)
    for (let j = i + span; j <= Math.min(n - 1, i + span + 1); j++)
      if (sameClause(i, j) && POSTPOSED_NEGATORS.has(tokens[j].word)) return true
    return false
  }
  const intensifiedAt = (i) =>
    [i - 1, i - 2].some((j) => j >= 0 && sameSentence(i, j) && INTENSIFIERS.has(tokens[j].word))

  for (let i = 0; i < n; i++) {
    // try the longest phrase first ("over the moon" -> "overthemoon", "ice cream" -> "icecream"),
    // down to two words, then the single word. Keywords for phrases are written joined.
    let owner = null
    let word = tokens[i].word
    let span = 1
    for (let len = Math.min(MAX_PHRASE, n - i); len >= 2 && !owner; len--) {
      const parts = tokens.slice(i, i + len)
      if (!parts.every((_, k) => sameSentence(i, i + k))) continue
      owner = lookup(parts.map((t) => t.word).join('')) ?? null
      if (owner) {
        word = parts.map((t) => t.word).join(' ')
        span = len
      }
    }
    if (!owner) owner = lookup(tokens[i].word) ?? typoOwner(tokens[i].word)
    if (!owner) continue

    // "almost cried" did not happen, so it says nothing
    if (
      owner.kind === 'feeling' &&
      i > 0 &&
      sameSentence(i, i - 1) &&
      ALMOST.has(tokens[i - 1].word)
    ) {
      i += span - 1
      continue
    }
    // "missed the bus" says nothing about feeling lonely
    if (
      owner.kind === 'feeling' &&
      tokens[i].word === 'missed' &&
      MISSED_THINGS.has(tokens[i + 1]?.word) &&
      (!['my', 'our'].includes(tokens[i + 1].word) || MISSED_OBJECTS.has(tokens[i + 2]?.word))
    ) {
      i += span - 1
      continue
    }

    // Feelings care about the shape of the note: later counts more, "but" outweighs what came
    // before, "so happy" outweighs "happy". Topics are just "what was mentioned", so they don't.
    let weight = 1 + 0.4 * (i / Math.max(1, n - 1))
    if (lastContrast >= 0 && i < lastContrast) weight *= 0.6
    if (intensifiedAt(i)) weight *= 1.5
    if (span >= 2) weight *= 1.5 // a deliberate phrase ("nothing happened") says more than a stray word
    if (owner.kind === 'topic') weight = 1
    if (owner.weak) weight *= 0.5
    if (owner.typo) weight *= 0.8
    // a word you deliberately taught is stronger evidence than a built-in guess
    if (owner.taught) weight *= 1.5

    let { kind, id } = owner
    const intense = intensifiedAt(i)
    if (negatedAt(i, span, kind)) {
      if (kind === 'feeling' && POSITIVE.has(id)) {
        id = 'disappointed' // "not happy"
        word = `not ${word}`
      } else {
        i += span - 1
        continue // "no exams", "not tired": says nothing useful
      }
    }
    // "so good", "really good" is more than just fine
    if (kind === 'feeling' && id === 'content' && intense) id = 'joyful'
    hits.push({ kind, id, word, weight, at: i, taught: owner.taught })
    // some topic words lean toward a mood ("interview" is usually anxious); a gentle nudge that
    // any real feeling word outweighs
    if (owner.hint && kind === 'topic') {
      hits.push({ kind: 'feeling', id: owner.hint, word, weight: 0.6, at: i })
    }
    i += span - 1
  }

  // emoji count like words
  const plain = stripVS(text)
  for (const { e, kind, id } of emojiTable) {
    const count = plain.split(e).length - 1
    for (let k = 0; k < Math.min(count, 3); k++) hits.push({ kind, id, word: e, weight: 1, at: n })
  }
  return hits
}

function tally(hits, kind) {
  const score = new Map()
  const words = new Map()
  const last = new Map()
  const first = new Map()
  const seen = new Map()
  for (const h of hits) {
    if (h.kind !== kind) continue
    const key = `${h.id}|${h.word}`
    const times = (seen.get(key) ?? 0) + 1
    seen.set(key, times)
    // repeating the same word helps, with diminishing returns
    score.set(h.id, (score.get(h.id) ?? 0) + h.weight / times)
    const w = words.get(h.id) ?? []
    if (!w.includes(h.word)) w.push(h.word)
    words.set(h.id, w)
    last.set(h.id, Math.max(last.get(h.id) ?? -1, h.at))
    first.set(h.id, Math.min(first.get(h.id) ?? Infinity, h.at))
  }
  return { score, words, last, first }
}

/**
 * Best first. Higher score wins. Ties:
 *  - a feeling goes to whatever was said LAST (how the day ended up feeling);
 *  - a topic goes to whatever was mentioned FIRST (journal entries usually name their subject
 *    up front), after a small nudge for a topic that suits the time of day (night after 9pm),
 *    then to the more specific topic (fewer keywords).
 */
function rank(t, kind, hour) {
  const order = kind === 'feeling' ? FEELING_IDS : TOPIC_IDS
  const nudge = (id) => (kind === 'topic' && (topics[id].hours ?? []).includes(hour) ? 0.01 : 0)
  return [...t.score.keys()].sort((a, b) => {
    const diff = t.score.get(b) + nudge(b) - (t.score.get(a) + nudge(a))
    if (Math.abs(diff) > 1e-9) return diff
    if (kind === 'topic') {
      return (
        t.first.get(a) - t.first.get(b) ||
        keywordCount(a) - keywordCount(b) ||
        order.indexOf(a) - order.indexOf(b)
      )
    }
    return t.last.get(b) - t.last.get(a) || order.indexOf(a) - order.indexOf(b)
  })
}

function confidence(t, ranked) {
  if (!ranked.length) return 'none'
  const top = t.score.get(ranked[0])
  const second = ranked[1] ? t.score.get(ranked[1]) : 0
  return top >= 2 && top >= 1.5 * second ? 'high' : 'low'
}

/**
 * @param {object} input
 * @param {string} input.text   the note (may include emoji)
 * @param {number} input.hour   local hour 0-23
 * @param {number} input.month  local month 1-12
 * @param {string} [input.profile] fallback profile from topics.json ("generic", "kolkata"...)
 * @param {object[]|Map} [input.lexicon] words you taught (see buildLexicon); they win over built-ins
 */
export function detectMood({ text = '', hour, month, profile, lexicon }) {
  const lex = lexicon instanceof Map ? lexicon : lexicon?.length ? buildLexicon(lexicon) : undefined
  const hits = findHits(text, lex)
  const tintList = pickTints(findTints(text, lex?.tints))
  const f = tally(hits, 'feeling')
  const t = tally(hits, 'topic')
  const rankedFeelings = rank(f, 'feeling', hour)
  const rankedTopics = rank(t, 'topic', hour)

  const topicFromWords = rankedTopics[0] ?? null
  const profileData = fallback.profiles[profile] ?? fallback.profiles[fallback.activeProfile]
  let topic = topicFromWords
  let topicSource = 'words'
  if (!topic) {
    const night = TOPIC_IDS.find((id) => (topics[id].hours ?? []).includes(hour))
    if (night) {
      topic = night
      topicSource = 'time'
    } else {
      topic = profileData.monthTopic[month]
      topicSource = 'season'
    }
  }

  let feeling = rankedFeelings[0] ?? null
  let feelingSource = 'words'
  if (!feeling) {
    // no feeling words: use the mood this topic usually carries (rain is peaceful, exams anxious...)
    if (topicFromWords) {
      feeling = topics[topicFromWords].defaultFeeling
      feelingSource = 'topic'
    } else {
      feeling = defaultFeeling
      feelingSource = 'default'
    }
  }

  const second = rankedTopics[1]
  const secondaryTopic =
    topicFromWords && second && t.score.get(second) >= 0.6 * t.score.get(topicFromWords)
      ? second
      : null

  // A bare "!" with no feeling words lifts a plain "content" to joyful ("Ran my first 5k!")
  if (
    feelingSource === 'topic' &&
    feeling === 'content' &&
    text.includes('!') &&
    !tokenize(text).some((tk) => NEGATORS.has(tk.word) && !DETERMINER_NEGATORS.has(tk.word))
  )
    feeling = 'joyful'

  // How emphatic was the note? "so happy", strong wording or an exclamation mark make a bright
  // feeling vivid; anything mild stays soft. Feelings that are quiet by nature are always soft.
  const strength = feelingSource === 'words' ? f.score.get(feeling) : 0
  const emphatic = strength >= 2 || text.includes('!')
  const energy = VIVID_FEELINGS.has(feeling) && emphatic ? 'vivid' : 'soft'

  const top3 = (tl, ranked) =>
    ranked.slice(0, 3).map((id) => [id, Math.round(tl.score.get(id) * 100) / 100])
  return {
    feeling,
    topic,
    energy,
    // colors the note asked for ("breezy morning" -> blue), strongest first, at most two
    tints: tintList.map((x) => x.color),
    // a strong tint builds the whole stamp around its color; a passing one adds an accent
    tintStrong: tintList[0]?.strong ?? false,
    tintWords: tintList,
    // which of YOUR taught words shaped this reading
    taught: [...new Set(hits.filter((h) => h.taught).map((h) => h.word))],
    secondaryTopic,
    feelingWords: f.words.get(rankedFeelings[0]) ?? [],
    topicWords: t.words.get(topicFromWords) ?? [],
    source: { feeling: feelingSource, topic: topicSource },
    confidence: { feeling: confidence(f, rankedFeelings), topic: confidence(t, rankedTopics) },
    scores: { feelings: top3(f, rankedFeelings), topics: top3(t, rankedTopics) },
  }
}

/** Does the engine already understand this word (a keyword, a form of one, or one you taught)? */
export function isKnownWord(word, lexicon) {
  const w = unstretch(word.toLowerCase())
  return !!(
    lexicon?.get(w) ??
    lexicon?.tints?.get(w) ??
    index.get(w) ??
    tintIndex.get(w) ??
    (NEGATORS.has(w) || POSTPOSED_NEGATORS.has(w) || INTENSIFIERS.has(w) || CONTRAST.has(w))
  )
}
