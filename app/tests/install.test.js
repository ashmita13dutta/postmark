import { afterEach, describe, expect, it, vi } from 'vitest'
import { isIOS, isStandalone } from '../src/lib/install'

afterEach(() => vi.unstubAllGlobals())

describe('isIOS', () => {
  it('detects iPhone Safari', () => {
    expect(
      isIOS('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15'),
    ).toBe(true)
  })

  it('detects iPadOS that reports as a Mac, via touch points', () => {
    vi.stubGlobal('navigator', { maxTouchPoints: 5 })
    expect(isIOS('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')).toBe(true)
  })

  it('does not flag a real Mac or Android', () => {
    vi.stubGlobal('navigator', { maxTouchPoints: 0 })
    expect(isIOS('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')).toBe(false)
    expect(isIOS('Mozilla/5.0 (Linux; Android 14; Pixel 8)')).toBe(false)
  })
})

describe('isStandalone', () => {
  it('is true in display-mode standalone', () => {
    expect(isStandalone({ matchMedia: () => ({ matches: true }), navigator: {} })).toBe(true)
  })

  it('is true for iOS home-screen apps', () => {
    expect(
      isStandalone({ matchMedia: () => ({ matches: false }), navigator: { standalone: true } }),
    ).toBe(true)
  })

  it('is false in a normal browser tab', () => {
    expect(isStandalone({ matchMedia: () => ({ matches: false }), navigator: {} })).toBe(false)
  })
})
