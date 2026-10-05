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
])
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
])
const CONTRAST = new Set(['but', 'however', 'though', 'although', 'anyway', 'except'])
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

/** Lowercase, drop apostrophes, split into words, and number the sentences. */
export function tokenize(text) {
  const cleaned = text.toLowerCase().replace(/['’`]/g, '')
  const out = []
  let sentence = 0
  for (const m of cleaned.matchAll(/\p{L}+|[.!?;\n]+/gu)) {
    if (/^[.!?;\n]/.test(m[0])) sentence++
    else out.push({ word: m[0], sentence })
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
for (const { kind, id, words } of entries) for (const w of words) index.set(w, { kind, id })
for (const { kind, id, words } of entries) {
  for (const w of words) {
    for (const form of inflections(w)) {
      const prev = index.get(form)
      if (!prev) index.set(form, { kind, id })
      else if (prev.id !== id || prev.kind !== kind) {
        // an exact keyword of another entry is fine (it wins); only flag two inflections colliding
        const exactOwner = entries.some((e) => e.words.includes(form))
        if (!exactOwner)
          ambiguousForms.push(`"${form}" wanted by ${kind}:${id} and ${prev.kind}:${prev.id}`)
      }
    }
  }
}

const stripVS = (s) => s.replace(/️/g, '')
const emojiTable = []
for (const [id, list] of Object.entries(emojiData.feelings))
  for (const e of list) emojiTable.push({ e: stripVS(e), kind: 'feeling', id })
for (const [id, list] of Object.entries(emojiData.topics))
  for (const e of list) emojiTable.push({ e: stripVS(e), kind: 'topic', id })

const keywordCount = (id) => topics[id].keywords.length

// ---- the engine ----

/** Local hour and month for a timestamp. Use with now() from lib/clock.js. */
export function contextAt(ms) {
  const d = new Date(ms)
  return { hour: d.getHours(), month: d.getMonth() + 1 }
}

function findHits(text) {
  const tokens = tokenize(text)
  const n = tokens.length
  const lastContrast = tokens.reduce((last, t, i) => (CONTRAST.has(t.word) ? i : last), -1)
  const hits = []

  const sameSentence = (i, j) => tokens[j].sentence === tokens[i].sentence
  const negatedAt = (i) => {
    for (let j = Math.max(0, i - 3); j < i; j++)
      if (sameSentence(i, j) && NEGATORS.has(tokens[j].word)) return true
    return false
  }
  const intensifiedAt = (i) =>
    [i - 1, i - 2].some((j) => j >= 0 && sameSentence(i, j) && INTENSIFIERS.has(tokens[j].word))

  for (let i = 0; i < n; i++) {
    // try the two-word phrase first ("ice" + "cream" -> "icecream"), then the single word
    let owner = null
    let word = tokens[i].word
    let span = 1
    if (i + 1 < n && sameSentence(i, i + 1)) {
      owner = index.get(tokens[i].word + tokens[i + 1].word) ?? null
      if (owner) {
        word = `${tokens[i].word} ${tokens[i + 1].word}`
        span = 2
      }
    }
    if (!owner) owner = index.get(tokens[i].word) ?? null
    if (!owner) continue

    // Feelings care about the shape of the note: later counts more, "but" outweighs what came
    // before, "so happy" outweighs "happy". Topics are just "what was mentioned", so they don't.
    let weight = 1 + 0.4 * (i / Math.max(1, n - 1))
    if (lastContrast >= 0 && i < lastContrast) weight *= 0.6
    if (intensifiedAt(i)) weight *= 1.5
    if (span === 2) weight *= 1.5 // a deliberate phrase ("nothing happened") says more than a stray word
    if (owner.kind === 'topic') weight = 1

    let { kind, id } = owner
    if (negatedAt(i)) {
      if (kind === 'feeling' && POSITIVE.has(id)) {
        id = 'disappointed' // "not happy"
        word = `not ${word}`
      } else {
        i += span - 1
        continue // "no exams", "not tired": says nothing useful
      }
    }
    hits.push({ kind, id, word, weight, at: i })
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
 */
export function detectMood({ text = '', hour, month, profile }) {
  const hits = findHits(text)
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
    secondaryTopic,
    feelingWords: f.words.get(rankedFeelings[0]) ?? [],
    topicWords: t.words.get(topicFromWords) ?? [],
    source: { feeling: feelingSource, topic: topicSource },
    confidence: { feeling: confidence(f, rankedFeelings), topic: confidence(t, rankedTopics) },
    scores: { feelings: top3(f, rankedFeelings), topics: top3(t, rankedTopics) },
  }
}
