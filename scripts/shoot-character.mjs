import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.LAB_BASE ?? 'http://localhost:4201';
const char = process.env.LAB_CHAR ?? 'Mage';
const outDir = process.env.LAB_OUT ?? '/tmp/char-shots';
mkdirSync(outDir, { recursive: true });

// clip -> time (seconds) to pose the one-shot/looping clip at a readable frame
const shots = [
  { clip: 'idle', t: 0.5, angle: 0.5 },
  { clip: 'move', t: 0.35, angle: 0.5 },
  { clip: 'attack', t: 0.45, angle: 0.6 },
  { clip: 'cast', t: 0.5, angle: 0.6 },
  { clip: 'die', t: 1.1, angle: 0.6 },
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 720, height: 720 }, deviceScaleFactor: 1 });
page.on('console', (m) => console.log(`[page] ${m.text()}`));

for (const { clip, t, angle } of shots) {
  const url = `${BASE}/character-lab.html?char=${char}&clip=${clip}&t=${t}&angle=${angle}&auto=0`;
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__SHOT_READY__ === true, { timeout: 15000 });
  await page.waitForTimeout(150);
  const file = `${outDir}/${char}-${clip}.png`;
  await page.screenshot({ path: file });
  console.log(`shot ${file}`);
}

await browser.close();
