import { feelings } from '../data/feelings.json'
import { topics } from '../data/topics.json'
import { detectMood } from './mood'
import { buildPalette } from './palette'

/**
 * Everything the Today screen needs from a note: what the engine read, what you corrected, and the
 * stamp colors that result.
 *
 *   readNote({ text, day, hour, month, lexicon, override }) -> { mood, feeling, topic, built, corrected }
 *
 * `override` is what you said it really was: { feeling?, topic? }. A correction wins over the
 * engine's guess, and the palette is rebuilt from it. Unknown ids are ignored, so a stale value
 * can never break the screen. `mood` is always the engine's own untouched reading.
 */
export function readNote({ text, day, hour, month, profile, lexicon, override = {} }) {
  const mood = detectMood({ text, hour, month, profile, lexicon })
  const feeling = feelings[override.feeling] ? override.feeling : mood.feeling
  const topic = topics[override.topic] ? override.topic : mood.topic
  const corrected = {
    feeling: feeling !== mood.feeling,
    topic: topic !== mood.topic,
  }
  // a corrected feeling is yours, not the engine's: it is neither "vivid" by guesswork nor tinted
  // by words that were read for a different feeling
  const energy = corrected.feeling ? 'soft' : mood.energy
  const built = buildPalette({
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
  return { mood, feeling, topic, built, corrected }
}
