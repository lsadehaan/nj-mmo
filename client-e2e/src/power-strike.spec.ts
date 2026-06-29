import { test, expect } from '@playwright/test';
import { pickNearestCombatMob } from './peace-zone';
import { gotoGame } from './game-page';
import { approachMob } from './mob-combat';

async function waitReady(page: import('@playwright/test').Page) {
  await page.waitForFunction(() => window.__GAME_STATE__?.ready === true, undefined, {
    timeout: 30_000,
  });
}

test('Power Strike drops MP, engages cooldown, and kills a mob', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await page.addInitScript(() => localStorage.removeItem('nj.characterId'));
  await gotoGame(page, testInfo);
  await waitReady(page);

  await page.waitForFunction(() => (window.__GAME_STATE__?.mobs?.length ?? 0) > 0, undefined, {
    timeout: 20_000,
  });

  const initialMp = await page.evaluate(() => window.__GAME_STATE__.player.mp);
  expect(initialMp).toBe(50);

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

  await approachMob(page, target.id, 3.4);

  await page.waitForFunction(() => typeof window.__handleMobTarget__ === 'function');
  await page.evaluate((mobId) => window.__handleMobTarget__?.(mobId), target.id);

  await page.waitForFunction(
    (mobId) => window.__GAME_STATE__?.targetMobId === mobId,
    target.id,
    { timeout: 5_000 }
  );

  await page.waitForFunction(() => typeof window.__useSkill__ === 'function');

  await expect
    .poll(
      async () =>
        page.evaluate((mobId) => {
          const state = window.__GAME_STATE__;
          const cooldownEl = document.getElementById('power-strike-cooldown');
          const domRemaining = Number(cooldownEl?.getAttribute('data-remaining-ms') ?? 0);
          const mob = state.mobs.find((m) => m.id === mobId);
          if (!mob || mob.hp <= 0) {
            if (
              state.player.mp === 41 &&
              state.player.powerStrikeCooldownRemainingMs > 0 &&
              domRemaining > 0 &&
              state.player.xp > 0
            ) {
              return state.player.xp;
            }
            return -1;
          }
          // Mob still alive: keep within cast range (mobs wander) before casting.
          const p = state.player;
          const dist = Math.hypot(p.x - mob.x, p.z - mob.z);
          if (dist > 3.4) {
            const dx = mob.x - p.x;
            const dz = mob.z - p.z;
            const len = Math.hypot(dx, dz) || 1;
            const step = Math.max(1, Math.min(len - 2.5, 6));
            window.__sendMoveIntent__?.(p.x + (dx / len) * step, p.z + (dz / len) * step);
            return -1;
          }
          window.__useSkill__?.();
          return -1;
        }, target.id),
      { timeout: 90_000, intervals: [400, 600, 800] }
    )
    .toBeGreaterThan(0);

  const final = await page.evaluate(() => {
    const state = window.__GAME_STATE__;
    const cooldownEl = document.getElementById('power-strike-cooldown');
    return {
      mp: state.player.mp,
      xp: state.player.xp,
      cooldownRemaining: state.player.powerStrikeCooldownRemainingMs,
      domRemaining: Number(cooldownEl?.getAttribute('data-remaining-ms') ?? 0),
      mobAlive: state.mobs.some((m) => m.id === state.targetMobId),
    };
  });

  expect(final.mp).toBe(41);
  expect(final.xp).toBeGreaterThan(0);
  expect(final.cooldownRemaining).toBeGreaterThan(0);
  expect(final.domRemaining).toBeGreaterThan(0);
  expect(final.mobAlive).toBe(false);
});
