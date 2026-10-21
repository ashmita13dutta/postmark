import { Link } from 'react-router-dom'
import Screen from '../app/Screen'
import BackupCard from '../components/backup/BackupCard'
import Preferences from '../components/profile/Preferences'
import PostmasterCard from '../components/profile/PostmasterCard'
import Reminders from '../components/profile/Reminders'
import Storage from '../components/profile/Storage'
import DemoTools from '../components/demo/DemoTools'
import MyMoods from '../components/moods/MyMoods'
import ReaderSetting from '../components/reader/ReaderSetting'
import { versionLabel } from '../lib/version'

export default function You() {
  return (
    <Screen caption="Postmaster" title="You">
      <PostmasterCard />
      <Preferences />
      <Reminders />
      <BackupCard />
      <Storage />
      <ReaderSetting />
      <MyMoods />
      <DemoTools />
      <p className="screen__note">
        <Link to="/palettes">Review palettes, color names and mood words</Link>
      </p>
      <p className="screen__note">
        <Link to="/welcome">Show the welcome again</Link>
      </p>
      <p className="screen__version">
        {versionLabel()}
        <br />
        New versions arrive as a banner at the top: tap Reload.
      </p>
    </Screen>
  )
}
