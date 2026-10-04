import { defineConfig } from 'vitest/config'

// Date logic must not depend on the machine: pin the zone before workers start.
process.env.TZ = 'Asia/Kolkata'

export default defineConfig({
  test: { environment: 'node', include: ['tests/**/*.test.js'] },
})
