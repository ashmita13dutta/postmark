/**
 * A stamp as a small flag of its five colors, top to bottom: the quilt's squares and the month
 * sheets' days use it, so a day reads as "its stamp" even at a few pixels wide.
 */
export function bandsOf(palette) {
  const stops = palette.map((c, i) => `${c.hex} ${i * 20}% ${(i + 1) * 20}%`)
  return `linear-gradient(to bottom, ${stops.join(', ')})`
}

/** "Sat 12 Sep", for a square's label. */
export function shortDay(day) {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

export const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]
