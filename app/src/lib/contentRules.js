/**
 * Quality limits for the content files, in OKLab units (how different colors look to people).
 * Shared by `npm run analyze` and the tests so they always agree. Tune here if you disagree.
 */
export const LIMITS = {
  minPair: 0.06, // two colors in a palette closer than this look like one band
  minRange: 0.3, // lightest minus darkest, so a stamp has depth
  maxChromaSoft: 0.2, // soft palettes: warm, faded, like old stamps
  maxChromaVivid: 0.26, // vivid palettes: bright and cheerful, still printed ink, not neon
  minChromaVivid: 0.15, // a palette tagged vivid must have at least one properly bright color
  minAccentPair: 0.08, // a topic's 3 accent colors must be clearly different
  nameMatch: 0.035, // every palette and accent color needs a name at least this close
}
