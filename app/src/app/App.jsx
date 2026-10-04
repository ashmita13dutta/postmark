import { now, getOverride } from '../lib/clock'

// Phase 0 placeholder: proves the build, clock and deploy work. Replaced in Phase 1.
export default function App() {
  const travelling = getOverride() !== null
  return (
    <main className="shell">
      <h1>Postmark</h1>
      <p>Every day becomes a stamp.</p>
      <p className="mono">
        {new Date(now()).toLocaleString()}
        {travelling ? ' (time travel)' : ''}
      </p>
    </main>
  )
}
