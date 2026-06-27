export type EquipSuccess = {
  ok: true;
  equippedWeaponItemId: number;
};

export type EquipFailure = {
  ok: false;
  equippedWeaponItemId: number | null;
  error: string;
};

export type EquipResult = EquipSuccess | EquipFailure;

export function validateEquip(params: {
  itemId: number;
  itemType: string | undefined;
  bodyPart: string | null | undefined;
  ownedCount: number;
  currentEquippedWeaponItemId?: number | null;
}): EquipResult {
  const current = params.currentEquippedWeaponItemId ?? null;

  if (params.ownedCount < 1) {
    return { ok: false, equippedWeaponItemId: current, error: 'not_owned' };
  }

  if (params.itemType !== 'weapon') {
    return { ok: false, equippedWeaponItemId: current, error: 'not_weapon' };
  }

  if (params.bodyPart !== 'rhand') {
    return { ok: false, equippedWeaponItemId: current, error: 'invalid_slot' };
  }

  return { ok: true, equippedWeaponItemId: params.itemId };
}

export function applyEquip(
  currentEquippedWeaponItemId: number | null,
  result: EquipResult
): number | null {
  if (!result.ok) {
    return currentEquippedWeaponItemId;
  }
  return result.equippedWeaponItemId;
}
