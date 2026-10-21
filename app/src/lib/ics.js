/**
 * Reminder files (.ics). A web app cannot fire a notification while it is closed without a server,
 * so reminders are calendar events your phone's own Calendar app repeats for you: one on the day
 * your postcards arrive each month, and one every day at the time you choose. Pure: the caller gives
 * the day and time (from lib/clock.js), so it is easy to test. `platform.scheduleReminder` can later
 * swap these for real local notifications in a native build.
 */
import { addMonths, clampDeliveryDay, monthKey, parseDay } from './dates'

const pad = (n) => String(n).padStart(2, '0')
const CRLF = String.fromCharCode(13, 10)
const BACKSLASH = String.fromCharCode(92)

/** Escape text for an .ics value: backslash, semicolon, comma and new lines. */
export function escapeText(s) {
  return String(s)
    .split(BACKSLASH)
    .join(BACKSLASH + BACKSLASH)
    .split(';')
    .join(BACKSLASH + ';')
    .split(',')
    .join(BACKSLASH + ',')
    .split(String.fromCharCode(10))
    .join(BACKSLASH + 'n')
}

/** A line folded at 75 bytes, as the format asks: the rest continues on lines starting with a space. */
export function fold(line) {
  const bytes = new TextEncoder()
  const out = []
  let current = ''
  let size = 0
  for (const ch of line) {
    const n = bytes.encode(ch).length
    // a continuation line starts with one space, so it has one byte less for text
    const limit = out.length === 0 ? 75 : 74
    if (size + n > limit) {
      out.push(current)
      current = ''
      size = 0
    }
    current += ch
    size += n
  }
  out.push(current)
  return out.map((l, i) => (i === 0 ? l : ' ' + l)).join(CRLF)
}

/** 'HH:MM' as [h, m], or null when it is not a time. */
export function parseTime(time) {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time ?? '')
  return m ? [Number(m[1]), Number(m[2])] : null
}

function calendar(events, nowMs) {
  const d = new Date(nowMs)
  const stamp = `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Postmark//Reminders//EN',
    'CALSCALE:GREGORIAN',
  ]
  for (const e of events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.uid}@postmark`,
      `DTSTAMP:${stamp}`,
      // no time zone: "floating", so it happens at that time wherever the phone is
      `DTSTART:${e.start}`,
      `RRULE:${e.rrule}`,
      `SUMMARY:${escapeText(e.summary)}`,
      `DESCRIPTION:${escapeText(e.description)}`,
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeText(e.summary)}`,
      'TRIGGER:PT0S',
      'END:VALARM',
      'END:VEVENT',
    )
  }
  lines.push('END:VCALENDAR')
  return lines.map(fold).join(CRLF) + CRLF
}

/**
 * "Your Postmark mail has arrived", every month on the delivery day (1 to 28) at `time`, starting
 * with the next one on or after `today`.
 */
export function deliveryReminder({ deliveryDay, today, time = '09:00', nowMs }) {
  const day = clampDeliveryDay(deliveryDay)
  const at = parseTime(time) ?? [9, 0]
  const { d } = parseDay(today)
  const month = d <= day ? monthKey(today) : addMonths(monthKey(today), 1)
  const start = `${month.replace('-', '')}${pad(day)}T${pad(at[0])}${pad(at[1])}00`
  return calendar(
    [
      {
        uid: `delivery-${day}`,
        start,
        rrule: `FREQ=MONTHLY;BYMONTHDAY=${day}`,
        summary: 'Your Postmark mail has arrived',
        description: 'Last month’s postcards are ready to open in the Mailbox.',
      },
    ],
    nowMs,
  )
}

/** "Stamp your day", every day at `time` ('HH:MM'), starting `today`. Throws on a bad time. */
export function dailyReminder({ time, today, nowMs }) {
  const at = parseTime(time)
  if (!at) throw new Error('Pick a time first.')
  const { y, m, d } = parseDay(today)
  return calendar(
    [
      {
        uid: `daily-${pad(at[0])}${pad(at[1])}`,
        start: `${y}${pad(m)}${pad(d)}T${pad(at[0])}${pad(at[1])}00`,
        rrule: 'FREQ=DAILY',
        summary: 'Stamp your day',
        description: 'One note, one stamp. Open Postmark and make today’s.',
      },
    ],
    nowMs,
  )
}
