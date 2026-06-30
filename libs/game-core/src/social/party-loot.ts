import type { SeededRng } from '../seeded-rng';

export interface DropStack {
  itemId: number;
  count: number;
}

export function assignPartyDrops(
  drops: DropStack[],
  eligibleSessionIds: string[],
  rng: SeededRng
): Map<string, DropStack[]> {
  const result = new Map<string, DropStack[]>();
  if (eligibleSessionIds.length === 0 || drops.length === 0) return result;

  for (const drop of drops) {
    const idx = rng.nextInt(0, eligibleSessionIds.length - 1);
    const sessionId = eligibleSessionIds[idx]!;
    const existing = result.get(sessionId) ?? [];
    existing.push({ itemId: drop.itemId, count: drop.count });
    result.set(sessionId, existing);
  }

  return result;
}
