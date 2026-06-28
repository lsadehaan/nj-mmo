import { test, expect } from '@playwright/test';
import { gotoGame } from './game-page';

async function clickGround(page: import('@playwright/test').Page, xRatio = 0.5, yRatio = 0.85) {
  await page.waitForFunction(() => typeof window.__handleGroundClick__ === 'function');
  await page.evaluate(
    ({ xRatio, yRatio }) => {
      const canvas = document.getElementById('game') as HTMLCanvasElement;
      const rect = canvas.getBoundingClientRect();
      window.__handleGroundClick__?.(
        rect.left + rect.width * xRatio,
        rect.top + rect.height * yRatio
      );
    },
    { xRatio, yRatio }
  );
}

async function waitReady(page: import('@playwright/test').Page) {
  await page.waitForFunction(() => window.__GAME_STATE__?.ready === true, undefined, {
    timeout: 30_000,
  });
}

test('browser B sees remote player as mesh with move then idle action', async ({ browser }, testInfo) => {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  try {
    await gotoGame(pageA, testInfo);
    await gotoGame(pageB, testInfo);
    await waitReady(pageA);
    await waitReady(pageB);

    await pageB.waitForFunction(
      () => {
        const other = window.__GAME_STATE__?.others?.[0];
        return other?.renderKind === 'mesh';
      },
      undefined,
      { timeout: 15_000 }
    );

    await clickGround(pageA, 0.35, 0.85);

    await pageB.waitForFunction(
      () => window.__GAME_STATE__?.others?.some((o) => o.action === 'move') === true,
      undefined,
      { timeout: 20_000 }
    );

    await pageB.waitForFunction(
      () => window.__GAME_STATE__?.others?.some((o) => o.action === 'idle') === true,
      undefined,
      { timeout: 20_000 }
    );

    const others = await pageB.evaluate(() => window.__GAME_STATE__.others);
    expect(others.length).toBeGreaterThanOrEqual(1);
    expect(others[0].renderKind).toBe('mesh');
    expect(['move', 'idle']).toContain(others[0].action);
  } finally {
    await contextA.close();
    await contextB.close();
  }
});
