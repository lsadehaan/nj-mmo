import { test, expect } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

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

test('browser B sees browser A move in __GAME_STATE__.others', async ({ browser }) => {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  try {
    await pageA.goto('/');
    await pageB.goto('/');
    await waitReady(pageA);
    await waitReady(pageB);

    await pageB.waitForFunction(
      () => (window.__GAME_STATE__?.others?.length ?? 0) >= 1,
      undefined,
      { timeout: 15_000 }
    );

    const othersBefore = await pageB.evaluate(() =>
      window.__GAME_STATE__.others.map((o) => ({ id: o.id, x: o.x, z: o.z }))
    );

    await clickGround(pageA, 0.35, 0.85);

    await pageA.waitForFunction(
      () => {
        const p = window.__GAME_STATE__?.player;
        return p != null && Math.hypot(p.x, p.z) > 1;
      },
      undefined,
      { timeout: 15_000 }
    );

    await pageB.waitForFunction(
      (before) => {
        const after = window.__GAME_STATE__?.others ?? [];
        return after.some((o) => {
          const prev = before.find((p) => p.id === o.id);
          return prev != null && (prev.x !== o.x || prev.z !== o.z);
        });
      },
      othersBefore,
      { timeout: 20_000 }
    );

    const othersAfter = await pageB.evaluate(() => window.__GAME_STATE__.others);
    const moved = othersAfter.find((o) => {
      const prev = othersBefore.find((p) => p.id === o.id);
      return prev != null && (prev.x !== o.x || prev.z !== o.z);
    });
    expect(moved).toBeDefined();
  } finally {
    await contextA.close();
    await contextB.close();
  }
});

test('rejoining with the same characterId restores saved position', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto('/');
    await waitReady(page);

    await clickGround(page, 0.65, 0.85);

    await page.waitForFunction(
      () => {
        const p = window.__GAME_STATE__?.player;
        if (!p) return false;
        return Math.hypot(p.x, p.z) > 1;
      },
      undefined,
      { timeout: 15_000 }
    );

    const snapshot = await page.evaluate(() => ({
      player: { ...window.__GAME_STATE__.player },
      characterId: window.__GAME_STATE__.characterId,
    }));

    expect(snapshot.characterId).toBeTruthy();

    await page.close();

    const page2 = await context.newPage();
    await page2.goto('/');
    await waitReady(page2);

    await page2.waitForFunction(
      (expectedId) => window.__GAME_STATE__?.characterId === expectedId,
      snapshot.characterId,
      { timeout: 10_000 }
    );

    const restored = await page2.evaluate(() => window.__GAME_STATE__.player);
    expect(restored.x).toBeCloseTo(snapshot.player.x, 0);
    expect(restored.z).toBeCloseTo(snapshot.player.z, 0);
  } finally {
    await context.close();
  }
});
