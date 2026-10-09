// Runs the note reader's language model in a web worker, so loading it (a few seconds of work on a
// phone) and reading a note never freeze the screen. Talks to ./client.js by messages:
//
//   in   { type: 'load', base, model }          start loading (base = the app's URL)
//        { type: 'embed', id, text }            turn a note into 384 numbers
//   out  { type: 'progress', loaded, total }    bytes of the model downloaded so far
//        { type: 'ready' }
//        { type: 'vector', id, vector }         Float32Array, unit length
//        { type: 'failed', id?, message }
//
// Everything the model needs is served by the app itself: the model files from /models/ and the
// WebAssembly runtime from the build. The first time, the files are downloaded and kept in the
// browser's cache; after that the reader loads from the cache, with no network at all.
import { env, pipeline } from '@huggingface/transformers'
import wasmUrl from 'onnxruntime-web/ort-wasm-simd-threaded.wasm?url'
import { makeGuardedFetch } from './guard'
import mjsUrl from 'onnxruntime-web/ort-wasm-simd-threaded.mjs?url'

let extractor = null
let settings = null
// one note at a time: the runtime cannot run two at once
let queue = Promise.resolve()

function configure(base) {
  env.allowLocalModels = true
  env.allowRemoteModels = false // never reach for a model on the internet
  env.useBrowserCache = true // keep the downloaded model for offline use
  // a missing file must never be cached as a web page (see guard.js)
  env.fetch = makeGuardedFetch(env.fetch)
  // a root-relative path: the library only looks for local files when given one (not a full URL)
  env.localModelPath = new URL('models/', base).pathname
  env.backends.onnx.wasm.wasmPaths = {
    mjs: new URL(mjsUrl, base).href,
    wasm: new URL(wasmUrl, base).href,
  }
  // threads need special page headers that static hosting cannot send
  env.backends.onnx.wasm.numThreads = 1
}

async function load({ base, model }) {
  settings = model
  configure(base)
  const files = new Map()
  let lastSent = 0
  // The browser does not always know a file's size while it downloads, so the total comes from the
  // manifest (model.bytes). No progress arrives at all when the files come from the cache.
  const expected = model.bytes ?? 0
  extractor = await pipeline('feature-extraction', model.id, {
    dtype: model.dtype,
    device: 'wasm',
    progress_callback: (p) => {
      if (p.status !== 'progress' || !p.total) return
      files.set(p.file, p.loaded)
      const t = performance.now()
      if (t - lastSent < 120) return
      lastSent = t
      let loaded = 0
      for (const bytes of files.values()) loaded += bytes
      const total = Math.max(expected, loaded)
      self.postMessage({ type: 'progress', loaded: Math.min(loaded, total), total })
    },
  })
  self.postMessage({ type: 'ready' })
}

async function embed({ id, text }) {
  const out = await extractor(settings.prefix + text, {
    pooling: settings.pooling,
    normalize: true,
  })
  const vector = Float32Array.from(out.data)
  self.postMessage({ type: 'vector', id, vector }, [vector.buffer])
}

self.onmessage = (event) => {
  const m = event.data
  if (m.type === 'load') {
    load(m).catch((err) => self.postMessage({ type: 'failed', message: describe(err) }))
  } else if (m.type === 'embed') {
    queue = queue
      .then(() => embed(m))
      .catch((err) => self.postMessage({ type: 'failed', id: m.id, message: describe(err) }))
  }
}

function describe(err) {
  return String((err && err.message) || err)
}
