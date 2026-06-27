import { type Page, type TestInfo } from '@playwright/test';

/**
 * Build the game URL for a test, scoped to a per-test room instance. Every test
 * gets its own isolated `town` room (via the `?room=` key the client forwards to
 * the server's `filterBy(['instanceKey'])`), so combat, mob, and player state
 * never bleed across tests. This is what makes the e2e suite parallel-safe and
 * removes the need for serial ordering hacks.
 *
 * Both browser pages inside a single multiplayer test share one key (same
 * `testInfo`), so they still meet in the same room.
 */
export function gameUrl(testInfo: TestInfo, base = '/'): string {
  const key = `e2e-${testInfo.testId}`;
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}room=${encodeURIComponent(key)}`;
}

/** Navigate a page to its per-test isolated game room. */
export async function gotoGame(page: Page, testInfo: TestInfo, base = '/'): Promise<void> {
  await page.goto(gameUrl(testInfo, base));
}
