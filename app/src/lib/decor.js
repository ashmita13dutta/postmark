import { TONES } from '../data/stickers'
import { seededRng } from './rng'

/** A postcard holds about five decorations; the sixth gets a gentle "your postcard is full". */
export const MAX_DECORATIONS = 5

export const SCALE_RANGE = { min: 0.5, max: 2.5 }

const TONE_IDS = TONES.map((t) => t.id)

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n))
const finite = (n, fallback) => (Number.isFinite(n) ? n : fallback)

/**
 * Keep a decoration's placement and look sane. x and y are the sticker's centre as a fraction of the
 * card (0 to 1), so a postcard looks the same at any screen size. Rotation is degrees, wrapped to
 * (-180, 180]. `tone` is one of the TONES ids (anything else becomes 'original') and `outline` is
 * the white die-cut edge, on or off. Fields not given are left out, so this works for patches too.
 */
export function clampPlacement(p) {
  const out = {}
  if ('x' in p) out.x = clamp(finite(p.x, 0.5), 0, 1)
  if ('y' in p) out.y = clamp(finite(p.y, 0.5), 0, 1)
  if ('scale' in p) out.scale = clamp(finite(p.scale, 1), SCALE_RANGE.min, SCALE_RANGE.max)
  if ('rotation' in p) {
    const r = finite(p.rotation, 0) % 360
    out.rotation = r > 180 ? r - 360 : r <= -180 ? r + 360 : r
  }
  if ('tone' in p) out.tone = TONE_IDS.includes(p.tone) ? p.tone : 'original'
  if ('outline' in p) out.outline = Boolean(p.outline)
  return out
}

/** Every sticker lands tilted by somewhere in this range, a touch more to the right than the left. */
export const DROP_TILT = { min: -3, max: 4 }

/** The small random tilt a sticker gets when dropped, like one pressed on by hand. Same key, same tilt. */
export function dropTilt(key, { min, max } = DROP_TILT) {
  return min + seededRng(`drop:${key}`)() * (max - min)
}

/**
 * Where a new sticker lands: spiralling out from the middle so each new one is easy to tell apart
 * from the last, with a little seeded wobble so it never looks like a grid.
 */
export function dropSpot(count, key) {
  const rnd = seededRng(`spot:${key}`)
  const angle = count * 2.4 + rnd() * 0.6
  const radius = 0.08 + count * 0.07
  return {
    x: clamp(0.5 + Math.cos(angle) * radius * 0.9, 0.2, 0.8),
    y: clamp(0.5 + Math.sin(angle) * radius, 0.2, 0.8),
  }
}
