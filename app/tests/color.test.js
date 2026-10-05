import { describe, expect, it } from 'vitest'
import {
  chroma,
  hexDistance,
  hexToOklab,
  hexToRgb,
  hue,
  oklabToHex,
  rgbToHex,
} from '../src/lib/color'

describe('hex <-> rgb', () => {
  it('round-trips', () => {
    expect(hexToRgb('#3A5771')).toEqual([58, 87, 113])
    expect(rgbToHex([58, 87, 113])).toBe('#3A5771')
  })

  it('accepts no # and clamps out-of-range values', () => {
    expect(hexToRgb('b14126')).toEqual([177, 65, 38])
    expect(rgbToHex([300, -5, 12.4])).toBe('#FF000C')
  })

  it('rejects bad input', () => {
    expect(() => hexToRgb('#12345')).toThrow('Invalid hex')
    expect(() => hexToRgb('red')).toThrow()
  })
})

describe('OKLab', () => {
  it('black is L 0 and white is L 1 with no chroma', () => {
    expect(hexToOklab('#000000').L).toBeCloseTo(0, 3)
    const white = hexToOklab('#FFFFFF')
    expect(white.L).toBeCloseTo(1, 3)
    expect(chroma(white)).toBeLessThan(0.001)
  })

  it('round-trips through OKLab', () => {
    for (const hex of ['#3A5771', '#E7C64B', '#B14126', '#F4EFE6', '#534AB7']) {
      expect(oklabToHex(hexToOklab(hex))).toBe(hex)
    }
  })

  it('distance is zero for the same color, symmetric, and grows with difference', () => {
    expect(hexDistance('#3A5771', '#3A5771')).toBe(0)
    expect(hexDistance('#3A5771', '#E7C64B')).toBeCloseTo(hexDistance('#E7C64B', '#3A5771'), 10)
    expect(hexDistance('#3A5771', '#3B5872')).toBeLessThan(hexDistance('#3A5771', '#5B6470'))
    expect(hexDistance('#000000', '#FFFFFF')).toBeCloseTo(1, 2)
  })

  it('hue places red, yellow, green, blue in order', () => {
    const h = (hex) => hue(hexToOklab(hex))
    expect(h('#D2321E')).toBeLessThan(h('#E7C64B')) // red < yellow
    expect(h('#E7C64B')).toBeLessThan(h('#4F8F5A')) // yellow < green
    expect(h('#4F8F5A')).toBeLessThan(h('#3A5771')) // green < blue
  })
})
