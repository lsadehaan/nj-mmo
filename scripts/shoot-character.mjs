import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.LAB_BASE ?? 'http://localhost:4201';
const char = process.env.LAB_CHAR;
const model = process.env.LAB_MODEL;
const mob = process.env.LAB_MOB;
const outDir = process.env.LAB_OUT ?? '/tmp/char-shots';
mkdirSync(outDir, { recursive: true });

const shots = [
  { clip: 'idle', t: 0.5, angle: 0.5 },
  { clip: 'move', t: 0.35, angle: 0.5 },
  { clip: 'attack', t: 0.45, angle: 0.6 },
  { clip: 'cast', t: 0.5, angle: 0.6 },
  { clip: 'die', t: 1.1, angle: 0.6 },
];

const mobShots = [
  { clip: 'idle', t: 0.5, angle: 0.5 },
  { clip: 'attack', t: 0.45, angle: 0.6 },
  { clip: 'die', t: 1.1, angle: 0.6 },
];

const mobTargets = mob
  ? [{ kind: 'mob', id: mob, label: `mob-${mob}` }]
  : model
    ? [{ kind: 'model', id: model, label: model.replace(/\//g, '-') }]
    : char
      ? [{ kind: 'char', id: char, label: char }]
      : [
          { kind: 'mob', id: '20001', label: 'Gremlin' },
          { kind: 'mob', id: '20003', label: 'Goblin' },
          { kind: 'mob', id: '20120', label: 'Wolf' },
          { kind: 'mob', id: '20481', label: 'BeardedKeltir' },
        ];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 720, height: 720 }, deviceScaleFactor: 1 });
page.on('console', (m) => console.log(`[page] ${m.text()}`));

for (const target of mobTargets) {
  const clipShots = target.kind === 'char' ? shots : mobShots;
  for (const { clip, t, angle } of clipShots) {
    const query =
      target.kind === 'mob'
        ? `mob=${target.id}&clip=${clip}&t=${t}&angle=${angle}&auto=0`
        : target.kind === 'model'
          ? `model=${target.id}&clip=${clip}&t=${t}&angle=${angle}&auto=0`
          : `char=${target.id}&clip=${clip}&t=${t}&angle=${angle}&auto=0`;
    const url = `${BASE}/character-lab.html?${query}`;
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__SHOT_READY__ === true, { timeout: 15000 });
    await page.waitForTimeout(150);
    const file = `${outDir}/${target.label}-${clip}.png`;
    await page.screenshot({ path: file });
    console.log(`shot ${file}`);
  }
}

await browser.close();
