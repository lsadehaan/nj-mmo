import { eq } from 'drizzle-orm';
import type { AppDatabase } from './client';
import { warehouseItems } from './schema';

export type WarehouseItemCounts = Record<number, number>;

export function loadWarehouseItems(
  db: AppDatabase,
  characterId: string
): WarehouseItemCounts {
  const rows = db
    .select()
    .from(warehouseItems)
    .where(eq(warehouseItems.characterId, characterId))
    .all();
  const counts: WarehouseItemCounts = {};
  for (const row of rows) {
    if (row.count > 0) counts[row.itemId] = row.count;
  }
  return counts;
}

export function saveWarehouseItems(
  db: AppDatabase,
  characterId: string,
  items: WarehouseItemCounts
): void {
  db.delete(warehouseItems)
    .where(eq(warehouseItems.characterId, characterId))
    .run();
  const rows = Object.entries(items)
    .map(([itemId, count]) => ({
      characterId,
      itemId: Number(itemId),
      count,
    }))
    .filter((row) => row.count > 0);
  if (rows.length === 0) return;
  db.insert(warehouseItems).values(rows).run();
}

export function countDistinctWarehouseItems(items: WarehouseItemCounts): number {
  return Object.values(items).filter((c) => c > 0).length;
}
