/** What the decorate tray offers. Ids are stored on a decoration as `stickerId`. */
export const TRAY_TABS = [
  { id: 'stamps', label: 'Stamps' },
  { id: 'tape', label: 'Tape' },
  { id: 'doodles', label: 'Doodles' },
]

export const STICKERS = {
  stamps: [
    { id: 'stamp:fragile', label: 'Fragile' },
    { id: 'stamp:urgent', label: 'Urgent' },
    { id: 'stamp:handle', label: 'Handle with care' },
    { id: 'stamp:return', label: 'Return to sender' },
  ],
  // tape takes its color from the day's palette: tape:0 is the first swatch, and so on
  tape: [0, 1, 2, 3, 4].map((i) => ({ id: `tape:${i}`, label: `Tape ${i + 1}` })),
  doodles: [
    { id: 'doodle:heart', label: 'Heart' },
    { id: 'doodle:star', label: 'Star' },
    { id: 'doodle:sun', label: 'Sun' },
    { id: 'doodle:moon', label: 'Moon' },
    { id: 'doodle:flower', label: 'Flower' },
    { id: 'doodle:cloud', label: 'Cloud' },
    { id: 'doodle:squiggle', label: 'Squiggle' },
    { id: 'doodle:arrow', label: 'Arrow' },
  ],
}

export const WAX_COLORS = [
  { hex: '#B14126', name: 'Puja red' },
  { hex: '#3A5771', name: 'Wet alley blue' },
  { hex: '#3F6B4A', name: 'Banyan green' },
  { hex: '#6B3F6B', name: 'Jamun plum' },
  { hex: '#B8902B', name: 'Zari gold' },
]

export const WAX_EMBLEMS = [
  { id: 'heart', label: 'Heart' },
  { id: 'star', label: 'Star' },
  { id: 'moon', label: 'Moon' },
  { id: 'initial', label: 'Initial' },
]
