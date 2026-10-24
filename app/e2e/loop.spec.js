import { expect, test } from '@playwright/test'
import { goTab, skipWelcome, stampToday } from './helpers'

const NOTE = 'Rain at the tram crossing, chai after, and a long call with Maa.'

// the whole loop of spec section 15: welcome, stamp a day, seal it, jump the clock to the 1st,
// open the Mailbox, then save a backup and bring it back on a fresh phone
test('stamp, seal, wait for the 1st, open it, back up and restore', async ({ page, browser }) => {
  await page.goto('/?now=2026-09-24T21:00#/')
  await skipWelcome(page)

  // stamp today
  await stampToday(page, NOTE)
  await expect(page.getByText(/Sealed until 1 Oct/)).toBeVisible()

  // seal and send
  await page.getByRole('link', { name: /Seal & send/ }).click()
  await page.getByRole('button', { name: 'Seal it' }).click()
  await expect(page).toHaveURL(/#\/$/, { timeout: 30_000 })
  await expect(page.getByText(/Sealed and on its way/)).toBeVisible()

  // it is still sealed on the 30th
  await page.goto('/?now=2026-09-30T09:00#/mailbox')
  await expect(page.getByText('Nothing has arrived yet')).toBeVisible()

  // and it arrives on the 1st
  await page.goto('/?now=2026-10-01T09:00#/mailbox')
  await expect(page.getByRole('heading', { name: 'Your September has arrived' })).toBeVisible()
  await page.getByRole('button', { name: /Open the postcard from 24 September/ }).click()
  await page.getByRole('button', { name: 'Open the envelope' }).click()
  await expect(page.getByText(NOTE)).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: 'Close' }).first().click()

  // back it up
  await goTab(page, 'You')
  await expect(page.getByText(/1 stamp/)).toBeVisible()
  const saved = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Save a backup' }).click()
  const download = await saved
  expect(download.suggestedFilename()).toMatch(/\.zip$/)
  const file = await download.path()

  // a different phone: nothing there, then everything comes back
  const other = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    timezoneId: 'Asia/Kolkata',
    locale: 'en-GB',
  })
  const phone = await other.newPage()
  await phone.goto('/?now=2026-10-02T09:00#/you')
  await skipWelcome(phone)
  await expect(phone.getByText(/0 stamps/)).toBeVisible()
  await phone.locator('input[type=file][accept*="zip"]').setInputFiles(file)
  await phone.getByRole('button', { name: 'Bring them in' }).click()
  await expect(phone.getByRole('status').filter({ hasText: 'added 1 stamp' })).toBeVisible()
  // it was already opened on the first phone, and that comes back with it
  await goTab(phone, 'Mailbox')
  await expect(phone.getByRole('heading', { name: 'You are all caught up' })).toBeVisible()
  await expect(phone.getByText('September 2026', { exact: true })).toBeVisible()
  await other.close()
})
