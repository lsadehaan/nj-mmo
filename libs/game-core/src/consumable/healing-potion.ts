export const HEALING_POTION_ITEM_ID = 1060;
/** Skill 2031: power 8 × ticks 3 */
export const HEALING_POTION_HEAL_AMOUNT = 24;
/** Item 1060 reuse_delay */
export const HEALING_POTION_REUSE_MS = 10_000;

export function applyConsumableHeal(params: {
  hp: number;
  maxHp: number;
  healAmount: number;
}): number {
  return Math.min(params.maxHp, params.hp + params.healAmount);
}

export type ConsumableUseFailure = {
  ok: false;
  error: 'not_consumable' | 'not_owned' | 'reuse_cooldown' | 'dead' | 'unknown_item';
};

export type ConsumableUseSuccess = {
  ok: true;
  hp: number;
  itemCount: number;
  cooldownEndMs: number;
};

export function validateConsumableUse(params: {
  itemId: number;
  itemType: string | undefined;
  ownedCount: number;
  hp: number;
  nowMs: number;
  cooldownEndMs: number;
}): ConsumableUseSuccess | ConsumableUseFailure {
  if (params.hp <= 0) {
    return { ok: false, error: 'dead' };
  }

  if (params.itemType === undefined) {
    return { ok: false, error: 'unknown_item' };
  }

  if (params.itemType !== 'consumable') {
    return { ok: false, error: 'not_consumable' };
  }

  if (params.ownedCount <= 0) {
    return { ok: false, error: 'not_owned' };
  }

  if (params.nowMs < params.cooldownEndMs) {
    return { ok: false, error: 'reuse_cooldown' };
  }

  return { ok: true, hp: params.hp, itemCount: params.ownedCount, cooldownEndMs: params.cooldownEndMs };
}

export function resolveConsumableUse(params: {
  itemId: number;
  itemType: string | undefined;
  ownedCount: number;
  hp: number;
  maxHp: number;
  healAmount: number;
  reuseMs: number;
  nowMs: number;
  cooldownEndMs: number;
}): ConsumableUseSuccess | ConsumableUseFailure {
  const validation = validateConsumableUse({
    itemId: params.itemId,
    itemType: params.itemType,
    ownedCount: params.ownedCount,
    hp: params.hp,
    nowMs: params.nowMs,
    cooldownEndMs: params.cooldownEndMs,
  });

  if (!validation.ok) {
    return validation;
  }

  const hp = applyConsumableHeal({
    hp: params.hp,
    maxHp: params.maxHp,
    healAmount: params.healAmount,
  });

  return {
    ok: true,
    hp,
    itemCount: params.ownedCount - 1,
    cooldownEndMs: params.nowMs + params.reuseMs,
  };
}
