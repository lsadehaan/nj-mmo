/** Sum inventory weight from stack counts × per-item weight (equipped excluded by caller). */
export function calcInventoryWeight(
  items: Readonly<Record<number, number>>,
  weightByItemId: Readonly<Record<number, number>>
): number {
  let total = 0;
  for (const [itemIdStr, count] of Object.entries(items)) {
    if (count <= 0) continue;
    const itemId = Number(itemIdStr);
    const w = weightByItemId[itemId] ?? 0;
    total += w * count;
  }
  return total;
}

/** L2J MAX_LOAD: floor(con × 69000 / 1000). Human Fighter CON 43 → 2967. */
export function calcMaxLoad(con: number): number {
  return Math.floor((con * 69000) / 1000);
}

/** Unique stack rows with count > 0 (matches grid slot pressure). */
export function countInventorySlots(items: Readonly<Record<number, number>>): number {
  return Object.values(items).filter((c) => c > 0).length;
}
