/** Seeded randomness: same input, same result, so tilt/layout never change between renders. */
export function hashString(s) {
  let h = 2166136261 >>> 0
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function seededRng(key) {
  return mulberry32(hashString(key))
}

/** Stable tilt in degrees for a stamp, derived from its key (e.g. the day). Range ±maxDeg. */
export function stampTilt(key, maxDeg = 3) {
  return (seededRng(`tilt:${key}`)() * 2 - 1) * maxDeg
}
