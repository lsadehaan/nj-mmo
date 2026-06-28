import { test, expect } from '@playwright/test';
import { gotoGame } from './game-page';

function isOutsideCentreBuilding(x: number, z: number): boolean {
  return Math.abs(x) > 4 || Math.abs(z + 14) > 3;
}

async function waitReady(page: import('@playwright/test').Page) {
  await page.waitForFunction(() => window.__GAME_STATE__?.ready === true, undefined, {
    timeout: 30_000,
  });
}

test('click-to-move routes around village centre building', async ({ page }, testInfo) => {
  await page.addInitScript(() => localStorage.removeItem('nj.characterId'));
  await gotoGame(page, testInfo);
  await waitReady(page);

  await page.waitForFunction(() => typeof window.__sendMoveIntent__ === 'function');

  const trail: Array<{ x: number; z: number }> = [];

  await page.evaluate(() => {
    window.__sendMoveIntent__?.(0, 20);
  });

  await expect
    .poll(
      async () => {
        const pos = await page.evaluate(() => {
          const { x, z } = window.__GAME_STATE__.player;
          return { x, z };
        });
        trail.push(pos);
        return Math.abs(pos.z - 20) <= 1.5;
      },
      { timeout: 45_000, intervals: [250, 500, 1000] }
    )
    .toBe(true);

  await page.evaluate(() => {
    window.__sendMoveIntent__?.(0, -25);
  });

  await expect
    .poll(
      async () => {
        const pos = await page.evaluate(() => {
          const { x, z } = window.__GAME_STATE__.player;
          return { x, z };
        });
        trail.push(pos);
        return Math.abs(pos.z + 25) <= 1;
      },
      { timeout: 90_000, intervals: [250, 500, 1000] }
    )
    .toBe(true);

  expect(trail.length).toBeGreaterThanOrEqual(5);
  for (const pos of trail) {
    expect(isOutsideCentreBuilding(pos.x, pos.z)).toBe(true);
  }
});
