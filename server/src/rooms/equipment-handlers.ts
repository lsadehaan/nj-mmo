import {
  validateEquip,
  validateUnequip,
  canCraft,
  applyCraft,
  canEnchant,
  rollEnchant,
  type EquipSlot,
  EQUIP_SLOTS,
} from '@nj/game-core';
import type { Item, Recipe } from '../db/schema';
import type { EquipmentRow } from '../db/equipment-repository';
import type { CharacterItemCounts } from '../db/character-repository';

export function applyEquipTransaction(params: {
  itemId: number;
  item: Item | undefined;
  inventory: CharacterItemCounts;
  equipment: EquipmentRow[];
}): { equipment: EquipmentRow[]; inventory: CharacterItemCounts } | null {
  if (!params.item) return null;
  const result = validateEquip({
    item: {
      itemId: params.itemId,
      type: params.item.type,
      bodyPart: params.item.bodyPart,
    },
    ownedCount: params.inventory[params.itemId] ?? 0,
    equipment: params.equipment,
  });
  if (!result.ok) return null;

  const inventory = { ...params.inventory };
  inventory[params.itemId] = (inventory[params.itemId] ?? 0) - 1;
  if (inventory[params.itemId] <= 0) delete inventory[params.itemId];

  for (const returnedId of result.returnedItemIds) {
    inventory[returnedId] = (inventory[returnedId] ?? 0) + 1;
  }

  let equipment = params.equipment.filter(
    (e) => !result.clearedSlots.includes(e.slot) && e.slot !== result.targetSlot
  );
  equipment.push({ slot: result.targetSlot, itemId: params.itemId, enchantLevel: 0 });
  equipment = equipment.sort(
    (a, b) => EQUIP_SLOTS.indexOf(a.slot) - EQUIP_SLOTS.indexOf(b.slot)
  );
  return { equipment, inventory };
}

export function applyUnequipTransaction(params: {
  slot: EquipSlot;
  equipment: EquipmentRow[];
  inventory: CharacterItemCounts;
  inventoryFull?: boolean;
}): { equipment: EquipmentRow[]; inventory: CharacterItemCounts } | null {
  const result = validateUnequip({
    slot: params.slot,
    equipment: params.equipment,
    inventoryFull: params.inventoryFull,
  });
  if (!result.ok) return null;
  const inventory = { ...params.inventory };
  inventory[result.itemId] = (inventory[result.itemId] ?? 0) + 1;
  const equipment = params.equipment.filter((e) => e.slot !== params.slot);
  return { equipment, inventory };
}

export function buildCraftRecipe(
  recipe: Recipe,
  recipeItemId: number
): import('@nj/game-core').CraftRecipe {
  return {
    recipeId: recipe.recipeId,
    mpCost: recipe.mpCost,
    successRate: recipe.successRate,
    productItemId: recipe.productItemId,
    productCount: recipe.productCount,
    recipeItemId,
    ingredients: JSON.parse(recipe.ingredientsJson) as { itemId: number; count: number }[],
  };
}

export function applyEnchantTransaction(params: {
  slot: EquipSlot;
  scrollItemId: number;
  item: Item;
  equipment: EquipmentRow[];
  inventory: CharacterItemCounts;
  rng: () => number;
}): { equipment: EquipmentRow[]; inventory: CharacterItemCounts } | null {
  const row = params.equipment.find((e) => e.slot === params.slot);
  if (!row) return null;
  const reject = canEnchant(
    {
      crystalType: params.item.crystalType,
      enchantEnabled: params.item.enchantEnabled,
      type: params.item.type,
    },
    params.scrollItemId,
    row.enchantLevel
  );
  if (reject) return null;
  if ((params.inventory[params.scrollItemId] ?? 0) < 1) return null;
  if (!rollEnchant(row.enchantLevel, params.rng)) return null;

  const inventory = { ...params.inventory };
  inventory[params.scrollItemId] = (inventory[params.scrollItemId] ?? 0) - 1;
  if (inventory[params.scrollItemId] <= 0) delete inventory[params.scrollItemId];

  const equipment = params.equipment.map((e) =>
    e.slot === params.slot ? { ...e, enchantLevel: e.enchantLevel + 1 } : e
  );
  return { equipment, inventory };
}
