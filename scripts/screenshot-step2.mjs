import { chromium } from '@playwright/test'

const [email, password, shotUrl, out] = process.argv.slice(2)

const loginRes = await fetch('http://localhost:3000/api/users/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
})
const setCookie = loginRes.headers.get('set-cookie') ?? ''
const token = /payload-token=([^;]+)/.exec(setCookie)?.[1]
if (!token) {
  console.error('login failed', loginRes.status)
  process.exit(1)
}

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
await context.addCookies([
  { name: 'payload-token', value: token, domain: 'localhost', path: '/' },
])
const page = await context.newPage()
await page.goto(shotUrl, { waitUntil: 'networkidle', timeout: 90000 })
await page.waitForTimeout(1500)
await page.click('button:has-text("Continue to Payment")')
await page.waitForTimeout(1500)
await page.screenshot({ path: out, fullPage: true })
await browser.close()
console.log('saved', out)
