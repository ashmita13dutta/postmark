/**
 * Ask the phone where it is, once, when you tap "Use my location". Nothing is asked at start-up and
 * nothing is kept: the caller turns the position into a city name (engine/city.js) and forgets it.
 * Rejects with a plain sentence that can be shown as it is.
 */
export function currentPosition({ timeoutMs = 12_000 } = {}) {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('This phone cannot share its location here. Pick a city instead.'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      (err) =>
        reject(
          new Error(
            err.code === 1
              ? 'Location is switched off for Postmark. You can pick a city instead.'
              : err.code === 3
                ? 'That took too long. Try again, or pick a city instead.'
                : 'Could not find where you are. Pick a city instead.',
          ),
        ),
      { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 10 * 60 * 1000 },
    )
  })
}
