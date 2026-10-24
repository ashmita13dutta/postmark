import { describe, expect, it } from 'vitest'
import cityData from '../src/data/cities.json'
import { PACKS } from '../src/data/stickers'
import { yearStats } from '../src/lib/album'
import {
  cityNames,
  distanceKm,
  findCity,
  nearestCity,
  normalize,
  packFor,
  placeName,
  searchCities,
} from '../src/engine/city'

const { cities } = cityData
const byName = (name) => cities.find((c) => c.name === name)

describe('the cities list', () => {
  it('is about 150 cities, Kolkata first', () => {
    expect(cities.length).toBeGreaterThanOrEqual(140)
    expect(cities.length).toBeLessThanOrEqual(180)
    expect(cities[0].name).toBe('Kolkata')
  })

  it('has real positions and no repeated names', () => {
    const seen = new Set()
    for (const c of cities) {
      expect(c.name, c.name).toBeTruthy()
      expect(c.country, c.name).toBeTruthy()
      expect(c.lat).toBeGreaterThanOrEqual(-90)
      expect(c.lat).toBeLessThanOrEqual(90)
      expect(c.lon).toBeGreaterThanOrEqual(-180)
      expect(c.lon).toBeLessThanOrEqual(180)
      for (const name of [c.name, ...(c.aliases ?? [])]) {
        const key = normalize(name)
        expect(seen.has(key), `${name} appears twice`).toBe(false)
        seen.add(key)
      }
    }
  })

  it('fits on a postmark: names are short enough to read', () => {
    for (const c of cities) expect(c.name.length, c.name).toBeLessThanOrEqual(20)
  })

  it('points packId only at sticker packs that exist (none are drawn yet)', () => {
    const packs = new Set(PACKS.map((p) => p.id))
    for (const c of cities) expect(c.packId === null || packs.has(c.packId), c.name).toBe(true)
  })

  it('places a few well known cities where they are', () => {
    // known distances, to within a few percent
    const d = (a, b) => distanceKm(byName(a).lat, byName(a).lon, byName(b).lat, byName(b).lon)
    expect(d('Kolkata', 'Delhi')).toBeGreaterThan(1280)
    expect(d('Kolkata', 'Delhi')).toBeLessThan(1330)
    expect(d('London', 'Paris')).toBeGreaterThan(330)
    expect(d('London', 'Paris')).toBeLessThan(355)
    expect(d('Sydney', 'Melbourne')).toBeGreaterThan(700)
    expect(d('Sydney', 'Melbourne')).toBeLessThan(730)
    expect(d('New York', 'Los Angeles')).toBeGreaterThan(3900)
    expect(d('New York', 'Los Angeles')).toBeLessThan(3990)
  })
})

describe('nearestCity', () => {
  it('finds the city a position is in', () => {
    expect(nearestCity(22.5726, 88.3639).city.name).toBe('Kolkata')
    expect(nearestCity(22.5726, 88.3639).km).toBeLessThan(2)
    // a position in the suburbs of Mumbai
    expect(nearestCity(19.12, 72.85).city.name).toBe('Mumbai')
  })

  it('picks the closer of two near cities', () => {
    // Siliguri is about 60 km from Darjeeling's hills; a point beside Siliguri is Siliguri
    expect(nearestCity(26.7, 88.4).city.name).toBe('Siliguri')
  })

  it('says nothing when no listed city is near', () => {
    expect(nearestCity(0, -30)).toBeNull() // the middle of the Atlantic
    expect(nearestCity(22.57, 89.9)).toBeNull() // the Sundarbans coast, 150 km from Kolkata
  })

  it('respects the distance it is given', () => {
    expect(nearestCity(22.57, 89.9, cities, 300)?.city.name).toBe('Dhaka') // 150 km away, Kolkata is 158
  })

  it('ignores a position that is not a number', () => {
    expect(nearestCity(NaN, 88)).toBeNull()
    expect(nearestCity(undefined, undefined)).toBeNull()
  })
})

describe('searchCities', () => {
  it('finds by the start of a name, best matches first', () => {
    const found = searchCities('ko').map((c) => c.name)
    expect(found[0]).toBe('Kolkata')
    expect(found).toContain('Kochi')
  })

  it('finds by other names', () => {
    expect(searchCities('calcutta')[0].name).toBe('Kolkata')
    expect(searchCities('bangalore')[0].name).toBe('Bengaluru')
    expect(searchCities('bombay')[0].name).toBe('Mumbai')
  })

  it('does not mind accents, capitals or extra spaces', () => {
    expect(searchCities('  SAO paulo ')[0].name).toBe('Sao Paulo')
    expect(searchCities('São')[0].name).toBe('Sao Paulo')
  })

  it('finds a later word in a name', () => {
    expect(searchCities('york')[0].name).toBe('New York')
  })

  it('gives nothing for an empty box or no match, and caps the list', () => {
    expect(searchCities('')).toEqual([])
    expect(searchCities('   ')).toEqual([])
    expect(searchCities('zzzzzz')).toEqual([])
    expect(searchCities('a', cities, 4)).toHaveLength(4)
  })
})

describe('findCity and placeName', () => {
  it('turn any name for a city into its own', () => {
    expect(findCity('Calcutta').name).toBe('Kolkata')
    expect(placeName('  calcutta ')).toBe('Kolkata')
    expect(placeName('Madras')).toBe('Chennai')
  })

  it('keeps a place that is not listed, tidied', () => {
    expect(placeName('  Bolpur   Road  ')).toBe('Bolpur Road')
    expect(placeName('x'.repeat(60))).toHaveLength(40)
  })

  it('has nothing for an empty place', () => {
    expect(placeName('')).toBeNull()
    expect(placeName('   ')).toBeNull()
    expect(placeName(null)).toBeNull()
  })

  it('knows no sticker pack for any city yet', () => {
    expect(packFor('Kolkata')).toBeNull()
    expect(packFor('Nowhere')).toBeNull()
  })

  it('offers every name and alias as a suggestion', () => {
    expect(cityNames).toContain('Kolkata')
    expect(cityNames).toContain('Calcutta')
  })
})

describe('cities in the year so far', () => {
  const stamp = (day, city) => ({ day, city, palette: [], feeling: null, topic: null })

  it('counts places however they were typed, and names the most common', () => {
    const moments = [
      stamp('2026-03-01', 'Kolkata'),
      stamp('2026-03-02', ' kolkata '),
      stamp('2026-03-03', 'Kolkata'),
      stamp('2026-03-04', 'Delhi'),
      stamp('2026-03-05', null),
      stamp('2025-12-31', 'Paris'), // another year
    ]
    const s = yearStats(2026, moments, '2026-03-10')
    expect(s.cities).toBe(2)
    expect(s.topCity).toEqual({ id: 'Kolkata', count: 3 })
  })

  it('has none when no stamp has a place', () => {
    const s = yearStats(2026, [stamp('2026-03-01', null)], '2026-03-10')
    expect(s.cities).toBe(0)
    expect(s.topCity).toBeNull()
  })
})
