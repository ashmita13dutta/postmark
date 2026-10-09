// A tiny WebAssembly module that uses a SIMD instruction. The model runtime needs SIMD, which every
// current phone browser has (Safari from 16.4, Chrome and Firefox for years). Older ones simply
// keep the built-in note reading.
const SIMD_PROBE = new Uint8Array([
  0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15,
  253, 98, 11,
])

export function wasmSimdSupported() {
  try {
    return typeof WebAssembly === 'object' && WebAssembly.validate(SIMD_PROBE)
  } catch {
    return false
  }
}

/** Can this browser run the on-device reader at all? */
export function readerSupported() {
  return typeof Worker !== 'undefined' && wasmSimdSupported()
}
