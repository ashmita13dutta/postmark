// Runs the test suite in zones with daylight saving, to prove day logic never drifts.
// Cross-platform replacement for `TZ=... vitest run` (which does not work on Windows).
import { spawnSync } from 'node:child_process'

const zones = ['America/New_York', 'Pacific/Auckland', 'Europe/London']
let failed = false

for (const TZ of zones) {
  console.log(`\n=== TZ=${TZ} ===`)
  const result = spawnSync('npx', ['vitest', 'run'], {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, TZ },
  })
  if (result.status !== 0) failed = true
}

process.exit(failed ? 1 : 0)
