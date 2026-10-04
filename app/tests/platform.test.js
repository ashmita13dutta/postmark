import { afterEach, describe, expect, it, vi } from 'vitest'
import { haptic, notify, scheduleReminder, share } from '../src/lib/platform'

afterEach(() => vi.unstubAllGlobals())

describe('platform (PWA)', () => {
  it('haptic is a safe no-op without the vibration API', () => {
    vi.stubGlobal('navigator', {})
    expect(haptic('thump')).toBe(false)
  })

  it('haptic vibrates when supported', () => {
    const vibrate = vi.fn(() => true)
    vi.stubGlobal('navigator', { vibrate })
    expect(haptic('tap')).toBe(true)
    expect(vibrate).toHaveBeenCalledWith(10)
  })

  it('notify does nothing without permission', async () => {
    vi.stubGlobal('Notification', { permission: 'default' })
    expect(await notify('hi')).toBe(false)
  })

  it('scheduleReminder reports unsupported on the web', async () => {
    expect(await scheduleReminder()).toBe('unsupported')
  })

  it('share uses the native sheet when available', async () => {
    const nav = { share: vi.fn(async () => {}) }
    vi.stubGlobal('navigator', nav)
    expect(await share({ title: 't', text: 'x' })).toBe('shared')
  })

  it('share reports cancelled when the user dismisses', async () => {
    const nav = { share: vi.fn(async () => { throw Object.assign(new Error(), { name: 'AbortError' }) }) }
    vi.stubGlobal('navigator', nav)
    expect(await share({ text: 'x' })).toBe('cancelled')
  })

  it('share is unsupported with no share API and no files', async () => {
    vi.stubGlobal('navigator', {})
    expect(await share({ text: 'x' })).toBe('unsupported')
  })
})
