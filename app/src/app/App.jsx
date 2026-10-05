import { HashRouter, Route, Routes } from 'react-router-dom'
import Album from '../screens/Album'
import Calendar from '../screens/Calendar'
import Mailbox from '../screens/Mailbox'
import Today from '../screens/Today'
import You from '../screens/You'
import InstallPrompt from './InstallPrompt'
import TabBar from './TabBar'

// Hash routing: works on any static host (GitHub Pages) with no server rewrites, and
// keeps ?now= time travel working.
export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Today />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/mailbox" element={<Mailbox />} />
        <Route path="/album" element={<Album />} />
        <Route path="/you" element={<You />} />
        <Route path="*" element={<Today />} />
      </Routes>
      <InstallPrompt />
      <TabBar />
    </HashRouter>
  )
}
