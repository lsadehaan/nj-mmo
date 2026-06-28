import { test, expect } from '@playwright/test';
import { pickNearestCombatMob } from './peace-zone';
import { gotoGame } from './game-page';
import { approachMob } from './mob-combat';

async function waitReady(page: import('@playwright/test').Page) {
  await page.waitForFunction(() => window.__GAME_STATE__?.ready === true, undefined, {
    timeout: 30_000,
  });
}

test('player animation transitions idle → move → idle → attack → cast', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await page.addInitScript(() => localStorage.removeItem('nj.characterId'));
  await gotoGame(page, testInfo);
  await waitReady(page);

  await expect
    .poll(async () => page.evaluate(() => window.__GAME_STATE__.player.action))
    .toBe('idle');

  const start = await page.evaluate(() => ({
    x: window.__GAME_STATE__.player.x,
    z: window.__GAME_STATE__.player.z,
  }));

  await page.waitForFunction(() => typeof window.__sendMoveIntent__ === 'function');
  await page.evaluate(
    ({ x, z }) => window.__sendMoveIntent__?.(x + 20, z + 20),
    start
  );

  await expect
    .poll(async () => page.evaluate(() => window.__GAME_STATE__.player.action), {
      timeout: 20_000,
    })
    .toBe('move');

  await expect
    .poll(
      async () =>
        page.evaluate(({ x, z }) => {
          const player = window.__GAME_STATE__.player;
          const dist = Math.hypot(player.x - (x + 20), player.z - (z + 20));
          if (dist > 3) {
            window.__sendMoveIntent__?.(x + 20, z + 20);
            return false;
          }
          return true;
        }, start),
      { timeout: 60_000, intervals: [250, 500, 1000] }
    )
    .toBe(true);

  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const w = window as typeof window & {
            __animPos?: { x: number; z: number; t: number };
          };
          const p = window.__GAME_STATE__.player;
          const now = Date.now();
          const prev = w.__animPos;
          w.__animPos = { x: p.x, z: p.z, t: now };
          if (!prev || now - prev.t < 400) return '';
          const delta = Math.hypot(p.x - prev.x, p.z - prev.z);
          if (delta > 0.02) return '';
          return p.action;
        }),
      { timeout: 30_000, intervals: [400, 600, 800] }
    )
    .toBe('idle');

  await page.waitForFunction(() => (window.__GAME_STATE__?.mobs?.length ?? 0) > 0, undefined, {
    timeout: 20_000,
  });

  const { mobs, player } = await page.evaluate(() => ({
    mobs: window.__GAME_STATE__.mobs.map((m) => ({
      id: m.id,
      x: m.x,
      z: m.z,
    })),
    player: { x: window.__GAME_STATE__.player.x, z: window.__GAME_STATE__.player.z },
  }));
  const target = pickNearestCombatMob(mobs, player);

  await approachMob(page, target.id, 3.4);

  await page.waitForFunction(() => typeof window.__handleMobTarget__ === 'function');
  await page.evaluate((mobId) => window.__handleMobTarget__?.(mobId), target.id);

  await page.waitForFunction(
    (mobId) => window.__GAME_STATE__?.targetMobId === mobId,
    target.id,
    { timeout: 5_000 }
  );

  await page.waitForFunction(() => typeof window.__attack__ === 'function');

  await expect
    .poll(
      async () =>
        page.evaluate((mobId) => {
          const state = window.__GAME_STATE__;
          const mob = state.mobs.find((m) => m.id === mobId);
          if (!mob) return state.player.action;
          const p = state.player;
          const dist = Math.hypot(p.x - mob.x, p.z - mob.z);
          if (dist > 3.4) {
            const dx = mob.x - p.x;
            const dz = mob.z - p.z;
            const len = Math.hypot(dx, dz) || 1;
            const step = Math.max(1, Math.min(len - 2.5, 6));
            window.__sendMoveIntent__?.(p.x + (dx / len) * step, p.z + (dz / len) * step);
            return '';
          }
          window.__attack__?.();
          return state.player.action;
        }, target.id),
      { timeout: 60_000, intervals: [200, 400, 800] }
    )
    .toBe('attack');

  await page.waitForFunction(() => typeof window.__useSkill__ === 'function');

  await expect
    .poll(
      async () =>
        page.evaluate((mobId) => {
          const state = window.__GAME_STATE__;
          const mob = state.mobs.find((m) => m.id === mobId);
          if (!mob) return state.player.action;
          const p = state.player;
          const dist = Math.hypot(p.x - mob.x, p.z - mob.z);
          if (dist > 3.4) {
            const dx = mob.x - p.x;
            const dz = mob.z - p.z;
            const len = Math.hypot(dx, dz) || 1;
            const step = Math.max(1, Math.min(len - 2.5, 6));
            window.__sendMoveIntent__?.(p.x + (dx / len) * step, p.z + (dz / len) * step);
            return '';
          }
          window.__useSkill__?.();
          return state.player.action;
        }, target.id),
      { timeout: 90_000, intervals: [200, 400, 800] }
    )
    .toBe('cast');
});
