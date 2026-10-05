import { sealedUntilFor } from '../lib/dates'

/** Five plain swatches used until a real palette exists, so a moment always has 5 colors. */
export const BLANK_PALETTE = [
  { hex: '#EFE7D2', name: 'Blank Paper' },
  { hex: '#E4DAC2', name: 'Soft Parchment' },
  { hex: '#D6CBB0', name: 'Old Envelope' },
  { hex: '#C4B89B', name: 'Dusty Twine' },
  { hex: '#B0A488', name: 'Faded Ledger' },
]

/** Fields a caller may set when creating or editing a moment. */
export const EDITABLE_FIELDS = [
  'note',
  'city',
  'lat',
  'lon',
  'songTitle',
  'songArtist',
  'songSource',
  'palette',
  'paletteSource',
  'feeling',
  'topic',
]

const newId = () => globalThis.crypto.randomUUID()

/** Pure: build a brand-new moment. `nowMs` and `deliveryDay` are injected so this stays testable. */
export function newMoment({ day, stampNo, nowMs, deliveryDay = 1, fields = {} }) {
  const moment = {
    id: newId(),
    day,
    stampNo,
    note: '',
    city: null,
    lat: null,
    lon: null,
    songTitle: null,
    songArtist: null,
    songSource: null,
    palette: BLANK_PALETTE,
    paletteSource: 'moment',
    feeling: null,
    topic: null,
    sealedUntil: sealedUntilFor(day, deliveryDay),
    openedAt: null,
    sealedAt: null,
    createdAt: nowMs,
    updatedAt: nowMs,
  }
  return applyFields(moment, fields)
}

/** Copy only whitelisted fields, so a caller can never overwrite id, day, stampNo, or seal times. */
export function applyFields(moment, fields) {
  const next = { ...moment }
  for (const key of EDITABLE_FIELDS) {
    if (key in fields) next[key] = fields[key]
  }
  if (next.palette.length !== 5) throw new Error('A moment needs exactly 5 palette colors')
  return next
}
