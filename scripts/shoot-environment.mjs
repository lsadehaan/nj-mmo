import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.LAB_BASE ?? 'http://localhost:4200';
const outDir = process.env.LAB_OUT ?? '/tmp/environment-shots';
const shot = process.argv[2] ?? 'town-overview';
const outFile = `${outDir}/${shot}.png`;

mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1280, height: 720 },
  deviceScaleFactor: 1,
});
page.on('console', (m) => console.log(`[page] ${m.text()}`));

const query = shot === 'map-overview' ? '?shot=map-overview' : '';
const url = `${BASE}/environment-lab.html${query}`;
await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction(() => window.__SHOT_READY__ === true, { timeout: 30_000 });
await page.screenshot({ path: outFile });
console.log(`shot ${outFile}`);

await browser.close();
