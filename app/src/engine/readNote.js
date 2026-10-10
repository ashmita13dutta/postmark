import { feelings } from '../data/feelings.json'
import { topics } from '../data/topics.json'
import { VIVID_FEELINGS, detectMood } from './mood'
import { moodBuilt } from './moods'
import { buildPalette } from './palette'
import { mixSignals } from './reader/mix'

/**
 * Everything the Today screen needs from a note: what the app read, what you corrected, and the
 * stamp colors that result.
 *
 *   readNote({ text, day, hour, month, lexicon, override, reader, corrections, moods })
 *     -> { mood, guess, feeling, topic, energy, built, corrected }
 *
 * HOW A FEELING IS CHOSEN
 *   - `reader` is the on-device language model's reading of this note ({ vector, probs } from
 *     reader/client.js). When it has one, the reader decides the feeling, adjusted by words you
 *     taught and by earlier corrections of near-identical notes. Without it (not downloaded, still
 *     loading, unsupported) the built-in keyword method decides, exactly as before.
 *   - `override` is what you said it really was: { feeling?, topic? }. A correction always wins over
 *     the app's guess, and the palette is rebuilt from it. Unknown ids are ignored, so a stale value
 *     can never break the screen.
 *
 * `moods` are the feelings you made up (buildMoods; the `lexicon` must have been built with them too,
 * so that the words you taught them are known). The on-device reader has never heard of them, so it
 * cannot vote for one. Instead a mood of yours is the guess when your own words for it outscore the
 * built-in keywords in the keyword reading (`guess.source` is then 'mine'), and its stamp is exactly
 * the five colors you chose. You can also pick one by hand with `override.feeling`.
 *
 * `mood` is always the keyword engine's own untouched reading (it also supplies the topic, color
 * words and taught words). `guess` is the app's feeling before your correction:
 *   { feeling, source: 'reader' | 'words', ranked: [{ id, p }] }  (ranked is best first; p is a
 *   probability for the reader and null for the keyword method)
 */
export function readNote({
  text,
  day,
  hour,
  month,
  profile,
  lexicon,
  override = {},
  reader = null,
  corrections = [],
  moods = new Map(),
}) {
  const mood = detectMood({ text, hour, month, profile, lexicon })

  let guess = {
    feeling: mood.feeling,
    source: 'words',
    ranked: [
      { id: mood.feeling, p: null },
      ...mood.scores.feelings
        .filter(([id]) => id !== mood.feeling)
        .map(([id]) => ({ id, p: null })),
    ],
  }
  if (reader && text.trim()) {
    const mixed = mixSignals({
      probs: reader.probs,
      vector: reader.vector,
      corrections,
      taughtFeelings: mood.taughtFeelings,
    })
    guess = { feeling: mixed.ranked[0].id, source: 'reader', ranked: mixed.ranked }
  }

  // your own word for a mood of yours beats the built-in reading (and the reader, which cannot know it)
  if (moods.has(mood.feeling) && text.trim()) {
    guess = {
      feeling: mood.feeling,
      source: 'mine',
      ranked: [{ id: mood.feeling, p: null }, ...guess.ranked.filter((a) => a.id !== mood.feeling)],
    }
  }

  const feeling =
    feelings[override.feeling] || moods.has(override.feeling) ? override.feeling : guess.feeling
  const topic = topics[override.topic] ? override.topic : mood.topic
  const corrected = {
    feeling: feeling !== guess.feeling,
    topic: topic !== mood.topic,
  }

  // How bright should the stamp be? A corrected feeling is yours, not the app's, so it is soft. The
  // keyword method works it out itself. For the reader: a loud feeling stays vivid when the note
  // has an exclamation mark or the reader is quite sure.
  let energy = mood.energy
  if (corrected.feeling || moods.has(feeling)) energy = 'soft'
  else if (guess.source === 'reader') {
    const sure = guess.ranked[0].p >= 0.5 || text.includes('!')
    energy = VIVID_FEELINGS.has(feeling) && sure ? 'vivid' : 'soft'
  }

  const built = moods.has(feeling)
    ? moodBuilt(moods.get(feeling))
    : buildPalette({
        feeling,
        topic,
        energy,
        seed: day,
        hour,
        month,
        profile,
        tints: mood.tints,
        tintStrong: mood.tintStrong,
      })
  return { mood, guess, feeling, topic, energy, built, corrected }
}
