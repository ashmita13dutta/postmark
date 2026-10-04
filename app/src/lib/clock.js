/**
 * The ONLY source of "now". Never call Date.now() or new Date() for the current
 * time anywhere else (ESLint enforces this). Supports time travel for testing:
 *   - URL:  ?now=2026-10-01T09:00   (parsed as local time; works with hash routing)
 *   - code: setNow(ms) / setNow(null)
 */
const KEY = 'postmark.now'
let override = null
const listeners = new Set()

/** Current time in epoch ms. */
export function now() {
  return override ?? Date.now()
}

/** Time-travel. Pass null to go back to the real clock. Persists for the browser session. */
export function setNow(ms) {
  override = ms
  try {
    if (ms === null) sessionStorage.removeItem(KEY)
    else sessionStorage.setItem(KEY, String(ms))
  } catch {
    /* storage unavailable: override lasts until reload */
  }
  listeners.forEach((fn) => fn(override))
}

/** The active override in ms, or null when running on the real clock. */
export function getOverride() {
  return override
}

/** Subscribe to override changes (for the dev panel). Returns an unsubscribe function. */
export function onClockChange(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** Read ?now= from the URL, else restore the session override. Call once at startup. */
export function initClockFromUrl(href = globalThis.location?.href ?? '') {
  const match = /[?&]now=([^&#]+)/.exec(href)
  if (match) {
    const ms = new Date(decodeURIComponent(match[1])).getTime()
    if (!Number.isNaN(ms)) override = ms
    return
  }
  try {
    const saved = sessionStorage.getItem(KEY)
    if (saved !== null) override = Number(saved)
  } catch {
    /* ignore */
  }
}
