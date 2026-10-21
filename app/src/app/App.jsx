import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { HashRouter, Route, Routes, useNavigate } from 'react-router-dom'
import Onboarding from '../components/onboarding/Onboarding'
import { queries } from '../db/queries'
import { shouldOnboard } from '../lib/profile'
import Album from '../screens/Album'
import Calendar from '../screens/Calendar'
import DemoPostcard from '../screens/DemoPostcard'
import Mailbox from '../screens/Mailbox'
import Palettes from '../screens/Palettes'
import Postcard from '../screens/Postcard'
import Reveal from '../screens/Reveal'
import Today from '../screens/Today'
import You from '../screens/You'
import InstallPrompt from './InstallPrompt'
import TabBar from './TabBar'
import UpdatePrompt from './UpdatePrompt'

/** The welcome, on a brand-new install only (see shouldOnboard). */
function FirstRun() {
  const onboarded = useLiveQuery(() => queries.getSetting('onboarded'), [])
  const realStamps = useLiveQuery(
    async () => (await queries.allMoments()).filter((m) => m.demo !== true).length,
    [],
  )
  const [done, setDone] = useState(false)
  if (done || !shouldOnboard({ onboarded, realStamps })) return null
  return <Onboarding onDone={() => setDone(true)} />
}

/** The welcome again, from You, for anyone who wants to see it. */
function Welcome() {
  const navigate = useNavigate()
  return <Onboarding onDone={() => navigate('/you')} />
}

// Hash routing: works on any static host (GitHub Pages) with no server rewrites, and
// keeps ?now= time travel working.
export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Today />} />
        <Route path="/reveal" element={<Reveal />} />
        <Route path="/postcard" element={<Postcard />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/mailbox" element={<Mailbox />} />
        <Route path="/album" element={<Album />} />
        <Route path="/you" element={<You />} />
        <Route path="/welcome" element={<Welcome />} />
        <Route path="/you/demo" element={<DemoPostcard />} />
        <Route path="/you/demo/:id" element={<DemoPostcard />} />
        <Route path="/you/demo/:id/stickers" element={<Postcard />} />
        <Route path="/palettes" element={<Palettes />} />
        <Route path="*" element={<Today />} />
      </Routes>
      <FirstRun />
      <UpdatePrompt />
      <InstallPrompt />
      <TabBar />
    </HashRouter>
  )
}
