/**
 * Everything device-specific goes through here, so a Capacitor build can later
 * replace these functions without touching screens. This is the PWA implementation.
 */

const VIBRATION = { tap: 10, thump: [20, 30, 40], success: [15, 40, 15], error: [40, 40, 40] }

/** Haptic feedback. No-op on iOS Safari (no vibration API). Returns true if it fired. */
export function haptic(kind = 'tap') {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return false
  return navigator.vibrate(VIBRATION[kind] ?? VIBRATION.tap)
}

/** Show a notification now, if permission was already granted. Returns true if shown. */
export async function notify(title, options = {}) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return false
  const reg = await navigator.serviceWorker?.getRegistration?.()
  if (reg) await reg.showNotification(title, options)
  else new Notification(title, options)
  return true
}

/**
 * Schedule a reminder. A web app cannot fire notifications while closed without a
 * server, so the PWA version reports 'unsupported'; callers fall back to an .ics
 * download (lib/ics.js, later phase). A Capacitor build will return 'scheduled'.
 */
export async function scheduleReminder() {
  return 'unsupported'
}

/**
 * Share text and/or files with the native share sheet, falling back to a download
 * for files. Returns 'shared' | 'downloaded' | 'cancelled' | 'unsupported'.
 */
export async function share({ title, text, files } = {}) {
  const data = { title, text }
  if (files?.length) data.files = files
  try {
    if (navigator.share && (!files?.length || navigator.canShare?.({ files }))) {
      await navigator.share(data)
      return 'shared'
    }
  } catch (err) {
    if (err?.name === 'AbortError') return 'cancelled'
  }
  if (files?.length) {
    for (const file of files) downloadBlob(file, file.name)
    return 'downloaded'
  }
  return 'unsupported'
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
