import { MODEL, headProbs } from './head'
import { readerSupported } from './support'

/**
 * The app's handle on the note reader (the on-device language model). One shared reader for the
 * whole app. States:
 *   idle         nothing started
 *   loading      downloading or opening the model (loaded/total are bytes)
 *   ready        classify() works
 *   error        something went wrong; startReader() tries again
 *   unsupported  this browser cannot run it; the built-in reading is used
 * Without the reader the app reads notes with the built-in keyword method, so it always works.
 */
let createWorker = () =>
  new Worker(new URL('./reader.worker.js', import.meta.url), { type: 'module' })

const IDLE = Object.freeze({ status: 'idle', loaded: 0, total: 0, error: null })
let state = IDLE
const listeners = new Set()

function setState(patch) {
  state = Object.freeze({ ...state, ...patch })
  listeners.forEach((l) => l())
}

export const getReaderState = () => state
export function subscribeReader(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

// If nothing at all arrives from the worker for this long while loading (no progress, no ready, no
// error), give up and say so, so the card can offer "Try again" instead of waiting forever.
export const STALL_MS = 180_000
let watchdog = null
const arm = () => {
  clearTimeout(watchdog)
  watchdog = setTimeout(() => fail('The reader is taking too long to start'), STALL_MS)
}

let worker = null
let starting = null
let settle = null // settles the pending startReader() promise
let nextId = 1
const waiting = new Map() // request id -> { resolve, reject }
const cache = new Map() // note text -> { vector, probs }
const CACHE_LIMIT = 40

function baseUrl() {
  return new URL(import.meta.env.BASE_URL, globalThis.location?.href ?? 'http://localhost/').href
}

/** Settle the start promise exactly once: true when the reader is ready, false when it is not. */
function finish(ok) {
  const done = settle
  settle = null
  done?.(ok)
}

function teardown() {
  clearTimeout(watchdog)
  worker?.terminate()
  worker = null
  starting = null
}

function fail(message) {
  for (const w of waiting.values()) w.reject(new Error(message))
  waiting.clear()
  teardown()
  setState({ status: 'error', error: message })
  finish(false)
}

/** Start loading the reader (safe to call again). Resolves true when ready, false if it could not. */
export function startReader() {
  if (starting) return starting
  if (state.status === 'ready') return Promise.resolve(true)
  if (!readerSupported()) {
    setState({ status: 'unsupported', error: null })
    return Promise.resolve(false)
  }
  setState({ status: 'loading', loaded: 0, total: 0, error: null })
  const promise = new Promise((resolve) => {
    settle = resolve
  })
  starting = promise
  try {
    worker = createWorker()
  } catch (err) {
    fail(err.message)
    return promise
  }
  worker.onmessage = (event) => {
    const m = event.data
    if (m.type === 'progress') {
      arm()
      setState({ loaded: m.loaded, total: m.total })
    } else if (m.type === 'ready') {
      clearTimeout(watchdog)
      setState({ status: 'ready', error: null })
      finish(true)
    } else if (m.type === 'vector') {
      waiting.get(m.id)?.resolve(m.vector)
      waiting.delete(m.id)
    } else if (m.type === 'failed') {
      if (m.id != null) {
        waiting.get(m.id)?.reject(new Error(m.message))
        waiting.delete(m.id)
      } else {
        fail(m.message)
      }
    }
  }
  worker.onerror = (event) => fail(event.message || 'The reader stopped unexpectedly')
  worker.postMessage({ type: 'load', base: baseUrl(), model: MODEL })
  arm()
  return promise
}

/** Stop the reader and free its memory (the downloaded model stays cached for next time). */
export function stopReader() {
  for (const w of waiting.values()) w.reject(new Error('The reader was turned off'))
  waiting.clear()
  teardown()
  setState({ ...IDLE })
  finish(false)
}

function embed(text) {
  return new Promise((resolve, reject) => {
    const id = nextId++
    waiting.set(id, { resolve, reject })
    worker.postMessage({ type: 'embed', id, text })
  })
}

/**
 * Read a note: { vector, probs } (the embedding and a probability for each feeling), or null when
 * the reader is not ready or the note is empty. Same note, same answer, instantly the second time.
 */
export async function classify(text) {
  const note = (text ?? '').trim()
  if (!note || state.status !== 'ready') return null
  const hit = cache.get(note)
  if (hit) return hit
  const vector = Array.from(await embed(note))
  const result = { vector, probs: headProbs(vector) }
  cache.set(note, result)
  if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value)
  return result
}

/** For tests only: swap how the worker is created and forget everything. */
export function configureReaderForTests({ createWorker: make } = {}) {
  if (make) createWorker = make
  teardown()
  waiting.clear()
  cache.clear()
  settle = null
  state = IDLE
  listeners.forEach((l) => l())
}
