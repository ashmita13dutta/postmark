// Tab icons, copied from the mockup (24x24, 1.6 stroke).
const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  width: 22,
  height: 22,
  'aria-hidden': true,
}

export const TodayIcon = () => (
  <svg {...base}>
    <rect x="4" y="6" width="16" height="14" rx="1.5" />
    <path d="M4 10h16M8 3v4M16 3v4" />
  </svg>
)

export const CalendarIcon = () => (
  <svg {...base}>
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M3 10h18M8 2v4M16 2v4" />
  </svg>
)

export const MailboxIcon = () => (
  <svg {...base}>
    <path d="M3 8l9 6 9-6" />
    <rect x="3" y="6" width="18" height="14" rx="1.5" />
  </svg>
)

export const AlbumIcon = () => (
  <svg {...base}>
    <rect x="3" y="4" width="18" height="16" rx="1.5" />
    <path d="M12 4v16M3 12h18" />
  </svg>
)

export const YouIcon = () => (
  <svg {...base}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
  </svg>
)
