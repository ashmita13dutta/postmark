import { Link } from 'react-router-dom'
import Screen from '../app/Screen'

export default function You() {
  return (
    <Screen caption="Postmaster" title="You">
      <p className="screen__note">Coming soon.</p>
      <p className="screen__note">
        <Link to="/palettes">Review palettes, color names and mood words</Link>
      </p>
    </Screen>
  )
}
