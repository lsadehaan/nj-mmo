import { test, expect } from '@playwright/test';
import { gotoGame } from './game-page';
import { approachMob } from './mob-combat';

const NEW_TI_MOB_IDS = [20432, 20544, 20442, 20121, 20130] as const;
/** High-HP outer-ring mobs that survive first hit (TIMOB-29: Orc or Elder Wolf). */
const CLIP_TEST_MOB_IDS = [20121, 20130] as const;

async function waitReady(page: import('@playwright/test').Page) {
  await page.waitForFunction(() => window.__GAME_STATE__?.ready === true, undefined, {
    timeout: 30_000,
  });
}

function pickNearestClipTestMob(
  mobs: Array<{ id: string; npcId: number; x: number; z: number; hp?: number }>,
  player: { x: number; z: number }
) {
  const pool = mobs
    .filter(
      (m) =>
        (CLIP_TEST_MOB_IDS as readonly number[]).includes(m.npcId) && (m.hp ?? 0) > 0
    )
    .map((m) => ({
      ...m,
      dist: Math.hypot(m.x - player.x, m.z - player.z),
    }))
    .sort((a, b) => a.dist - b.dist);
  if (pool.length === 0) {
    throw new Error('No Giant Toad (20121) or Orc (20130) in __GAME_STATE__ for combat e2e');
  }
  return pool[0];
}

test('outer field exposes new TI mob npcIds in __GAME_STATE__', async ({ page }, testInfo) => {
  test.setTimeout(30_000);
  await page.addInitScript(() => {
    localStorage.removeItem('nj.characterId');
  });
  await gotoGame(page, testInfo);
  await waitReady(page);

  // All room mobs sync to __GAME_STATE__ at join; Elpy spawns at (22,-16) outside peace zone.
  await expect
    .poll(
      async () =>
        page.evaluate((ids) => {
          const seen = window.__GAME_STATE__.mobs.map((m) => m.npcId);
          return ids.some((id) => seen.includes(id));
        }, [...NEW_TI_MOB_IDS]),
      { timeout: 10_000, intervals: [200, 400] }
    )
    .toBe(true);
});

test('new mob attack and die clips during combat kill', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await page.addInitScript(() => {
    localStorage.removeItem('nj.characterId');
    (window as unknown as { __mobClipFlags?: { attack: boolean; die: boolean } }).__mobClipFlags = {
      attack: false,
      die: false,
    };
  });
  await gotoGame(page, testInfo);
  await waitReady(page);

  await page.waitForFunction(
    (ids) => window.__GAME_STATE__?.mobs?.some((m) => ids.includes(m.npcId)) === true,
    [...CLIP_TEST_MOB_IDS],
    { timeout: 10_000 }
  );

  const { mobs, player } = await page.evaluate(() => ({
    mobs: window.__GAME_STATE__.mobs.map((m) => ({
      id: m.id,
      npcId: m.npcId,
      x: m.x,
      z: m.z,
      hp: m.hp,
    })),
    player: { x: window.__GAME_STATE__.player.x, z: window.__GAME_STATE__.player.z },
  }));
  const target = pickNearestClipTestMob(mobs, player);
  expect((CLIP_TEST_MOB_IDS as readonly number[]).includes(target.npcId)).toBe(true);

  await approachMob(page, target.id, 3.4);
  await page.waitForFunction(() => typeof window.__handleMobTarget__ === 'function');
  await page.evaluate((mobId) => window.__handleMobTarget__?.(mobId), target.id);
  await page.waitForFunction(
    (mobId) => window.__GAME_STATE__?.targetMobId === mobId,
    target.id,
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
        }, target.id),
      { timeout: 60_000, intervals: [200, 400, 600] }
    )
    .toBe(true);
});
