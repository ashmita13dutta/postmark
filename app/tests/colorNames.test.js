import { describe, expect, it } from 'vitest'
import palettes from '../src/data/palettes.json'
import { namePalette, nearestName } from '../src/engine/colorNames'

describe('nearestName', () => {
  it('returns the exact name for a color in the bank', () => {
    expect(nearestName('#B14126')).toMatchObject({ name: 'Puja Red', distance: 0 })
    expect(nearestName('#E7C64B').name).toBe('Kadam Yellow')
  })

  it('finds a sensible neighbour for an unlisted color', () => {
    const near = nearestName('#B24427') // one step from Puja Red
    expect(near.name).toBe('Puja Red')
    expect(near.distance).toBeGreaterThan(0)
    expect(near.distance).toBeLessThan(0.02)
  })

  it('skips names that are already taken', () => {
    const second = nearestName('#B14126', new Set(['puja red']))
    expect(second.name).not.toBe('Puja Red')
  })
})

describe('namePalette', () => {
  it('names the design sample exactly as the mockup does', () => {
    const named = namePalette(['#3A5771', '#5B6470', '#B6C7D6', '#E7C64B', '#B14126'])
    expect(named.map((n) => n.name)).toEqual([
      'Wet Alley Blue',
      'Late Tram Grey',
      'Mizzle Mist',
      'Kadam Yellow',
      'Puja Red',
    ])
  })

  it('never repeats a name within a palette, for any of the 118 palettes', () => {
    for (const list of Object.values(palettes)) {
      for (const p of list) {
        const names = namePalette(p.colors).map((n) => n.name)
        expect(new Set(names).size, `${p.id}: ${names.join(', ')}`).toBe(5)
      }
    }
  })
})
