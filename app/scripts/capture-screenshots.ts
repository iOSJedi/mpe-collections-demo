import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'

const APP_ROOT = path.resolve(__dirname, '..')
const OUT = path.resolve(APP_ROOT, 'decks-tmp-screenshots')
const DEV_URL = 'http://localhost:3000'

async function waitForServer(url: string, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try { const r = await fetch(url); if (r.ok || r.status === 404) return } catch {}
    await sleep(1000)
  }
  throw new Error('dev server never came up')
}

async function main() {
  await mkdir(OUT, { recursive: true })
  console.log('starting dev server...')
  const dev = spawn('npm', ['run', 'dev'], { cwd: APP_ROOT, stdio: 'inherit' })
  try {
    await waitForServer(DEV_URL)
    console.log('dev server up, seeding...')
    await fetch(`${DEV_URL}/api/seed`, { method: 'POST' })
    await fetch(`${DEV_URL}/api/demo/reset-cwt-demo`, { method: 'POST' })

    const browser = await chromium.launch()
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

    // 1. Enrollment page
    await page.goto(`${DEV_URL}/pay/enroll?customerId=10&token=demo`)
    await page.waitForLoadState('networkidle')
    await sleep(500)
    await page.screenshot({ path: path.join(OUT, 'enrollment.png'), fullPage: false })

    // 2. CWT queue before simulate (already has seeded historical rows)
    await page.goto(`${DEV_URL}/collections/cwt`)
    await page.waitForLoadState('networkidle')
    await sleep(500)
    await page.screenshot({ path: path.join(OUT, 'magic-before.png') })
    await page.screenshot({ path: path.join(OUT, 'ar-queue.png') })

    // 3. Fire simulate -> get certId/invId
    console.log('firing demo simulate...')
    const sim = await (await fetch(`${DEV_URL}/api/demo/simulate-cwt-payment`, { method: 'POST' })).json()
    console.log('simulate returned:', JSON.stringify(sim))

    if (sim.certificateId) {
      await page.goto(`${DEV_URL}/collections/cwt/${sim.certificateId}`)
      await page.waitForLoadState('networkidle')
      await sleep(3000)  // give the iframe PDF a beat to render
      await page.screenshot({ path: path.join(OUT, 'magic-pdf.png') })
    }
    if (sim.invoiceId) {
      await page.goto(`${DEV_URL}/receivable/${sim.invoiceId}`)
      await page.waitForLoadState('networkidle')
      await sleep(500)
      await page.screenshot({ path: path.join(OUT, 'magic-after.png') })
    }

    // 4. Escalations page (may or may not have CWT_GAP_MISMATCH rows — best-effort)
    await page.goto(`${DEV_URL}/collections/escalations`)
    await page.waitForLoadState('networkidle')
    await sleep(500)
    await page.screenshot({ path: path.join(OUT, 'escalation.png') })

    await browser.close()
    console.log('captured screenshots to', OUT)
  } finally {
    dev.kill('SIGTERM')
    // Give it a second to release ports
    await sleep(1000)
    dev.kill('SIGKILL')
  }
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
