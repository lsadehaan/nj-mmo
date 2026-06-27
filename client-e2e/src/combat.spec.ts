import { test, expect } from '@playwright/test';
import { pickNearestCombatMob } from './peace-zone';

test.describe.configure({ mode: 'serial' });

async function waitReady(page: import('@playwright/test').Page) {
  await page.waitForFunction(() => window.__GAME_STATE__?.ready === true, undefined, {
    timeout: 30_000,
  });
}

test('killing a mob grants server-validated XP via __GAME_STATE__', async ({ page }) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => localStorage.removeItem('nj.characterId'));
  await page.goto('/');
  await waitReady(page);

  await page.waitForFunction(() => (window.__GAME_STATE__?.mobs?.length ?? 0) > 0, undefined, {
    timeout: 20_000,
  });

  const initialXp = await page.evaluate(() => window.__GAME_STATE__.player.xp);
  expect(initialXp).toBe(0);

  const { mobs, player } = await page.evaluate(() => ({
    mobs: window.__GAME_STATE__.mobs.map((m) => ({
      id: m.id,
      x: m.x,
      z: m.z,
      hp: m.hp,
    })),
    player: { x: window.__GAME_STATE__.player.x, z: window.__GAME_STATE__.player.z },
  }));
  const target = pickNearestCombatMob(mobs, player);

  await page.waitForFunction(() => typeof window.__sendMoveIntent__ === 'function');

  await expect
    .poll(
      async () =>
        page.evaluate((mob) => {
          const player = window.__GAME_STATE__.player;
          const dist = Math.hypot(player.x - mob.x, player.z - mob.z);
          if (dist <= 3.5) return true;
          const dx = mob.x - player.x;
          const dz = mob.z - player.z;
          const len = Math.hypot(dx, dz) || 1;
          const step = Math.max(1, Math.min(len - 2.5, 6));
          window.__sendMoveIntent__?.(player.x + (dx / len) * step, player.z + (dz / len) * step);
          return false;
        }, target),
      { timeout: 90_000, intervals: [250, 500, 1000] }
    )
    .toBe(true);

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
          const state = window.__GAME_STATE__;
          const mobAlive = state.mobs.some((m) => m.id === mobId);
          if (!mobAlive) return state.player.xp;
          window.__attack__?.();
          return -1;
        }, target.id),
      { timeout: 60_000, intervals: [400, 600, 800] }
    )
    .toBeGreaterThan(0);

  const finalXp = await page.evaluate(() => window.__GAME_STATE__.player.xp);
  expect(finalXp).toBeGreaterThan(0);
});
