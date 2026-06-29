import { test, expect } from '@playwright/test';
import { pickNearestCombatMob } from './peace-zone';
import { gotoGame } from './game-page';
import { approachMob } from './mob-combat';

const ROXXY_NPC_ID = 30006;
const HEALING_POTION_ITEM_ID = 1060;

async function waitReady(page: import('@playwright/test').Page) {
  await page.waitForFunction(() => window.__GAME_STATE__?.ready === true, undefined, {
    timeout: 30_000,
  });
}

async function walkTowardInPeaceZone(
  page: import('@playwright/test').Page,
  target: { x: number; z: number },
  arriveWithin: number,
  timeoutMs = 20_000
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

async function claimStarterKit(page: import('@playwright/test').Page): Promise<void> {
  await page.waitForFunction(() => window.__GAME_STATE__?.adena === 1000, undefined, {
    timeout: 15_000,
  });
  await page.waitForFunction(() => (window.__GAME_STATE__?.npcs?.length ?? 0) >= 2, undefined, {
    timeout: 15_000,
  });

  await walkTowardInPeaceZone(page, { x: 4, z: 10 }, 2.5);

  await page.waitForFunction(
    (npcId) =>
      window.__GAME_STATE__?.nearbyNpcId === npcId &&
      window.__GAME_STATE__?.canInteract === true,
    ROXXY_NPC_ID,
    { timeout: 15_000 }
  );

  await page.waitForFunction(() => typeof window.__npcAction__ === 'function');

  await expect
    .poll(
      async () =>
        page.evaluate(
          ({ npcId, itemId }) => {
            if ((window.__GAME_STATE__.items[itemId] ?? 0) < 3) {
              window.__npcAction__?.(npcId, 'starterKit');
            }
            return window.__GAME_STATE__.items[itemId] ?? 0;
          },
          { npcId: ROXXY_NPC_ID, itemId: HEALING_POTION_ITEM_ID }
        ),
      { timeout: 15_000, intervals: [300, 500, 800] }
    )
    .toBe(3);
}

/** Walk to nearest field mob and poll until mob retaliation drops player HP. */
async function takeFieldDamage(page: import('@playwright/test').Page): Promise<void> {
  await page.waitForFunction(() => (window.__GAME_STATE__?.mobs?.length ?? 0) > 0, undefined, {
    timeout: 10_000,
  });

  const { mobs, player } = await page.evaluate(() => ({
    mobs: window.__GAME_STATE__.mobs.map((m) => ({
      id: m.id,
      x: m.x,
      z: m.z,
      hp: m.hp,
    })),
    player: {
      x: window.__GAME_STATE__.player.x,
      z: window.__GAME_STATE__.player.z,
    },
  }));
  const mob = pickNearestCombatMob(mobs, player);

  await approachMob(page, mob.id, 2.8, 20_000);

  await page.waitForFunction(() => typeof window.__handleMobTarget__ === 'function');
  await page.evaluate((mobId) => window.__handleMobTarget__?.(mobId), mob.id);

  await expect
    .poll(
      async () =>
        page.evaluate((mobId) => {
          const state = window.__GAME_STATE__;
          const { player, maxHp } = state;
          if (player.hp > 0 && player.hp < maxHp) return true;

          const mob = state.mobs.find((m) => m.id === mobId);
          if (!mob || mob.hp <= 0) return false;

          const dist = Math.hypot(player.x - mob.x, player.z - mob.z);
          if (dist > 3.4) {
            const dx = mob.x - player.x;
            const dz = mob.z - player.z;
            const len = Math.hypot(dx, dz) || 1;
            const step = Math.max(1, Math.min(len - 2.5, 6));
            window.__sendMoveIntent__?.(player.x + (dx / len) * step, player.z + (dz / len) * step);
            return false;
          }

          window.__attack__?.();
          return false;
        }, mob.id),
      { timeout: 15_000, intervals: [200, 400, 800] }
    )
    .toBe(true);
}

test('healing potion restores HP and decrements stack after field damage', async ({ page }, testInfo) => {
  test.setTimeout(30_000);

  await page.addInitScript(() => localStorage.removeItem('nj.characterId'));
  await gotoGame(page, testInfo);
  await waitReady(page);

  await claimStarterKit(page);
  await takeFieldDamage(page);

  const before = await page.evaluate((itemId) => {
    const state = window.__GAME_STATE__;
    return {
      hp: state.player.hp,
      maxHp: state.maxHp,
      count: state.items[itemId] ?? 0,
    };
  }, HEALING_POTION_ITEM_ID);

  await page.waitForFunction(() => typeof window.__useItem__ === 'function');
  await page.evaluate((itemId) => window.__useItem__?.(itemId), HEALING_POTION_ITEM_ID);

  const expectedHp = Math.min(before.maxHp, before.hp + 24);
  const expectedCount = before.count - 1;

  await expect
    .poll(
      async () =>
        page.evaluate(
          ({ expectedHp, expectedCount, itemId }) => {
            const state = window.__GAME_STATE__;
            return (
              state.player.hp === expectedHp &&
              (state.items[itemId] ?? 0) === expectedCount
            );
          },
          { expectedHp, expectedCount, itemId: HEALING_POTION_ITEM_ID }
        ),
      { timeout: 8_000, intervals: [200, 400, 800] }
    )
    .toBe(true);
});

test('second healing potion use within 10s is blocked by reuse cooldown', async ({ page }, testInfo) => {
  test.setTimeout(30_000);

  await page.addInitScript(() => localStorage.removeItem('nj.characterId'));
  await gotoGame(page, testInfo);
  await waitReady(page);

  await claimStarterKit(page);

  await page.waitForFunction(() => typeof window.__useItem__ === 'function');
  await page.evaluate((itemId) => window.__useItem__?.(itemId), HEALING_POTION_ITEM_ID);

  await expect
    .poll(
      async () =>
        page.evaluate(
          (itemId) => (window.__GAME_STATE__.items[itemId] ?? 0) === 2,
          HEALING_POTION_ITEM_ID
        ),
      { timeout: 8_000, intervals: [200, 400, 800] }
    )
    .toBe(true);

  const countAfterFirst = await page.evaluate(
    (itemId) => window.__GAME_STATE__.items[itemId] ?? 0,
    HEALING_POTION_ITEM_ID
  );

  await page.evaluate((itemId) => window.__useItem__?.(itemId), HEALING_POTION_ITEM_ID);

  await expect
    .poll(
      async () =>
        page.evaluate(
          (args) => window.__GAME_STATE__.items[args.itemId] ?? 0,
          { itemId: HEALING_POTION_ITEM_ID, expected: countAfterFirst }
        ),
      { timeout: 3_000, intervals: [100, 200, 400] }
    )
    .toBe(countAfterFirst);
});
