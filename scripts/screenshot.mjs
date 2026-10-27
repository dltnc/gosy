import { chromium } from '@playwright/test'

const [url, out, wait] = process.argv.slice(2)
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 })
if (wait) await page.waitForTimeout(Number(wait))
await page.screenshot({ path: out, fullPage: true })
await browser.close()
console.log('saved', out)
