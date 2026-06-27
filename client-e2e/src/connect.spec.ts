import { test, expect } from '@playwright/test';

test('connects to TownRoom and publishes game state hook', async ({ page }) => {
  await page.goto('/');

  const connected = await page.waitForFunction(
    () => window.__GAME_STATE__?.connected === true,
    undefined,
    { timeout: 30_000 }
  );

  expect(await connected.jsonValue()).toBe(true);
});
