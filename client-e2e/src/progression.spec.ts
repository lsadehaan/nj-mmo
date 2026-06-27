import { test, expect } from '@playwright/test';
import { gotoGame } from './game-page';

const ROXXY_NPC_ID = 30006;
const KATERINA_NPC_ID = 30004;
const SQUIRES_SWORD_ITEM_ID = 2369;

async function waitReady(page: import('@playwright/test').Page) {
  await page.waitForFunction(() => window.__GAME_STATE__?.ready === true, undefined, {
    timeout: 30_000,
  });
}

async function walkTowardInPeaceZone(
  page: import('@playwright/test').Page,
  target: { x: number; z: number },
  arriveWithin: number,
  timeoutMs = 45_000
): Promise<void> {
  await page.waitForFunction(() => typeof window.__sendMoveIntent__ === 'function');
  await expect
    .poll(
      async () =>
        page.evaluate(
          ({ x, z, radius }) => {
            const player = window.__GAME_STATE__.player;
            const inPeaceZone =
              player.x >= -20 &&
              player.x <= 20 &&
              player.z >= -20 &&
              player.z <= 20;
            const dist = Math.hypot(player.x - x, player.z - z);
            if (dist <= radius && inPeaceZone) return true;
            if (!inPeaceZone) return 'outside-peace-zone';
            const dx = x - player.x;
            const dz = z - player.z;
            const len = Math.hypot(dx, dz) || 1;
            const step = Math.max(1, Math.min(len - radius + 0.5, 6));
            window.__sendMoveIntent__?.(player.x + (dx / len) * step, player.z + (dz / len) * step);
            return false;
          },
          { x: target.x, z: target.z, radius: arriveWithin }
        ),
      { timeout: timeoutMs, intervals: [250, 500, 1000] }
    )
    .toBe(true);
}

async function killUntilProgress(
  page: import('@playwright/test').Page,
  goal: 'first-xp' | 'level-2',
  timeoutMs = 120_000
): Promise<void> {
  await page.waitForFunction(() => typeof window.__attack__ === 'function');
  await page.waitForFunction(() => typeof window.__handleMobTarget__ === 'function');

  await expect
    .poll(
      async () =>
        page.evaluate((targetGoal) => {
          const state = window.__GAME_STATE__;
          if (targetGoal === 'first-xp' && state.player.xp > 0) return 'done';
          if (targetGoal === 'level-2' && state.player.level >= 2) return 'done';

          const PEACE_MIN = -20;
          const PEACE_MAX = 20;
          const player = state.player;
          const mob = state.mobs
            .filter(
              (entry) =>
                entry.hp > 0 &&
                (entry.x < PEACE_MIN ||
                  entry.x > PEACE_MAX ||
                  entry.z < PEACE_MIN ||
                  entry.z > PEACE_MAX)
            )
            .map((entry) => ({
              id: entry.id,
              x: entry.x,
              z: entry.z,
              dist: Math.hypot(entry.x - player.x, entry.z - player.z),
            }))
            .sort((a, b) => a.dist - b.dist)[0];

          if (!mob) return 'no-mob';

          if (state.targetMobId !== mob.id) {
            window.__handleMobTarget__?.(mob.id);
            return 'targeting';
          }

          if (mob.dist > 3.4) {
            const dx = mob.x - player.x;
            const dz = mob.z - player.z;
            const len = Math.hypot(dx, dz) || 1;
            const step = Math.max(1, Math.min(len - 2.5, 6));
            window.__sendMoveIntent__?.(player.x + (dx / len) * step, player.z + (dz / len) * step);
            return 'chasing';
          }

          window.__attack__?.();
          return 'fighting';
        }, goal),
      { timeout: timeoutMs, intervals: [400, 600, 800, 1000] }
    )
    .toBe('done');
}

test('progression loop: starter kit, equip sword, level 2, buy potion', async ({ page }, testInfo) => {
  test.setTimeout(180_000);

  await page.addInitScript(() => localStorage.removeItem('nj.characterId'));
  await gotoGame(page, testInfo);
  await waitReady(page);

  await page.waitForFunction(() => window.__GAME_STATE__?.adena === 1000, undefined, {
    timeout: 20_000,
  });

  await page.waitForFunction(() => (window.__GAME_STATE__?.npcs?.length ?? 0) >= 2, undefined, {
    timeout: 20_000,
  });

  await walkTowardInPeaceZone(page, { x: 4, z: 10 }, 2.5);

  await page.waitForFunction(
    () =>
      window.__GAME_STATE__?.nearbyNpcId === 30006 &&
      window.__GAME_STATE__?.canInteract === true,
    undefined,
    { timeout: 20_000 }
  );

  await page.waitForFunction(() => typeof window.__npcAction__ === 'function');

  await expect
    .poll(
      async () =>
        page.evaluate((npcId) => {
          if ((window.__GAME_STATE__.items[2369] ?? 0) < 1) {
            window.__npcAction__?.(npcId, 'starterKit');
          }
          return window.__GAME_STATE__.items[2369] ?? 0;
        }, ROXXY_NPC_ID),
      { timeout: 30_000, intervals: [300, 500, 1000] }
    )
    .toBeGreaterThanOrEqual(1);

  await page.waitForFunction(() => typeof window.__equipItem__ === 'function');
  await page.evaluate((itemId) => window.__equipItem__?.(itemId), SQUIRES_SWORD_ITEM_ID);

  await expect
    .poll(async () => page.evaluate(() => window.__GAME_STATE__.equippedWeaponId), {
      timeout: 15_000,
      intervals: [200, 400, 800],
    })
    .toBe(SQUIRES_SWORD_ITEM_ID);

  await page.waitForFunction(() => (window.__GAME_STATE__?.mobs?.length ?? 0) > 0, undefined, {
    timeout: 20_000,
  });

  await killUntilProgress(page, 'first-xp');
  await killUntilProgress(page, 'level-2');

  await expect
    .poll(async () => page.evaluate(() => window.__GAME_STATE__.player.level), {
      timeout: 10_000,
      intervals: [200, 400, 800],
    })
    .toBe(2);

  await walkTowardInPeaceZone(page, { x: -6, z: -8 }, 2.8);

  await page.waitForFunction(() => window.__GAME_STATE__?.canInteract === true, undefined, {
    timeout: 15_000,
  });

  await page.evaluate((npcId) => window.__interact__?.(npcId), KATERINA_NPC_ID);

  await page.waitForFunction(() => window.__GAME_STATE__?.shopOpen === true, undefined, {
    timeout: 10_000,
  });

  await page.waitForFunction(() => typeof window.__buyItem__ === 'function');
  await page.evaluate((npcId) => window.__buyItem__?.(npcId, 1060, 1), KATERINA_NPC_ID);

  await expect
    .poll(async () => page.evaluate(() => window.__GAME_STATE__.adena), {
      timeout: 15_000,
      intervals: [200, 400, 800],
    })
    .toBe(897);

  const final = await page.evaluate(() => {
    const state = window.__GAME_STATE__;
    return {
      equippedWeaponId: state.equippedWeaponId,
      level: state.player.level,
      potionCount: state.items[1060] ?? 0,
      adena: state.adena,
    };
  });

  expect(final.equippedWeaponId).toBe(SQUIRES_SWORD_ITEM_ID);
  expect(final.level).toBe(2);
  expect(final.potionCount).toBeGreaterThanOrEqual(1);
  expect(final.adena).toBe(897);

  const hudLevel = await page.evaluate(() =>
    document.querySelector('#player-vitals-hud [data-role="level"]')?.textContent?.trim()
  );
  expect(hudLevel).toBe('Lv.2');
});
