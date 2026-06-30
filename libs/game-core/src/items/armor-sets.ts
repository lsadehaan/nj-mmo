export type ArmorSetDef = {
  setId: number;
  requiredItemIds: number[];
  pDefPercentBonus: number;
  maxHpBonus: number;
};

export const TI_ARMOR_SETS: ArmorSetDef[] = [
  { setId: 0, requiredItemIds: [23, 2386, 43], pDefPercentBonus: 0.02, maxHpBonus: 41 },
  { setId: 1, requiredItemIds: [58, 59, 47], pDefPercentBonus: 0.05, maxHpBonus: 0 },
];

export type SetBonus = {
  pDefPercentBonus: number;
  maxHpBonus: number;
};

export function calcArmorSetBonus(equippedItemIds: number[]): SetBonus {
  const equipped = new Set(equippedItemIds);
  let pDefPercentBonus = 0;
  let maxHpBonus = 0;
  for (const set of TI_ARMOR_SETS) {
    if (set.requiredItemIds.every((id) => equipped.has(id))) {
      pDefPercentBonus += set.pDefPercentBonus;
      maxHpBonus += set.maxHpBonus;
    }
  }
  return { pDefPercentBonus, maxHpBonus };
}
