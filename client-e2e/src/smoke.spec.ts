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

test('does not integrate movement locally before server updates', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.__GAME_STATE__?.ready === true, undefined, {
    timeout: 30_000,
  });

  const initial = await page.evaluate(() => ({ ...window.__GAME_STATE__.player }));

  await page.waitForFunction(() => typeof window.__handleGroundClick__ === 'function');

  const afterClick = await page.evaluate((start) => {
    const canvas = document.getElementById('game') as HTMLCanvasElement;
    const rect = canvas.getBoundingClientRect();
    window.__handleGroundClick__?.(rect.left + rect.width * 0.5, rect.top + rect.height * 0.85);
    const state = window.__GAME_STATE__;
    return {
      targetSet: state.target.x !== null && state.target.z !== null,
      stationary:
        state.player.x === start.x &&
        state.player.z === start.z,
      localMovementTicks: state.localMovementTicks,
    };
  }, initial);

  expect(afterClick.targetSet).toBe(true);
  expect(afterClick.stationary).toBe(true);
  expect(afterClick.localMovementTicks).toBe(0);

  await page.waitForFunction(
    (start) => {
      const p = window.__GAME_STATE__?.player;
      if (!p || !start) return false;
      return p.x !== start.x || p.z !== start.z;
    },
    initial,
    { timeout: 10_000 }
  );

  const afterServer = await page.evaluate(() => window.__GAME_STATE__.localMovementTicks);
  expect(afterServer).toBe(0);
});
