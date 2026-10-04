import { afterEach, describe, expect, it, vi } from 'vitest'
import { getOverride, initClockFromUrl, now, onClockChange, setNow } from '../src/lib/clock'

afterEach(() => setNow(null))

describe('clock', () => {
  it('uses the real time without an override', () => {
    const before = Date.now()
    expect(now()).toBeGreaterThanOrEqual(before)
    expect(getOverride()).toBeNull()
  })

  it('setNow overrides and null restores', () => {
    setNow(1_000)
    expect(now()).toBe(1_000)
    setNow(null)
    expect(getOverride()).toBeNull()
  })

  it('parses ?now= as local time', () => {
    initClockFromUrl('https://x.test/?now=2026-10-01T09:00#/mailbox')
    expect(now()).toBe(new Date(2026, 9, 1, 9, 0).getTime())
  })

  it('works with the query inside a hash route', () => {
    initClockFromUrl('https://x.test/#/mailbox?now=2026-09-24T21:00')
    expect(now()).toBe(new Date(2026, 8, 24, 21, 0).getTime())
  })

  it('ignores an invalid ?now=', () => {
    initClockFromUrl('https://x.test/?now=nonsense')
    expect(getOverride()).toBeNull()
  })

  it('notifies subscribers and stops after unsubscribe', () => {
    const fn = vi.fn()
    const off = onClockChange(fn)
    setNow(5)
    off()
    setNow(6)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith(5)
  })
})
