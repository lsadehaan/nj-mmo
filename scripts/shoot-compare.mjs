import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE = 'http://localhost:4200';
const out = '/tmp/char-shots';
mkdirSync(out, { recursive: true });
const chars = (process.env.CHARS ?? 'Rogue,Rogue_Hooded,Barbarian').split(',');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 600, height: 720 }, deviceScaleFactor: 1 });
for (const c of chars) {
  for (const clip of ['idle', 'attack']) {
    const t = clip === 'attack' ? 0.45 : 0.5;
    await p.goto(`${BASE}/character-lab.html?char=${c}&clip=${clip}&t=${t}&angle=0.5&auto=0`, { waitUntil: 'load' });
    await p.waitForFunction(() => window.__SHOT_READY__ === true, { timeout: 15000 });
    await p.waitForTimeout(120);
    await p.screenshot({ path: `${out}/cmp-${c}-${clip}.png` });
    console.log(`shot ${c} ${clip}`);
  }
}
await b.close();
