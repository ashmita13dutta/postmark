import { describe, expect, it } from 'vitest'
import { BUILD, versionLabel } from '../src/lib/version'

describe('versionLabel', () => {
  it('shows the commit and the build date', () => {
    const label = versionLabel({ commit: 'abc1234', builtAt: '2026-10-09T12:28:00Z' }, 'en-GB')
    expect(label).toContain('abc1234')
    expect(label).toContain('Oct')
  })
  it('falls back to just the commit when the time is missing or broken', () => {
    expect(versionLabel({ commit: 'abc1234', builtAt: '' })).toBe('Version abc1234')
    expect(versionLabel({ commit: 'abc1234', builtAt: 'not a date' })).toBe('Version abc1234')
  })
  it('knows the running build', () => {
    expect(typeof BUILD.commit).toBe('string')
    expect(BUILD.commit.length).toBeGreaterThan(0)
  })
})
