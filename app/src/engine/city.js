/**
 * The city engine (spec 7.4), pure: work out which listed city a position is in, search the list by
 * name, and turn what someone typed into the name that goes on the postmark. No network and no
 * geocoding service: the list is data/cities.json.
 */
import cityData from '../data/cities.json'

const EARTH_KM = 6371

/** Straight-line distance over the earth's surface between two points, in kilometres. */
export function distanceKm(lat1, lon1, lat2, lon2) {
  const rad = (d) => (d * Math.PI) / 180
  const dLat = rad(lat2 - lat1)
  const dLon = rad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(a)))
}

/** Lowercase, no accents, no punctuation: "São  Paulo" and "sao paulo" are the same. */
export function normalize(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** The nearest listed city to a position within `maxKm`, as { city, km }, or null if none is near. */
export function nearestCity(lat, lon, cities = cityData.cities, maxKm = cityData.maxKm) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
  let best = null
  for (const city of cities) {
    const km = distanceKm(lat, lon, city.lat, city.lon)
    if (km <= maxKm && (!best || km < best.km)) best = { city, km }
  }
  return best
}

/** Every name a city goes by, normalized: its own and its aliases. */
const namesOf = (city) => [city.name, ...(city.aliases ?? [])].map(normalize)

/**
 * Cities matching what has been typed, best first: names that start with it, then names with a word
 * that starts with it, then names that contain it. Aliases count ("calcutta" finds Kolkata). At most
 * `limit`; nothing for an empty box.
 */
export function searchCities(query, cities = cityData.cities, limit = 6) {
  const q = normalize(query)
  if (!q) return []
  const scored = []
  cities.forEach((city, order) => {
    let best = 0
    for (const name of namesOf(city)) {
      if (name.startsWith(q)) best = Math.max(best, 3)
      else if (name.split(' ').some((w) => w.startsWith(q))) best = Math.max(best, 2)
      else if (name.includes(q)) best = Math.max(best, 1)
    }
    if (best) scored.push({ city, best, order })
  })
  return scored
    .sort((a, b) => b.best - a.best || a.order - b.order)
    .slice(0, limit)
    .map((s) => s.city)
}

/** The listed city a name means, ignoring case, accents and aliases, or null. */
export function findCity(name, cities = cityData.cities) {
  const q = normalize(name)
  if (!q) return null
  return cities.find((city) => namesOf(city).includes(q)) ?? null
}

/**
 * What to keep on a postcard for a place someone chose or typed: a listed city's own name (so
 * "Calcutta" becomes "Kolkata"), or the words as typed, tidied, up to 40 characters. null if empty.
 */
export function placeName(text) {
  const city = findCity(text)
  if (city) return city.name
  const clean = String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40)
  return clean || null
}

/** The sticker pack for a place, or null (no listed city, or no pack drawn for it yet). */
export const packFor = (name) => findCity(name)?.packId ?? null

/** Every name and alias, for a suggestions list (a datalist). */
export const cityNames = cityData.cities.flatMap((c) => [c.name, ...(c.aliases ?? [])])
