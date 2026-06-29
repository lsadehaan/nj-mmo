import { test, expect } from '@playwright/test';
import { gotoGame } from './game-page';

const TI_NPC_IDS = [30001, 30002, 30003, 30004, 30005, 30006, 30026] as const;
const LECTOR_NPC_ID = 30001;

async function waitReady(page: import('@playwright/test').Page) {
  await page.waitForFunction(() => window.__GAME_STATE__?.ready === true, undefined, {
    timeout: 30_000,
  });
}

async function walkTowardInPeaceZone(
  page: import('@playwright/test').Page,
  target: { x: number; z: number },
  arriveWithin: number,
  timeoutMs = 30_000
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
      { timeout: timeoutMs, intervals: [200, 400, 800] }
    )
    .toBe(true);
}

test('seven TI NPCs render as rigged meshes idling at join (TINPC-31–33)', async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  await page.addInitScript(() => localStorage.removeItem('nj.characterId'));
  await gotoGame(page, testInfo);
  await waitReady(page);

  await expect
    .poll(async () => page.evaluate(() => window.__GAME_STATE__?.npcs?.length ?? 0), {
      timeout: 15_000,
      intervals: [200, 400, 800],
    })
    .toBeGreaterThanOrEqual(7);

  const npcs = await page.evaluate(() => window.__GAME_STATE__.npcs);
  for (const npcId of TI_NPC_IDS) {
    const entry = npcs.find((npc) => npc.npcId === npcId);
    expect(entry?.renderKind).toBe('mesh');
    expect(entry?.action).toBe('idle');
  }
});

test('buying Short Sword at Lector updates adena to 117 (TINPC-34–35)', async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  await page.addInitScript(() => localStorage.removeItem('nj.characterId'));
  await gotoGame(page, testInfo);
  await waitReady(page);

  await expect
    .poll(async () => page.evaluate(() => window.__GAME_STATE__?.adena ?? 0), {
      timeout: 15_000,
      intervals: [200, 400],
    })
    .toBe(1000);

  await walkTowardInPeaceZone(page, { x: -14, z: -2 }, 2.8);

  await expect
    .poll(async () => page.evaluate(() => window.__GAME_STATE__?.canInteract === true), {
      timeout: 15_000,
      intervals: [200, 400],
    })
    .toBe(true);

  await page.waitForFunction(() => typeof window.__interact__ === 'function');
  await page.evaluate((npcId) => window.__interact__?.(npcId), LECTOR_NPC_ID);

  await expect
    .poll(async () => page.evaluate(() => window.__GAME_STATE__?.shopOpen === true), {
      timeout: 10_000,
      intervals: [200, 400],
    })
    .toBe(true);

  await expect
    .poll(
      async () =>
        page.evaluate((npcId) => {
          const npc = window.__GAME_STATE__.npcs.find((entry) => entry.npcId === npcId);
          return npc?.action ?? null;
        }, LECTOR_NPC_ID),
      { timeout: 2_000, intervals: [50, 100, 200] }
    )
    .toBe('cast');

  await page.waitForFunction(() => typeof window.__buyItem__ === 'function');
  await page.evaluate((npcId) => window.__buyItem__?.(npcId, 1, 1), LECTOR_NPC_ID);

  await expect
    .poll(async () => page.evaluate(() => window.__GAME_STATE__.adena), {
      timeout: 15_000,
      intervals: [200, 400],
    })
    .toBe(117);

  const domAdena = await page.evaluate(() =>
    document.querySelector('#shop-window [data-adena]')?.textContent?.trim()
  );
  expect(domAdena).toBe('117');
});
