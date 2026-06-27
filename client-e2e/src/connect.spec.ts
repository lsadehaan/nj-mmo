import { test, expect } from '@playwright/test';
import { gotoGame } from './game-page';

test('connects to TownRoom and publishes game state hook', async ({ page }, testInfo) => {
  await gotoGame(page, testInfo);

  const connected = await page.waitForFunction(
    () => window.__GAME_STATE__?.connected === true,
    undefined,
    { timeout: 30_000 }
  );

  expect(await connected.jsonValue()).toBe(true);
});
