import { eq, and } from 'drizzle-orm';
import type { AppDatabase } from './client';
import { characterEquipment } from './schema';
import type { EquipSlot } from '@nj/game-core';

export type EquipmentRow = {
  slot: EquipSlot;
  itemId: number;
  enchantLevel: number;
};

export function loadEquipment(db: AppDatabase, characterId: string): EquipmentRow[] {
  const rows = db
    .select()
    .from(characterEquipment)
    .where(eq(characterEquipment.characterId, characterId))
    .all();
  return rows.map((r) => ({
    slot: r.slot as EquipSlot,
    itemId: r.itemId,
    enchantLevel: r.enchantLevel,
  }));
}

export function saveEquipmentSlot(
  db: AppDatabase,
  characterId: string,
  slot: EquipSlot,
  itemId: number,
  enchantLevel: number
): void {
  db.insert(characterEquipment)
    .values({ characterId, slot, itemId, enchantLevel })
    .onConflictDoUpdate({
      target: [characterEquipment.characterId, characterEquipment.slot],
      set: { itemId, enchantLevel },
    })
    .run();
}

export function clearEquipmentSlot(
  db: AppDatabase,
  characterId: string,
  slot: EquipSlot
): void {
  db.delete(characterEquipment)
    .where(
      and(
        eq(characterEquipment.characterId, characterId),
        eq(characterEquipment.slot, slot)
      )
    )
    .run();
}

export function saveAllEquipment(
  db: AppDatabase,
  characterId: string,
  rows: EquipmentRow[]
): void {
  db.delete(characterEquipment)
    .where(eq(characterEquipment.characterId, characterId))
    .run();
  if (rows.length === 0) return;
  db.insert(characterEquipment)
    .values(
      rows.map((r) => ({
        characterId,
        slot: r.slot,
        itemId: r.itemId,
        enchantLevel: r.enchantLevel,
      }))
    )
    .run();
}

export function migrateLegacyWeapon(
  db: AppDatabase,
  characterId: string,
  weaponItemId: number | null | undefined
): void {
  if (!weaponItemId) return;
  const existing = loadEquipment(db, characterId);
  if (existing.some((e) => e.slot === 'rhand')) return;
  saveEquipmentSlot(db, characterId, 'rhand', weaponItemId, 0);
}

export function updateEnchantLevel(
  db: AppDatabase,
  characterId: string,
  slot: EquipSlot,
  enchantLevel: number
): void {
  db.update(characterEquipment)
    .set({ enchantLevel })
    .where(
      and(
        eq(characterEquipment.characterId, characterId),
        eq(characterEquipment.slot, slot)
      )
    )
    .run();
}
