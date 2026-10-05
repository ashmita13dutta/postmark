import { NavLink } from 'react-router-dom'
import { AlbumIcon, CalendarIcon, MailboxIcon, TodayIcon, YouIcon } from './icons'
import './tabbar.css'

const TABS = [
  { to: '/', label: 'Today', Icon: TodayIcon },
  { to: '/calendar', label: 'Calendar', Icon: CalendarIcon },
  { to: '/mailbox', label: 'Mailbox', Icon: MailboxIcon },
  { to: '/album', label: 'Album', Icon: AlbumIcon },
  { to: '/you', label: 'You', Icon: YouIcon },
]

export default function TabBar() {
  return (
    <nav className="tabbar" aria-label="Main">
      {TABS.map(({ to, label, Icon }) => (
        <NavLink key={to} to={to} end={to === '/'} className="tab">
          <Icon />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
