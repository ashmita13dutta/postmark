import { Link } from 'react-router-dom'
import Screen from '../app/Screen'
import { versionLabel } from '../lib/version'

export default function You() {
  return (
    <Screen caption="Postmaster" title="You">
      <p className="screen__note">Coming soon.</p>
      <p className="screen__note">
        <Link to="/palettes">Review palettes, color names and mood words</Link>
      </p>
      <p className="screen__version">
        {versionLabel()}
        <br />
        New versions arrive as a banner at the top: tap Reload.
      </p>
    </Screen>
  )
}
