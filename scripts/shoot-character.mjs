import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.LAB_BASE ?? 'http://localhost:4201';
const classIds = process.env.LAB_CLASS_IDS?.split(',').filter(Boolean) ?? [];
const char = process.env.LAB_CHAR;
const model = process.env.LAB_MODEL;
const mob = process.env.LAB_MOB;
const npc = process.env.LAB_NPC;
const weapon = process.env.LAB_WEAPON;
const dual = process.env.LAB_DUAL === '1';
const outDir = process.env.LAB_OUT ?? '/tmp/char-shots';
mkdirSync(outDir, { recursive: true });

const shots = [
  { clip: 'idle', t: 0.5, angle: 0.5 },
  { clip: 'move', t: 0.35, angle: 0.5 },
  { clip: 'attack', t: 0.45, angle: 0.6 },
  { clip: 'cast', t: 0.5, angle: 0.6 },
  { clip: 'die', t: 1.1, angle: 0.6 },
];

const weaponShots = [
  { clip: 'idle', t: 0.5, angle: 0.5 },
  { clip: 'attack', t: 0.45, angle: 0.6 },
];

const mobShots = [
  { clip: 'idle', t: 0.5, angle: 0.5 },
  { clip: 'attack', t: 0.45, angle: 0.6 },
  { clip: 'die', t: 1.1, angle: 0.6 },
];

const npcShots = [
  { clip: 'idle', t: 0.5, angle: 0.5 },
  { clip: 'cast', t: 0.5, angle: 0.6 },
];

const mobTargets = [];
if (npc) mobTargets.push({ kind: 'npc', id: npc, label: `npc-${npc}` });
if (mob) mobTargets.push({ kind: 'mob', id: mob, label: `mob-${mob}` });
if (weapon) {
  mobTargets.push({
    kind: dual ? 'dual' : 'weapon',
    id: weapon,
    label: dual ? `dual-weapon-${weapon}` : `weapon-${weapon}`,
  });
}
if (classIds.length) {
  for (const id of classIds) {
    mobTargets.push({ kind: 'classId', id, label: `class-${id}` });
  }
}
if (model) mobTargets.push({ kind: 'model', id: model, label: model.replace(/\//g, '-') });
if (char && mobTargets.length === 0) mobTargets.push({ kind: 'char', id: char, label: char });
if (mobTargets.length === 0) {
  mobTargets.push(
    { kind: 'mob', id: '20001', label: 'Gremlin' },
    { kind: 'mob', id: '20003', label: 'Goblin' },
    { kind: 'mob', id: '20120', label: 'Wolf' },
    { kind: 'mob', id: '20481', label: 'BeardedKeltir' }
  );
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 720, height: 720 }, deviceScaleFactor: 1 });
page.on('console', (m) => console.log(`[page] ${m.text()}`));

for (const target of mobTargets) {
  const clipShots =
    target.kind === 'npc'
      ? npcShots
      : target.kind === 'weapon' || target.kind === 'dual'
        ? weaponShots
        : target.kind === 'char'
          ? shots
          : target.kind === 'classId'
            ? shots
          : mobShots;
  for (const { clip, t, angle } of clipShots) {
    const parts = [
      target.kind === 'classId'
        ? `classId=${target.id}`
        : target.kind === 'npc'
        ? `npc=${target.id}`
        : target.kind === 'mob'
        ? `mob=${target.id}`
        : target.kind === 'model'
          ? `model=${target.id}`
          : target.kind === 'dual'
            ? `dual=1&char=Rogue&weapon=${target.id}`
            : target.kind === 'weapon'
              ? `char=Rogue&weapon=${target.id}`
              : `char=${target.id}`,
      `clip=${clip}`,
      `t=${t}`,
      `angle=${angle}`,
      'auto=0',
    ];
    const url = `${BASE}/character-lab.html?${parts.join('&')}`;
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__SHOT_READY__ === true, { timeout: 15000 });
    await page.waitForTimeout(150);
    const file = `${outDir}/${target.label}-${clip}.png`;
    await page.screenshot({ path: file });
    console.log(`shot ${file}`);
  }
}

await browser.close();
