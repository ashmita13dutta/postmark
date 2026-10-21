import { defineConfig } from 'vitest/config'

// Date logic must not depend on the machine: pin the zone before workers start.
// `npm run test:tz` sets TZ itself to check daylight-saving zones.
process.env.TZ ||= 'Asia/Kolkata'

export default defineConfig({
  // drawing every tape and doodle with resvg takes a few seconds, and more when the whole suite runs at once
  test: { environment: 'node', include: ['tests/**/*.test.js'], testTimeout: 20000 },
})
