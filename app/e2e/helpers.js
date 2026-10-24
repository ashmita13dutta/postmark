import { expect } from '@playwright/test'

/** The welcome frames show on a brand-new install; get past them. */
export async function skipWelcome(page) {
  const skip = page.getByRole('button', { name: 'Skip' })
  await skip.waitFor({ state: 'visible', timeout: 8000 }).catch(() => {})
  if (await skip.isVisible()) await skip.click()
  await expect(page.getByRole('navigation').first()).toBeVisible()
}

/** Write a note on Today and stamp it. Ends on the Reveal screen. */
export async function stampToday(page, note) {
  await page.getByLabel('Your note').fill(note)
  const stamp = page.getByRole('button', { name: /^(Stamp it|Update stamp)$/ })
  await expect(stamp).toBeEnabled({ timeout: 20_000 })
  await stamp.click()
  await expect(page).toHaveURL(/#\/reveal/)
}

/** Open a tab by its label in the bottom bar. */
export const goTab = (page, name) => page.getByRole('link', { name, exact: true }).click()
