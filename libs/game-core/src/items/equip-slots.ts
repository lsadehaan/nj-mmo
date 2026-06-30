/** Paper-doll equip slots for TI MVP (11 keys). */
export const EQUIP_SLOTS = [
  'rhand',
  'lrhand',
  'lhand',
  'chest',
  'legs',
  'feet',
  'gloves',
  'head',
  'neck',
  'earring',
  'ring',
] as const;

export type EquipSlot = (typeof EQUIP_SLOTS)[number];

export const EQUIP_SLOT_INDEX: Record<EquipSlot, number> = Object.fromEntries(
  EQUIP_SLOTS.map((s, i) => [s, i])
) as Record<EquipSlot, number>;

const EQUIPPABLE_TYPES = new Set(['weapon', 'armor', 'accessory']);

export function bodyPartToSlot(bodyPart: string | null | undefined): EquipSlot | null {
  if (!bodyPart) return null;
  if (bodyPart === 'rhand' || bodyPart === 'lrhand' || bodyPart === 'lhand') return bodyPart;
  if (bodyPart === 'chest' || bodyPart === 'legs' || bodyPart === 'feet') return bodyPart;
  if (bodyPart === 'gloves' || bodyPart === 'head' || bodyPart === 'neck') return bodyPart;
  if (bodyPart.includes('ear')) return 'earring';
  if (bodyPart.includes('finger')) return 'ring';
  return null;
}

export type EquipItemMeta = {
  itemId: number;
  type: string;
  bodyPart: string | null;
};

export type EquippedSlot = {
  slot: EquipSlot;
  itemId: number;
};

export type EquipSuccess = {
  ok: true;
  targetSlot: EquipSlot;
  /** Slots cleared because of two-hand / swap rules */
  clearedSlots: EquipSlot[];
  /** Item returned to inventory from occupied slot(s) */
  returnedItemIds: number[];
};

export type EquipFailure = {
  ok: false;
  error: string;
};

export type EquipResult = EquipSuccess | EquipFailure;

export function validateEquip(params: {
  item: EquipItemMeta;
  ownedCount: number;
  equipment: EquippedSlot[];
}): EquipResult {
  if (params.ownedCount < 1) {
    return { ok: false, error: 'not_owned' };
  }
  if (!EQUIPPABLE_TYPES.has(params.item.type)) {
    return { ok: false, error: 'not_equippable' };
  }
  const targetSlot = bodyPartToSlot(params.item.bodyPart);
  if (!targetSlot) {
    return { ok: false, error: 'invalid_slot' };
  }

  const clearedSlots: EquipSlot[] = [];
  const returnedItemIds: number[] = [];

  if (targetSlot === 'lrhand') {
    for (const slot of ['rhand', 'lhand', 'lrhand'] as EquipSlot[]) {
      const occupied = params.equipment.find((e) => e.slot === slot);
      if (occupied && occupied.itemId !== params.item.itemId) {
        clearedSlots.push(slot);
        returnedItemIds.push(occupied.itemId);
      }
    }
  } else if (targetSlot === 'rhand' || targetSlot === 'lhand') {
    const lrhand = params.equipment.find((e) => e.slot === 'lrhand');
    if (lrhand) {
      clearedSlots.push('lrhand');
      returnedItemIds.push(lrhand.itemId);
    }
    const occupied = params.equipment.find((e) => e.slot === targetSlot);
    if (occupied && occupied.itemId !== params.item.itemId) {
      clearedSlots.push(targetSlot);
      returnedItemIds.push(occupied.itemId);
    }
  } else {
    const occupied = params.equipment.find((e) => e.slot === targetSlot);
    if (occupied && occupied.itemId !== params.item.itemId) {
      clearedSlots.push(targetSlot);
      returnedItemIds.push(occupied.itemId);
    }
  }

  return { ok: true, targetSlot, clearedSlots, returnedItemIds };
}

export type UnequipSuccess = { ok: true; itemId: number };
export type UnequipFailure = { ok: false; error: string };
export type UnequipResult = UnequipSuccess | UnequipFailure;

export function validateUnequip(params: {
  slot: EquipSlot;
  equipment: EquippedSlot[];
  inventoryFull?: boolean;
}): UnequipResult {
  const row = params.equipment.find((e) => e.slot === params.slot);
  if (!row) {
    return { ok: false, error: 'empty_slot' };
  }
  if (params.inventoryFull) {
    return { ok: false, error: 'inventory_full' };
  }
  return { ok: true, itemId: row.itemId };
}
