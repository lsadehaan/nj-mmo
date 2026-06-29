import { test, expect } from '@playwright/test';
import { isMobAttackableFromPeaceZone, peaceZoneAttackPosition } from './peace-zone';
import { gotoGame } from './game-page';

const KATERINA_NPC_ID = 30004;
const ROXXY_NPC_ID = 30006;

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

function pickPeaceZoneCombatMob(
  mobs: Array<{ id: string; x: number; z: number; hp?: number }>
) {
  const reachable = mobs.filter((mob) => isMobAttackableFromPeaceZone(mob) && (mob.hp ?? 0) > 0);
  return (
    reachable.find((entry) => entry.x === 22 && entry.z === -14) ??
    reachable.find((entry) => entry.x === 22 && entry.z === -16) ??
    reachable.find((entry) => entry.x > 20 && entry.z < 0) ??
    reachable[0]
  );
}

async function walkToPeaceZoneAttackRange(
  page: import('@playwright/test').Page,
  mob: { x: number; z: number }
): Promise<void> {
  const target = peaceZoneAttackPosition(mob);
  await walkTowardInPeaceZone(page, target, 1.5);
}

test('environment props report mesh counts on game test hook after ready', async ({ page }, testInfo) => {
  await page.addInitScript(() => localStorage.removeItem('nj.characterId'));
  await gotoGame(page, testInfo);
  await waitReady(page);

  await expect
    .poll(async () => page.evaluate(() => window.__GAME_STATE__?.environment?.loaded ?? false), {
      timeout: 30_000,
      intervals: [200, 400, 800],
    })
    .toBe(true);

  const environment = await page.evaluate(() => window.__GAME_STATE__.environment);
  expect(environment).toEqual({
    buildings: { count: 5, renderKind: 'mesh' },
    scatter: { count: 80, renderKind: 'mesh' },
    peaceZone: { count: 1, renderKind: 'mesh' },
    loaded: true,
  });

  expect(await page.evaluate(() => window.__GAME_STATE__.ready)).toBe(true);
});

test('town NPCs render as rigged meshes idling at join', async ({ page }, testInfo) => {
  await page.addInitScript(() => localStorage.removeItem('nj.characterId'));
  await gotoGame(page, testInfo);
  await waitReady(page);

  await page.waitForFunction(() => (window.__GAME_STATE__?.npcs?.length ?? 0) >= 2, undefined, {
    timeout: 20_000,
  });

  const npcs = await page.evaluate(() => window.__GAME_STATE__.npcs);
  const katerina = npcs.find((npc) => npc.npcId === KATERINA_NPC_ID);
  const roxxy = npcs.find((npc) => npc.npcId === ROXXY_NPC_ID);
  expect(katerina?.renderKind).toBe('mesh');
  expect(roxxy?.renderKind).toBe('mesh');
  expect(katerina?.action).toBe('idle');
  expect(roxxy?.action).toBe('idle');
});

test('buying Healing Potion at Katerina updates adena 1000 to 897', async ({ page }, testInfo) => {
  await page.addInitScript(() => localStorage.removeItem('nj.characterId'));
  await gotoGame(page, testInfo);
  await waitReady(page);

  await page.waitForFunction(() => window.__GAME_STATE__?.adena === 1000, undefined, {
    timeout: 20_000,
  });

  await page.waitForFunction(() => (window.__GAME_STATE__?.npcs?.length ?? 0) >= 2, undefined, {
    timeout: 20_000,
  });

  await walkTowardInPeaceZone(page, { x: -6, z: -8 }, 2.8);

  await page.waitForFunction(() => window.__GAME_STATE__?.canInteract === true, undefined, {
    timeout: 15_000,
  });

  await page.waitForFunction(() => typeof window.__interact__ === 'function');
  await page.evaluate((npcId) => window.__interact__?.(npcId), KATERINA_NPC_ID);

  await page.waitForFunction(() => window.__GAME_STATE__?.shopOpen === true, undefined, {
    timeout: 10_000,
  });

  await expect
    .poll(
      async () =>
        page.evaluate((npcId) => {
          const npc = window.__GAME_STATE__.npcs.find((entry) => entry.npcId === npcId);
          return npc?.action ?? null;
        }, KATERINA_NPC_ID),
      { timeout: 2_000, intervals: [50, 100, 200] }
    )
    .toBe('cast');

  const shopVisible = await page.evaluate(
    () => document.getElementById('shop-window')?.hidden === false
  );
  expect(shopVisible).toBe(true);

  await expect(
    page.locator('#shop-window img[src*="healing-potion"]')
  ).toBeVisible();
  await expect(
    page.locator('#power-strike-cooldown img[data-icon-skill-id="3"]')
  ).toBeVisible();

  await page.waitForFunction(() => typeof window.__buyItem__ === 'function');
  await page.evaluate(
    (npcId) => window.__buyItem__?.(npcId, 1060, 1),
    KATERINA_NPC_ID
  );

  await expect
    .poll(async () => page.evaluate(() => window.__GAME_STATE__.adena), {
      timeout: 15_000,
      intervals: [200, 400, 800],
    })
    .toBe(897);

  const itemCount = await page.evaluate(() => window.__GAME_STATE__.items[1060] ?? 0);
  expect(itemCount).toBeGreaterThanOrEqual(1);

  const domAdena = await page.evaluate(() =>
    document.querySelector('#shop-window [data-adena]')?.textContent?.trim()
  );
  expect(domAdena).toBe('897');
});

test('opening Roxxy helper dialog triggers greet cast animation', async ({ page }, testInfo) => {
  await page.addInitScript(() => localStorage.removeItem('nj.characterId'));
  await gotoGame(page, testInfo);
  await waitReady(page);

  await page.waitForFunction(() => (window.__GAME_STATE__?.npcs?.length ?? 0) >= 2, undefined, {
    timeout: 20_000,
  });

  await walkTowardInPeaceZone(page, { x: 4, z: 10 }, 2.8);

  await page.waitForFunction(() => window.__GAME_STATE__?.canInteract === true, undefined, {
    timeout: 15_000,
  });

  await page.waitForFunction(() => typeof window.__interact__ === 'function');
  await page.evaluate((npcId) => window.__interact__?.(npcId), ROXXY_NPC_ID);

  await page.waitForFunction(
    () => document.getElementById('npc-dialog')?.hidden === false,
    undefined,
    { timeout: 10_000 }
  );

  await expect
    .poll(
      async () =>
        page.evaluate((npcId) => {
          const npc = window.__GAME_STATE__.npcs.find((entry) => entry.npcId === npcId);
          return npc?.action ?? null;
        }, ROXXY_NPC_ID),
      { timeout: 2_000, intervals: [50, 100, 200] }
    )
    .toBe('cast');
});

test('attack inside peace zone does not reduce mob HP or grant XP', async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  await page.addInitScript(() => localStorage.removeItem('nj.characterId'));
  await gotoGame(page, testInfo);
  await waitReady(page);

  await page.waitForFunction(() => (window.__GAME_STATE__?.mobs?.length ?? 0) > 0, undefined, {
    timeout: 20_000,
  });

  const mobs = await page.evaluate(() =>
    window.__GAME_STATE__.mobs.map((entry) => ({
      id: entry.id,
      x: entry.x,
      z: entry.z,
      hp: entry.hp,
    }))
  );
  const mob = pickPeaceZoneCombatMob(mobs);
  if (!mob) throw new Error('No peace-zone-reachable mob for combat e2e');

  await walkToPeaceZoneAttackRange(page, mob);

  const inPeaceZone = await page.evaluate(() => {
    const { x, z } = window.__GAME_STATE__.player;
    return x >= -20 && x <= 20 && z >= -20 && z <= 20;
  });
  expect(inPeaceZone).toBe(true);

  const before = await page.evaluate((mobId) => {
    const state = window.__GAME_STATE__;
    const target = state.mobs.find((entry) => entry.id === mobId);
    return { hp: target?.hp ?? -1, xp: state.player.xp };
  }, mob.id);

  expect(before.hp).toBeGreaterThan(0);

  await page.waitForFunction(() => typeof window.__handleMobTarget__ === 'function');
  await page.evaluate((mobId) => window.__handleMobTarget__?.(mobId), mob.id);

  await page.waitForFunction(
    (mobId) => window.__GAME_STATE__?.targetMobId === mobId,
    mob.id,
    { timeout: 5_000 }
  );

  await page.waitForFunction(() => typeof window.__attack__ === 'function');

  await expect
    .poll(
      async () =>
        page.evaluate((mobId) => {
          window.__attack__?.();
          const state = window.__GAME_STATE__;
          const target = state.mobs.find((entry) => entry.id === mobId);
          return {
            hp: target?.hp ?? -1,
            xp: state.player.xp,
          };
        }, mob.id),
      { timeout: 8_000, intervals: [400, 600] }
    )
    .toEqual({ hp: before.hp, xp: before.xp });
});

test('Power Strike inside peace zone does not reduce mob HP or spend MP', async ({
  page,
}, testInfo) => {
  test.setTimeout(60_000);
  await page.addInitScript(() => localStorage.removeItem('nj.characterId'));
  await gotoGame(page, testInfo);
  await waitReady(page);

  await page.waitForFunction(() => (window.__GAME_STATE__?.mobs?.length ?? 0) > 0, undefined, {
    timeout: 20_000,
  });

  const mobs = await page.evaluate(() =>
    window.__GAME_STATE__.mobs.map((entry) => ({
      id: entry.id,
      x: entry.x,
      z: entry.z,
      hp: entry.hp,
    }))
  );
  const mob = pickPeaceZoneCombatMob(mobs);
  if (!mob) throw new Error('No peace-zone-reachable mob for combat e2e');

  await walkToPeaceZoneAttackRange(page, mob);

  const before = await page.evaluate((mobId) => {
    const state = window.__GAME_STATE__;
    const { x, z } = state.player;
    const inPeaceZone = x >= -20 && x <= 20 && z >= -20 && z <= 20;
    const target = state.mobs.find((entry) => entry.id === mobId);
    return {
      inPeaceZone,
      hp: target?.hp ?? -1,
      mp: state.player.mp,
      xp: state.player.xp,
    };
  }, mob.id);

  expect(before.inPeaceZone).toBe(true);
  expect(before.hp).toBeGreaterThan(0);
  expect(before.mp).toBe(50);

  await page.waitForFunction(() => typeof window.__handleMobTarget__ === 'function');
  await page.evaluate((mobId) => window.__handleMobTarget__?.(mobId), mob.id);

  await page.waitForFunction(
    (mobId) => window.__GAME_STATE__?.targetMobId === mobId,
    mob.id,
    { timeout: 5_000 }
  );

  await page.waitForFunction(() => typeof window.__useSkill__ === 'function');

  await expect
    .poll(
      async () =>
        page.evaluate((mobId) => {
          window.__useSkill__?.();
          const state = window.__GAME_STATE__;
          const target = state.mobs.find((entry) => entry.id === mobId);
          return {
            hp: target?.hp ?? -1,
            mp: state.player.mp,
            xp: state.player.xp,
          };
        }, mob.id),
      { timeout: 8_000, intervals: [400, 600] }
    )
    .toEqual({ hp: before.hp, mp: before.mp, xp: before.xp });
});
