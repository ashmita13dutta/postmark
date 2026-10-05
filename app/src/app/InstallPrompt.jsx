import { useInstallPrompt } from '../lib/install'
import './install.css'

export default function InstallPrompt() {
  const prompt = useInstallPrompt()
  if (!prompt) return null

  return (
    <aside className="install" role="region" aria-label="Install Postmark">
      <div className="install__text">
        <strong>Keep Postmark on your phone</strong>
        {prompt.kind === 'ios' ? (
          <span>
            Tap <b>Share</b>, then <b>Add to Home Screen</b>. This also keeps your stamps safe from
            being cleared by Safari.
          </span>
        ) : (
          <span>Install it to open offline and keep your stamps safe.</span>
        )}
      </div>
      {prompt.kind === 'android' && (
        <button className="install__btn" onClick={prompt.install}>
          Install
        </button>
      )}
      <button className="install__x" onClick={prompt.dismiss} aria-label="Dismiss">
        ×
      </button>
    </aside>
  )
}
