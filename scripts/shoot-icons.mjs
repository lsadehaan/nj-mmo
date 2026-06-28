import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.env.LAB_BASE ?? 'http://localhost:4201';
const repoRoot = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const outDir =
  process.env.LAB_OUT ?? path.join(repoRoot, 'client-e2e/test-results');
const outFile = path.join(outDir, 'icon-sheet.png');

mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 640, height: 480 },
  deviceScaleFactor: 1,
});

await page.goto(`${BASE}/icon-lab.html`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__SHOT_READY__ === true, { timeout: 15_000 });
await page.waitForTimeout(150);
await page.screenshot({ path: outFile, fullPage: true });
console.log(`shot ${outFile}`);

await browser.close();
