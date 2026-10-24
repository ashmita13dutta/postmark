import { expect, test } from '@playwright/test'
import { goTab, skipWelcome, stampToday } from './helpers'

// the offline audit (spec section 15 and phase 14): load once online, then lose the network. Every
// tab must still open and a day must still be stampable, with nothing asked of the network.
test('the installed app works with no network', async ({ page, context }) => {
  const failed = []
  page.on('requestfailed', (r) => failed.push(r.url()))

  await page.goto('/?now=2026-09-24T21:00#/')
  await skipWelcome(page)

  // wait for the service worker to finish putting the app in its cache
  await page.waitForFunction(
    async () => {
      const names = await caches.keys()
      const name = names.find((n) => n.includes('precache'))
      if (!name) return false
      return (await (await caches.open(name)).keys()).length > 40
    },
    null,
    { timeout: 60_000 },
  )
  // the worker must be active (not just installed) before a reload puts it in charge of the page
  await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready
    if (reg.active.state !== 'activated')
      await new Promise((done) =>
        reg.active.addEventListener(
          'statechange',
          () => reg.active.state === 'activated' && done(),
        ),
      )
  })
  await page.reload()
  await expect(page.getByLabel('Your note')).toBeVisible()
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)

  await context.setOffline(true)
  failed.length = 0
  await page.reload()
  await expect(page.getByLabel('Your note')).toBeVisible()

  // every tab opens
  for (const [tab, heading] of [
    ['Calendar', 'Calendar'],
    ['Mailbox', 'Mailbox'],
    ['Album', 'Album'],
    ['You', 'You'],
  ]) {
    await goTab(page, tab)
    await expect(page.getByRole('heading', { name: heading, exact: true }).first()).toBeVisible()
  }

  // and a day can be stamped and read back, offline
  await goTab(page, 'Today')
  await stampToday(page, 'Offline on the metro, reading by the window.')
  await goTab(page, 'Calendar')
  await expect(page.getByRole('button', { name: /24 September.*stamped/i })).toBeVisible()

  // nothing the app needs was missing from the cache
  const missing = failed.filter(
    (u) => u.startsWith('http://localhost:4173') && !/\/models\/|splash|og-card/.test(u),
  )
  expect(missing).toEqual([])
})
