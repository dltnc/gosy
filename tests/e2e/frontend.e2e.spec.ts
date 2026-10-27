import { test, expect } from '@playwright/test'

test.describe('Public site', () => {
  test('homepage renders search and featured section', async ({ page }) => {
    await page.goto('http://localhost:3000')
    await expect(page).toHaveTitle(/StayBD/)
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Find your perfect stay')
    await expect(page.getByLabel('Location', { exact: true }).first()).toBeVisible()
  })

  test('listing page validates bad date params', async ({ page }) => {
    await page.goto(
      'http://localhost:3000/hotels-in/Dhaka?checkIn=2030-01-10&checkOut=2030-01-08',
    )
    await expect(page.getByText('Check-out must be after check-in.')).toBeVisible()
  })

  test('offers page loads', async ({ page }) => {
    await page.goto('http://localhost:3000/offers')
    await expect(page.getByRole('heading', { level: 1, name: 'Offers' })).toBeVisible()
  })
})
