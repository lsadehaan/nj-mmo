import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.LAB_BASE ?? 'http://localhost:4200';
const outDir = process.env.LAB_OUT ?? '/tmp/vfx-shots';
const all = process.env.LAB_VFX === 'all';

mkdirSync(outDir, { recursive: true });

const shots = all
  ? [
      { effect: 'power-strike', t: 0.4 },
      { effect: 'melee-hit', t: 0.35 },
      { effect: 'death-dissolve', t: 0.5 },
      { effect: 'level-up', t: 0.45 },
      { effect: 'target-ring', t: 0.5 },
    ]
  : [
      {
        effect: process.env.LAB_VFX ?? 'power-strike',
        t: Number(process.env.LAB_T ?? '0.4'),
      },
    ];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 720, height: 720 }, deviceScaleFactor: 1 });
page.on('console', (m) => console.log(`[page] ${m.text()}`));

for (const { effect, t } of shots) {
  const url = `${BASE}/vfx-lab.html?effect=${effect}&t=${t}`;
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__SHOT_READY__ === true, { timeout: 15000 });
  await page.waitForTimeout(150);
  const file = `${outDir}/${effect}.png`;
  await page.screenshot({ path: file });
  console.log(`shot ${file}`);
}

await browser.close();
