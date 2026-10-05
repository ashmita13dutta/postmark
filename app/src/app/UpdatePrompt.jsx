import { useRegisterSW } from 'virtual:pwa-register/react'
import './update.css'

const HOUR = 60 * 60 * 1000

/**
 * "New version ready" banner. The service worker caches the whole app so it works offline, which
 * means a phone keeps showing the old version until it is told to switch. This shows a banner as
 * soon as a new version has downloaded, and re-checks for one every hour while the app is open.
 */
export default function UpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (registration) setInterval(() => registration.update(), HOUR)
    },
  })

  if (!needRefresh) return null

  return (
    <aside className="update" role="status">
      <div className="update__text">
        <strong>New version ready</strong>
        <span>Reload to get the latest Postmark.</span>
      </div>
      <button className="update__btn" onClick={() => updateServiceWorker(true)}>
        Reload
      </button>
    </aside>
  )
}
