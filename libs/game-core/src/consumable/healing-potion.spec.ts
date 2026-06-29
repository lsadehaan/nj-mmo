import { describe, it, expect } from 'vitest';
import {
  HEALING_POTION_HEAL_AMOUNT,
  HEALING_POTION_ITEM_ID,
  HEALING_POTION_REUSE_MS,
  applyConsumableHeal,
  resolveConsumableUse,
  validateConsumableUse,
} from './healing-potion';

describe('healing potion consumable logic', () => {
  it('anchors heal amount to skill 2031 (8 × 3)', () => {
    expect(HEALING_POTION_HEAL_AMOUNT).toBe(24);
  });

  it('anchors reuse delay to item 1060', () => {
    expect(HEALING_POTION_REUSE_MS).toBe(10_000);
  });

  it('applies heal without exceeding maxHp', () => {
    expect(
      applyConsumableHeal({ hp: 50, maxHp: 100, healAmount: HEALING_POTION_HEAL_AMOUNT })
    ).toBe(74);
  });

  it('caps heal at maxHp', () => {
    expect(
      applyConsumableHeal({ hp: 90, maxHp: 100, healAmount: HEALING_POTION_HEAL_AMOUNT })
    ).toBe(100);
  });

  it('rejects non-consumable item type', () => {
    expect(
      validateConsumableUse({
        itemId: 2369,
        itemType: 'weapon',
        ownedCount: 1,
        hp: 50,
        nowMs: 0,
        cooldownEndMs: 0,
      })
    ).toEqual({ ok: false, error: 'not_consumable' });
  });

  it('rejects when player does not own the item', () => {
    expect(
      validateConsumableUse({
        itemId: HEALING_POTION_ITEM_ID,
        itemType: 'consumable',
        ownedCount: 0,
        hp: 50,
        nowMs: 0,
        cooldownEndMs: 0,
      })
    ).toEqual({ ok: false, error: 'not_owned' });
  });

  it('rejects while reuse cooldown is active', () => {
    expect(
      validateConsumableUse({
        itemId: HEALING_POTION_ITEM_ID,
        itemType: 'consumable',
        ownedCount: 1,
        hp: 50,
        nowMs: 5_000,
        cooldownEndMs: 10_000,
      })
    ).toEqual({ ok: false, error: 'reuse_cooldown' });
  });

  it('rejects when player is dead', () => {
    expect(
      validateConsumableUse({
        itemId: HEALING_POTION_ITEM_ID,
        itemType: 'consumable',
        ownedCount: 1,
        hp: 0,
        nowMs: 0,
        cooldownEndMs: 0,
      })
    ).toEqual({ ok: false, error: 'dead' });
  });

  it('resolves successful use with heal, decrement, and cooldown', () => {
    expect(
      resolveConsumableUse({
        itemId: HEALING_POTION_ITEM_ID,
        itemType: 'consumable',
        ownedCount: 2,
        hp: 50,
        maxHp: 100,
        healAmount: HEALING_POTION_HEAL_AMOUNT,
        reuseMs: HEALING_POTION_REUSE_MS,
        nowMs: 1_000,
        cooldownEndMs: 0,
      })
    ).toEqual({
      ok: true,
      hp: 74,
      itemCount: 1,
      cooldownEndMs: 11_000,
    });
  });
});
