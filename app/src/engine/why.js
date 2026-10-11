/**
 * "Why did it read this?": the evidence behind a reading, in plain sentences, so you can see which
 * words pushed the mood and teach it better.
 *
 *   explainReading({ r, text, moods }) -> { headline, lines }
 *
 * `r` is what readNote returned. `headline` is one line about the feeling; `lines` are a few short
 * sentences about the topic, the colors and the words you taught. Pure, so it is easy to test.
 */
import { defaultFeeling } from '../data/feelings.json'
import { topics } from '../data/topics.json'
import { moodLabel } from './moods'

const SHOW = 3

/** “happy”, “thrilled” and “joyful”; past three it says how many more. */
export function quoted(words) {
  const list = [...new Set(words)]
  const shown = list.slice(0, SHOW).map((w) => `“${w}”`)
  const more = list.length - shown.length
  if (more > 0) shown.push(`${more} more`)
  if (shown.length < 2) return shown[0] ?? ''
  return `${shown.slice(0, -1).join(', ')} and ${shown[shown.length - 1]}`
}

/**
 * Why the app's own reading (before any correction of yours) is the feeling it is, as a phrase that
 * follows "Joyful: " ("from “happy”", "no feeling words, so the usual mood for rain").
 */
function reasonFor({ r, text, moods }) {
  const { guess, mood } = r
  if (guess.source === 'mine') {
    const many = mood.feelingWords.length > 1
    return `your ${many ? 'words' : 'word'} ${quoted(mood.feelingWords)} bring${many ? '' : 's'} it on`
  }
  if (guess.source === 'reader') {
    // the reader's own confidence, not the score after your words and corrections were added
    const { id, p } = guess.reader
    const pct = Math.round(p * 100)
    if (id === guess.feeling) {
      let phrase = `read from the whole note, ${pct}% sure`
      if (guess.memory) phrase += '; it matches a note you corrected before'
      if (guess.taught) phrase += '; a word you taught agrees'
      return phrase
    }
    // what you taught it outweighed the reader
    const tipped =
      guess.memory && guess.taught
        ? 'a note you corrected and a word you taught'
        : guess.memory
          ? 'a note you corrected before'
          : guess.taught
            ? 'a word you taught'
            : 'what you have taught it'
    return `the reader leaned to ${moodLabel(id, moods)} (${pct}%), but ${tipped} tipped it`
  }
  if (mood.source.feeling === 'words') return `from ${quoted(mood.feelingWords)}`
  if (mood.source.feeling === 'topic') {
    const topic = topics[mood.topic].label.toLowerCase()
    // a bare "!" lifts a plain "content" to joyful (see detectMood)
    if (mood.feeling !== topics[mood.topic].defaultFeeling && text.includes('!'))
      return `no feeling words, but the “!” lifts the usual mood for ${topic}`
    return `no feeling words, so the usual mood for ${topic}`
  }
  return `nothing in the note points to a feeling, so it starts from ${moodLabel(defaultFeeling, moods)}`
}

/**
 * @param {object} input
 * @param {object} input.r      the result of readNote
 * @param {string} input.text   the note
 * @param {Map}    [input.moods] your moods (buildMoods), so their names and colors can be told apart
 * @returns {{ headline: string, lines: string[] }}
 */
export function explainReading({ r, text = '', moods = new Map() }) {
  const reason = reasonFor({ r, text, moods })
  const lines = []
  const guessed = moodLabel(r.guess.feeling, moods)
  const headline = r.corrected.feeling
    ? `You chose ${moodLabel(r.feeling, moods)}. The app read ${guessed}: ${reason}.`
    : `${guessed}: ${reason}.`

  // the topic
  const topic = topics[r.topic].label
  if (r.corrected.topic) {
    lines.push(`You chose ${topic} as the topic; the app read ${topics[r.mood.topic].label}.`)
  } else if (r.mood.source.topic === 'words') {
    lines.push(`About ${topic}: from ${quoted(r.mood.topicWords)}.`)
  } else if (r.mood.source.topic === 'time') {
    lines.push(`About ${topic}: no topic words, so it went by the time of day.`)
  } else {
    lines.push(`About ${topic}: no topic words, so it went by the season.`)
  }

  // the colors
  if (r.built.mine) {
    lines.push(`The colors are exactly the five you chose for ${moodLabel(r.feeling, moods)}.`)
  } else {
    for (const t of r.mood.tintWords.slice(0, 2)) {
      lines.push(
        t.strong
          ? `${quoted([t.word])} asked for ${t.name}, so the stamp is built around it.`
          : `${quoted([t.word])} added ${t.name} as an accent.`,
      )
    }
    if (r.energy === 'vivid') lines.push('Bright colors, because the note sounds strong.')
  }

  if (r.mood.taught.length) lines.push(`Words you taught that counted: ${quoted(r.mood.taught)}.`)
  return { headline, lines }
}
