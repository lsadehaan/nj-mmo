import { ArraySchema } from '@colyseus/schema';
import { EQUIP_SLOTS, type EquipSlot } from '@nj/game-core';
import type { EquipmentRow } from '../db/equipment-repository';

export const EQUIP_ARRAY_LEN = EQUIP_SLOTS.length;

export function equipmentToArrays(rows: EquipmentRow[]): {
  equipSlotIds: number[];
  equipItemIds: number[];
  equipEnchantLevels: number[];
} {
  const equipSlotIds = Array.from({ length: EQUIP_ARRAY_LEN }, (_, i) => i);
  const equipItemIds = Array(EQUIP_ARRAY_LEN).fill(0);
  const equipEnchantLevels = Array(EQUIP_ARRAY_LEN).fill(0);
  for (const row of rows) {
    const idx = EQUIP_SLOTS.indexOf(row.slot as EquipSlot);
    if (idx < 0) continue;
    equipItemIds[idx] = row.itemId;
    equipEnchantLevels[idx] = row.enchantLevel;
  }
  return { equipSlotIds, equipItemIds, equipEnchantLevels };
}

export function syncEquipArrays(
  equipSlotIds: ArraySchema<number>,
  equipItemIds: ArraySchema<number>,
  equipEnchantLevels: ArraySchema<number>,
  rows: EquipmentRow[]
): void {
  const arrays = equipmentToArrays(rows);
  equipSlotIds.clear();
  equipItemIds.clear();
  equipEnchantLevels.clear();
  for (let i = 0; i < EQUIP_ARRAY_LEN; i++) {
    equipSlotIds.push(arrays.equipSlotIds[i]!);
    equipItemIds.push(arrays.equipItemIds[i]!);
    equipEnchantLevels.push(arrays.equipEnchantLevels[i]!);
  }
}

export function weaponItemIdFromEquipment(rows: EquipmentRow[]): number | null {
  const rhand = rows.find((r) => r.slot === 'rhand');
  if (rhand) return rhand.itemId;
  const lrhand = rows.find((r) => r.slot === 'lrhand');
  return lrhand?.itemId ?? null;
}
