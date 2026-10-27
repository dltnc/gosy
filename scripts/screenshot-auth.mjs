import { chromium } from '@playwright/test'

const [email, password, startUrl, shots] = process.argv.slice(2)
const shotList = JSON.parse(shots)
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

await page.goto(startUrl, { waitUntil: 'networkidle', timeout: 60000 })
await page.fill('input[type="email"]', email)
await page.fill('input[type="password"]', password)
await page.click('button[type="submit"]')
await page.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {})
await page.waitForTimeout(2000)

for (const [url, out] of shotList) {
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
  await page.waitForTimeout(2000)
  await page.screenshot({ path: out, fullPage: true })
  console.log('saved', out)
}
await browser.close()
