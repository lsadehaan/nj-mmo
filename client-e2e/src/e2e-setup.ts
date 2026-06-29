import { expect, type Page } from '@playwright/test';
import { pickNearestCombatMob } from './peace-zone';

/** Combat placement outside village peace zone (matches room-integration tests). */
export const OUT_OF_PEACE = { x: 30, z: -30 };

export async function waitReady(page: Page): Promise<void> {
  await page.waitForFunction(() => window.__GAME_STATE__?.ready === true, undefined, {
    timeout: 10_000,
  });
}

export async function hurtPlayer(page: Page, amount: number): Promise<void> {
  await page.waitForFunction(() => typeof window.__e2eDamage__ === 'function');
  await page.evaluate((amt) => window.__e2eDamage__?.(amt), amount);
}

export async function setupNearNpc(
  page: Page,
  npcId: number,
  radius = 2.5
): Promise<void> {
  await page.waitForFunction(() => typeof window.__e2eTeleport__ === 'function');
  const target = await page.evaluate((id) => {
    const npc = window.__GAME_STATE__.npcs.find((entry) => entry.npcId === id);
    if (!npc) throw new Error(`NPC ${id} not found in __GAME_STATE__`);
    return { x: npc.x, z: npc.z };
  }, npcId);

  await page.evaluate(({ x, z }) => window.__e2eTeleport__?.(x, z), target);

  await expect
    .poll(async () => page.evaluate(() => window.__GAME_STATE__.canInteract), {
      timeout: 8_000,
      intervals: [200, 400, 800],
    })
    .toBe(true);
}

export async function setupNearMob(
  page: Page,
  mobId?: string,
  range = 3.4
): Promise<string> {
  await page.waitForFunction(() => (window.__GAME_STATE__?.mobs?.length ?? 0) > 0, undefined, {
    timeout: 8_000,
  });
  await page.waitForFunction(() => typeof window.__e2eTeleport__ === 'function');

  const resolvedMobId =
    mobId ??
    (await page.evaluate(() => {
      const state = window.__GAME_STATE__;
      const mob = pickNearestCombatMob(
        state.mobs.map((m) => ({ id: m.id, x: m.x, z: m.z, hp: m.hp })),
        { x: state.player.x, z: state.player.z }
      );
      return mob.id;
    }));

  const mobPos = await page.evaluate((id) => {
    const mob = window.__GAME_STATE__.mobs.find((m) => m.id === id)!;
    return { x: mob.x, z: mob.z };
  }, resolvedMobId);

  await page.evaluate(
    ({ id, pos }) => {
      window.__e2eFreezeMob__?.(id);
      window.__e2eTeleport__?.(pos.x, pos.z);
    },
    { id: resolvedMobId, pos: mobPos }
  );

  await page.waitForFunction(() => typeof window.__handleMobTarget__ === 'function');
  await page.evaluate((id) => window.__handleMobTarget__?.(id), resolvedMobId);

  await expect
    .poll(
      async () =>
        page.evaluate(
          ({ id, range }) => {
            const state = window.__GAME_STATE__;
            const mob = state.mobs.find((m) => m.id === id);
            if (!mob) return true;
            const dist = Math.hypot(state.player.x - mob.x, state.player.z - mob.z);
            return dist <= range;
          },
          { id: resolvedMobId, range }
        ),
      { timeout: 8_000, intervals: [200, 400, 800] }
    )
    .toBe(true);

  return resolvedMobId;
}

export async function claimStarterKit(
  page: Page,
  roxxyNpcId = 30006,
  potionItemId = 1060
): Promise<void> {
  await page.waitForFunction(() => window.__GAME_STATE__?.adena === 1000, undefined, {
    timeout: 8_000,
  });
  await setupNearNpc(page, roxxyNpcId);
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
          { npcId: roxxyNpcId, itemId: potionItemId }
        ),
      { timeout: 8_000, intervals: [200, 400, 800] }
    )
    .toBe(3);
}
