/**
 * Install-to-home-screen helpers. iOS Safari can evict site data for sites that are not
 * installed, so the app nudges people to install (CLAUDE spec section 11).
 */
import { useEffect, useState } from 'react'

const DISMISS_KEY = 'postmark.installDismissed'

export function isStandalone(win = globalThis) {
  return (
    win.matchMedia?.('(display-mode: standalone)')?.matches === true ||
    win.navigator?.standalone === true
  )
}

export function isIOS(ua = globalThis.navigator?.userAgent ?? '') {
  // iPadOS 13+ reports as Mac; touch support gives it away.
  const iPadOS = /Macintosh/.test(ua) && (globalThis.navigator?.maxTouchPoints ?? 0) > 1
  return /iPhone|iPad|iPod/.test(ua) || iPadOS
}

function wasDismissed() {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * Returns what to show:
 *   { kind: 'android', install() }   a native prompt is available
 *   { kind: 'ios' }                  show "Share, Add to Home Screen" steps
 *   null                             already installed, dismissed, or not applicable
 */
export function useInstallPrompt() {
  const [deferred, setDeferred] = useState(null)
  const [dismissed, setDismissed] = useState(wasDismissed)
  const [installed, setInstalled] = useState(() => isStandalone())

  useEffect(() => {
    const onPrompt = (e) => {
      e.preventDefault() // keep the event so we can show our own button
      setDeferred(e)
    }
    const onInstalled = () => setInstalled(true)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const dismiss = () => {
    setDismissed(true)
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      /* ignore */
    }
  }

  if (installed || dismissed) return null

  if (deferred) {
    return {
      kind: 'android',
      dismiss,
      install: async () => {
        deferred.prompt()
        await deferred.userChoice
        setDeferred(null)
      },
    }
  }
  if (isIOS()) return { kind: 'ios', dismiss }
  return null
}
