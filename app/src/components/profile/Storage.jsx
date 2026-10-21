import { useEffect, useState } from 'react'
import { isIOS, isStandalone } from '../../lib/install'
import './profile.css'

/**
 * Whether the browser has agreed to keep your stamps. A site that is not installed can have its data
 * cleared by the browser, mostly on iPhone, so this asks it to keep them and says honestly what is
 * and is not guaranteed. A backup is the only real safety.
 */
export default function Storage() {
  // 'checking' | 'kept' | 'maybe' | 'unsupported'
  const [state, setState] = useState(() =>
    navigator.storage?.persisted ? 'checking' : 'unsupported',
  )
  const [asked, setAsked] = useState(false)

  useEffect(() => {
    let live = true
    navigator.storage?.persisted?.().then((yes) => live && setState(yes ? 'kept' : 'maybe'))
    return () => {
      live = false
    }
  }, [])

  async function ask() {
    setAsked(true)
    const yes = await navigator.storage?.persist?.().catch(() => false)
    setState(yes ? 'kept' : 'maybe')
  }

  const installed = isStandalone()
  return (
    <section className="prefs" aria-label="Keeping your stamps safe">
      <h2>Keeping your stamps safe</h2>
      <p className="prefs__intro">
        {state === 'kept' && 'The browser has agreed to keep your stamps on this phone.'}
        {state === 'maybe' &&
          'The browser has not promised to keep your stamps. It can clear them if the phone runs low on space.'}
        {state === 'unsupported' && 'This browser cannot promise to keep your stamps.'}
        {state === 'checking' && 'Checking…'}{' '}
        {!installed && isIOS()
          ? 'On iPhone, Share then Add to Home Screen makes this much safer.'
          : ''}{' '}
        Only a backup is a real guarantee.
      </p>
      {state === 'maybe' && !asked && navigator.storage?.persist && (
        <button className="prefs__action" onClick={ask}>
          Ask the browser to keep them
        </button>
      )}
      {state === 'maybe' && asked && (
        <p className="prefs__note">
          The browser said not yet. Installing the app to your Home Screen helps.
        </p>
      )}
    </section>
  )
}
