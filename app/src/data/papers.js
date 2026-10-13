/**
 * The paper and frame on the back of a postcard (papers.json, yours to edit).
 *
 * A postcard stores just two ids, `paper` and `frame`. Anything it names that no longer exists (you
 * renamed one, or removed it) quietly falls back to the first paper and the first frame.
 */
import { fillColors } from '../lib/slots'
import data from './papers.json'

// papers.json uses the day's colors ({c0} to {c4}); the substitution is shared with tapes and doodles
export { fillColors }

export const PAPERS = data.papers
export const FRAMES = data.frames

/** What a new postcard starts with: the first paper and the first frame in papers.json. */
export const DEFAULT_PAPER = PAPERS[0].id
export const DEFAULT_FRAME = FRAMES[0].id

export const findPaper = (id) => PAPERS.find((p) => p.id === id) ?? PAPERS[0]
export const findFrame = (id) => FRAMES.find((f) => f.id === id) ?? FRAMES[0]

/** Inline style for a paper layer: its background, with the day's colors filled in, and its grain. */
export function paperStyle(paper, palette) {
  return { background: fillColors(paper.background, palette), '--grain': paper.grain ?? 0 }
}

/** True for a frame that draws something (every frame except "No frame"). */
export const hasFrame = (frame) => Boolean(frame.band || frame.border)

/** Inline style for a frame layer. A band is a ring of background; a line is a border. */
export function frameStyle(frame) {
  if (frame.band) {
    return { inset: frame.inset ?? 0, padding: frame.width ?? 8, background: frame.band }
  }
  return { inset: frame.inset ?? 8, border: frame.border, borderRadius: frame.radius ?? 0 }
}

/**
 * Keep a postcard's look sane before it is saved: only the fields you give are returned, and an id
 * that is not in papers.json becomes the default one.
 */
export function clampLook(patch) {
  const out = {}
  if ('paper' in patch)
    out.paper = PAPERS.some((p) => p.id === patch.paper) ? patch.paper : DEFAULT_PAPER
  if ('frame' in patch)
    out.frame = FRAMES.some((f) => f.id === patch.frame) ? patch.frame : DEFAULT_FRAME
  return out
}
