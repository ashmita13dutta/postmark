import { describe, expect, it } from 'vitest'
import { dailyReminder, deliveryReminder, escapeText, fold, parseTime } from '../src/lib/ics'

const NOW = Date.UTC(2026, 9, 21, 8, 30, 15)
const CRLF = String.fromCharCode(13, 10)
const lines = (ics) => ics.split(CRLF)
/** The lines with folded continuations joined back, as a calendar app reads them. */
const unfolded = (ics) =>
  ics
    .split(CRLF + ' ')
    .join('')
    .split(CRLF)
const get = (ics, key) => unfolded(ics).find((l) => l.startsWith(`${key}:`))

describe('parseTime', () => {
  it('reads HH:MM', () => {
    expect(parseTime('09:00')).toEqual([9, 0])
    expect(parseTime('23:59')).toEqual([23, 59])
    expect(parseTime('00:00')).toEqual([0, 0])
  })
  it('refuses anything else', () => {
    for (const bad of ['9:00', '24:00', '12:60', '', null, undefined, 'noon', '12:5'])
      expect(parseTime(bad)).toBeNull()
  })
})

describe('escapeText', () => {
  it('escapes what the format reserves', () => {
    const back = String.fromCharCode(92)
    expect(escapeText('a, b; c')).toBe(`a${back}, b${back}; c`)
    expect(escapeText(`line${String.fromCharCode(10)}two`)).toBe(`line${back}ntwo`)
    expect(escapeText(`a${back}b`)).toBe(`a${back}${back}b`)
  })
})

describe('fold', () => {
  it('leaves a short line alone', () => {
    expect(fold('SUMMARY:Hello')).toBe('SUMMARY:Hello')
  })
  it('breaks a long line at 75 bytes, continuing with a space', () => {
    const long = 'DESCRIPTION:' + 'word '.repeat(40)
    const parts = fold(long).split(CRLF)
    expect(parts.length).toBeGreaterThan(2)
    expect(new TextEncoder().encode(parts[0]).length).toBeLessThanOrEqual(75)
    for (const p of parts.slice(1)) {
      expect(p.startsWith(' ')).toBe(true)
      expect(new TextEncoder().encode(p).length).toBeLessThanOrEqual(75)
    }
    expect(parts.join('').split(' ').join('')).toBe(long.split(' ').join(''))
  })
  it('never splits a letter in the middle', () => {
    const accents = 'SUMMARY:' + 'é'.repeat(60)
    const joined = fold(accents)
      .split(CRLF + ' ')
      .join('')
    expect(joined).toBe(accents)
  })
})

describe('deliveryReminder', () => {
  const make = (extra) =>
    deliveryReminder({ deliveryDay: 1, today: '2026-10-21', nowMs: NOW, ...extra })

  it('is a valid calendar with one monthly event', () => {
    const ics = make()
    const l = lines(ics)
    expect(l[0]).toBe('BEGIN:VCALENDAR')
    expect(l[l.length - 2]).toBe('END:VCALENDAR')
    expect(l[l.length - 1]).toBe('') // ends with a line break
    expect(ics.includes(String.fromCharCode(10))).toBe(true)
    expect(ics.split(CRLF).join('').includes(String.fromCharCode(10))).toBe(false) // only CRLF
    expect(l.filter((x) => x === 'BEGIN:VEVENT')).toHaveLength(1)
    expect(get(ics, 'VERSION')).toBe('VERSION:2.0')
    expect(get(ics, 'RRULE')).toBe('RRULE:FREQ=MONTHLY;BYMONTHDAY=1')
    expect(get(ics, 'SUMMARY')).toBe('SUMMARY:Your Postmark mail has arrived')
    expect(get(ics, 'DTSTAMP')).toBe('DTSTAMP:20261021T083015Z')
  })

  it('starts on the next delivery day, at the chosen time', () => {
    expect(get(make(), 'DTSTART')).toBe('DTSTART:20261101T090000')
    expect(get(make({ time: '18:30' }), 'DTSTART')).toBe('DTSTART:20261101T183000')
    expect(get(make({ deliveryDay: 25 }), 'DTSTART')).toBe('DTSTART:20261025T090000') // later this month
    expect(get(make({ deliveryDay: 21 }), 'DTSTART')).toBe('DTSTART:20261021T090000') // today counts
    expect(get(make({ today: '2026-12-20' }), 'DTSTART')).toBe('DTSTART:20270101T090000')
  })

  it('keeps the delivery day between 1 and 28, like the app', () => {
    expect(get(make({ deliveryDay: 31 }), 'RRULE')).toBe('RRULE:FREQ=MONTHLY;BYMONTHDAY=28')
    expect(get(make({ deliveryDay: 0 }), 'RRULE')).toBe('RRULE:FREQ=MONTHLY;BYMONTHDAY=1')
  })

  it('falls back to 9 o’clock for a bad time', () => {
    expect(get(make({ time: 'late' }), 'DTSTART')).toBe('DTSTART:20261101T090000')
  })

  it('has a display alarm at the start time', () => {
    const l = lines(make())
    expect(l).toContain('BEGIN:VALARM')
    expect(l).toContain('TRIGGER:PT0S')
    expect(l).toContain('ACTION:DISPLAY')
  })

  it('has no time zone, so it happens at that time wherever the phone is', () => {
    expect(make().includes('TZID')).toBe(false)
    expect(get(make(), 'DTSTART').endsWith('Z')).toBe(false)
  })

  it('keeps every line within 75 bytes', () => {
    for (const line of lines(make()))
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75)
  })
})

describe('dailyReminder', () => {
  it('repeats every day at the chosen time', () => {
    const ics = dailyReminder({ time: '21:15', today: '2026-10-21', nowMs: NOW })
    expect(get(ics, 'DTSTART')).toBe('DTSTART:20261021T211500')
    expect(get(ics, 'RRULE')).toBe('RRULE:FREQ=DAILY')
    expect(get(ics, 'SUMMARY')).toBe('SUMMARY:Stamp your day')
    expect(get(ics, 'UID')).toBe('UID:daily-2115@postmark')
  })

  it('needs a real time', () => {
    expect(() => dailyReminder({ time: '', today: '2026-10-21', nowMs: NOW })).toThrow(/time/)
    expect(() => dailyReminder({ time: '25:00', today: '2026-10-21', nowMs: NOW })).toThrow(/time/)
  })
})
