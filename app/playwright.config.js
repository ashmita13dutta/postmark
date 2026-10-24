import { defineConfig } from '@playwright/test'

/**
 * End-to-end tests (spec section 15): the built app in a phone-sized Chromium, with the real service
 * worker. `npm run e2e` builds the app and serves it with `vite preview`; if one is already running
 * on port 4173 it is used instead.
 */
export default defineConfig({
  testDir: 'e2e',
  timeout: 180_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    timezoneId: 'Asia/Kolkata',
    locale: 'en-GB',
    trace: 'off',
  },
  webServer: {
    command: 'npm run build && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
    timeout: 600_000,
  },
})
