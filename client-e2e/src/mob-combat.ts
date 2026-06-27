import { expect, type Page } from '@playwright/test';

/**
 * Approach a mob by id until the player is within `range` metres of the mob's
 * LIVE position. Mobs wander (server-side AI), so chasing a stale snapshot
 * position is unreliable — this always reads the mob's current position from
 * `__GAME_STATE__` and re-issues a move intent toward it. Resolves once in range
 * (or once the mob no longer exists, i.e. it died).
 */
export async function approachMob(
  page: Page,
  mobId: string,
  range: number,
  timeoutMs = 90_000
): Promise<void> {
  await page.waitForFunction(() => typeof window.__sendMoveIntent__ === 'function');
  await expect
    .poll(
      async () =>
        page.evaluate(
          ({ mobId, range }) => {
            const state = window.__GAME_STATE__;
            const mob = state.mobs.find((m) => m.id === mobId);
            if (!mob) return true;
            const p = state.player;
            const dist = Math.hypot(p.x - mob.x, p.z - mob.z);
            if (dist <= range) return true;
            const dx = mob.x - p.x;
            const dz = mob.z - p.z;
            const len = Math.hypot(dx, dz) || 1;
            const step = Math.max(1, Math.min(len - range + 0.5, 6));
            window.__sendMoveIntent__?.(p.x + (dx / len) * step, p.z + (dz / len) * step);
            return false;
          },
          { mobId, range }
        ),
      { timeout: timeoutMs, intervals: [200, 400, 800] }
    )
    .toBe(true);
}
