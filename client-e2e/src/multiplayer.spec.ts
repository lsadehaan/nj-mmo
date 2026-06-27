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

test('browser B sees browser A move in __GAME_STATE__.others', async ({ browser }, testInfo) => {
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

test('browser B stops seeing browser A after consented leave', async ({ browser }, testInfo) => {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  try {
    await gotoGame(pageB, testInfo);
    await waitReady(pageB);

    const othersBeforeA = await pageB.evaluate(() =>
      (window.__GAME_STATE__?.others ?? []).map((o) => o.id)
    );

    await gotoGame(pageA, testInfo);
    await waitReady(pageA);

    const aIdOnB = await pageB.waitForFunction(
      (before) => {
        const current = (window.__GAME_STATE__?.others ?? []).map((o) => o.id);
        const newcomers = current.filter((id) => !before.includes(id));
        return newcomers.length === 1 ? newcomers[0] : null;
      },
      othersBeforeA,
      { timeout: 15_000 }
    );
    const leaverId = (await aIdOnB.jsonValue()) as string;
    expect(leaverId).toBeTruthy();

    await pageA.waitForFunction(() => typeof window.__consentLeave__ === 'function');
    await pageA.evaluate(async () => {
      await window.__consentLeave__!();
    });

    await expect
      .poll(
        async () =>
          pageB.evaluate(
            (id) => (window.__GAME_STATE__?.others ?? []).some((o) => o.id === id),
            leaverId
          ),
        { timeout: 20_000, intervals: [100, 250, 500] }
      )
      .toBe(false);
  } finally {
    await contextA.close();
    await contextB.close();
  }
});

test('rejoining with the same characterId restores saved position', async ({ browser }, testInfo) => {
  test.setTimeout(60_000);
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await gotoGame(page, testInfo);
    await waitReady(page);

    await page.waitForFunction(() => typeof window.__sendMoveIntent__ === 'function');

    await expect
      .poll(
        async () =>
          page.evaluate(() => {
            const player = window.__GAME_STATE__.player;
            const target = { x: 8, z: 6 };
            const dist = Math.hypot(player.x - target.x, player.z - target.z);
            if (dist <= 1.2) return Math.hypot(player.x, player.z);
            const dx = target.x - player.x;
            const dz = target.z - player.z;
            const len = Math.hypot(dx, dz) || 1;
            window.__sendMoveIntent__?.(
              player.x + (dx / len) * Math.min(4, len),
              player.z + (dz / len) * Math.min(4, len)
            );
            return 0;
          }),
        { timeout: 45_000, intervals: [250, 500, 1000] }
      )
      .toBeGreaterThan(3);

    await page.waitForTimeout(1000);

    const snapshot = await page.evaluate(() => ({
      player: { ...window.__GAME_STATE__.player },
      characterId: window.__GAME_STATE__.characterId,
    }));

    expect(snapshot.characterId).toBeTruthy();

    await page.waitForFunction(() => typeof window.__consentLeave__ === 'function');
    await page.evaluate(async () => {
      await window.__consentLeave__?.();
    });
    await page.waitForTimeout(500);

    await page.close();

    const page2 = await context.newPage();
    await gotoGame(page2, testInfo);
    await waitReady(page2);

    await page2.waitForFunction(
      (expectedId) => window.__GAME_STATE__?.characterId === expectedId,
      snapshot.characterId,
      { timeout: 15_000 }
    );

    await expect
      .poll(
        async () =>
          page2.evaluate((expected) => {
            const p = window.__GAME_STATE__?.player;
            if (!p) return Number.POSITIVE_INFINITY;
            return Math.hypot(p.x - expected.x, p.z - expected.z);
          }, { x: snapshot.player.x, z: snapshot.player.z }),
        { timeout: 25_000, intervals: [250, 500, 1000] }
      )
      .toBeLessThan(0.75);

    const restored = await page2.evaluate(() => window.__GAME_STATE__.player);
    expect(restored.x).toBeCloseTo(snapshot.player.x, 0);
    expect(restored.z).toBeCloseTo(snapshot.player.z, 0);
  } finally {
    await context.close();
  }
});
