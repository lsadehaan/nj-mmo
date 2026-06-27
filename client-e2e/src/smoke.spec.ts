import { test, expect } from '@playwright/test';

test('mounts canvas and connects to the server', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('#game')).toBeVisible();
  await page.waitForFunction(() => window.__GAME_STATE__?.connected === true, undefined, {
    timeout: 30_000,
  });
});

test('clicking the ground moves the player via game state hook', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.__GAME_STATE__?.ready === true, undefined, {
    timeout: 30_000,
  });

  const initial = await page.evaluate(() => ({ ...window.__GAME_STATE__.player }));

  const canvas = page.locator('#game');
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();

  await page.waitForFunction(() => typeof window.__handleGroundClick__ === 'function');

  await page.evaluate(() => {
    const canvas = document.getElementById('game') as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    window.__handleGroundClick__?.(rect.left + rect.width * 0.5, rect.top + rect.height * 0.85);
  });

  await page.waitForFunction(
    () =>
      window.__GAME_STATE__?.target?.x !== null && window.__GAME_STATE__?.target?.z !== null,
    undefined,
    { timeout: 5_000 }
  );

  await page.waitForFunction(
    (start) => {
      const p = window.__GAME_STATE__?.player;
      if (!p || !start) return false;
      return p.x !== start.x || p.z !== start.z;
    },
    initial,
    { timeout: 10_000 }
  );

  const moved = await page.evaluate(() => window.__GAME_STATE__.player);
  expect(moved.x !== initial.x || moved.z !== initial.z).toBe(true);
});
