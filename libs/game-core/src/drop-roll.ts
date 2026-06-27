import type { SeededRng } from './seeded-rng';

export interface DropRow {
  itemId: number;
  minCount: number;
  maxCount: number;
  /** Drop chance on a 0–100 scale (L2J percentage). */
  chance: number;
}

export interface DropResult {
  itemId: number;
  count: number;
}

/** Goblin (npcId 20003) adena drop — first `nextFloat` ≈ 0.50, then `nextInt(13,30)` → 22. */
export const GOBLIN_ADENA_DROP_SEED = 150338;

export const GOBLIN_ADENA_DROP_ROW: DropRow = {
  itemId: 57,
  minCount: 13,
  maxCount: 30,
  chance: 70,
};

export function rollDrops(dropRows: DropRow[], rng: SeededRng): DropResult[] {
  const results: DropResult[] = [];

  for (const row of dropRows) {
    const roll = rng.nextFloat() * 100;
    if (roll >= row.chance) continue;

    results.push({
      itemId: row.itemId,
      count: rng.nextInt(row.minCount, row.maxCount),
    });
  }

  return results;
}
