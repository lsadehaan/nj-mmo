import { test, expect } from '@playwright/test';
import { gotoGame } from './game-page';
import { approachMob } from './mob-combat';

const NEW_TI_MOB_IDS = [20432, 20544, 20442, 20121, 20130] as const;

async function waitReady(page: import('@playwright/test').Page) {
  await page.waitForFunction(() => window.__GAME_STATE__?.ready === true, undefined, {
    timeout: 30_000,
  });
}

async function walkToward(
  page: import('@playwright/test').Page,
  targetX: number,
  targetZ: number,
  range = 4
) {
  await page.waitForFunction(() => typeof window.__sendMoveIntent__ === 'function');
  await expect
    .poll(
      async () =>
        page.evaluate(
          ({ targetX, targetZ, range }) => {
            const p = window.__GAME_STATE__.player;
            const dist = Math.hypot(p.x - targetX, p.z - targetZ);
            if (dist <= range) return true;
            const dx = targetX - p.x;
            const dz = targetZ - p.z;
            const len = Math.hypot(dx, dz) || 1;
            const step = Math.max(1, Math.min(len - range + 0.5, 8));
            window.__sendMoveIntent__?.(p.x + (dx / len) * step, p.z + (dz / len) * step);
            return false;
          },
          { targetX, targetZ, range }
        ),
      { timeout: 90_000, intervals: [300, 500, 800] }
    )
    .toBe(true);
}

test('outer field exposes new TI mob npcIds in __GAME_STATE__', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => {
    localStorage.removeItem('nj.characterId');
  });
  await gotoGame(page, testInfo);
  await waitReady(page);

  await walkToward(page, 60, -40, 6);

  await expect
    .poll(
      async () =>
        page.evaluate((ids) => {
          const seen = window.__GAME_STATE__.mobs.map((m) => m.npcId);
          return ids.some((id) => seen.includes(id));
        }, [...NEW_TI_MOB_IDS]),
      { timeout: 30_000, intervals: [500, 1000] }
    )
    .toBe(true);
});

test('new mob attack and die clips during combat kill', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => {
    localStorage.removeItem('nj.characterId');
    (window as unknown as { __mobClipFlags?: { attack: boolean; die: boolean } }).__mobClipFlags = {
      attack: false,
      die: false,
    };
  });
  await gotoGame(page, testInfo);
  await waitReady(page);

  await walkToward(page, 88, -56, 8);

  await page.waitForFunction(
    (ids) => window.__GAME_STATE__.mobs.some((m) => ids.includes(m.npcId)),
    [...NEW_TI_MOB_IDS],
    { timeout: 30_000 }
  );

  const target = await page.evaluate((ids) => {
    const mobs = window.__GAME_STATE__.mobs.filter((m) => ids.includes(m.npcId));
    const orc = mobs.find((m) => m.npcId === 20130);
    const elderWolf = mobs.find((m) => m.npcId === 20442);
    const pick = orc ?? elderWolf ?? mobs[0];
    return pick ? { id: pick.id, npcId: pick.npcId } : null;
  }, [...NEW_TI_MOB_IDS]);

  expect(target).not.toBeNull();

  await approachMob(page, target!.id, 3.4);
  await page.waitForFunction(() => typeof window.__handleMobTarget__ === 'function');
  await page.evaluate((mobId) => window.__handleMobTarget__?.(mobId), target!.id);
  await page.waitForFunction(
    (mobId) => window.__GAME_STATE__?.targetMobId === mobId,
    target!.id,
    { timeout: 5_000 }
  );

  await expect
    .poll(
      async () =>
        page.evaluate((mobId) => {
          const flags = (window as unknown as { __mobClipFlags?: { attack: boolean; die: boolean } })
            .__mobClipFlags!;
          const state = window.__GAME_STATE__;
          const mob = state.mobs.find((m) => m.id === mobId);
          if (mob?.action === 'attack') flags.attack = true;
          if (mob?.action === 'die') flags.die = true;

          if (!mob) {
            return flags.attack && flags.die;
          }

          const p = state.player;
          const dist = Math.hypot(p.x - mob.x, p.z - mob.z);
          if (dist > 3.4) {
            const dx = mob.x - p.x;
            const dz = mob.z - p.z;
            const len = Math.hypot(dx, dz) || 1;
            const step = Math.max(1, Math.min(len - 2.5, 6));
            window.__sendMoveIntent__?.(p.x + (dx / len) * step, p.z + (dz / len) * step);
          } else {
            window.__attack__?.();
          }
          return false;
        }, target!.id),
      { timeout: 120_000, intervals: [300, 500, 800] }
    )
    .toBe(true);
});
