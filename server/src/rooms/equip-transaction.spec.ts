import { describe, it, expect } from 'vitest';
import { validateEquip, applyEquip } from './equip-transaction';

const SQUIRES_SWORD = 2369;
const POTION = 1060;

describe('equip-transaction', () => {
  it('accepts equipping an owned rhand weapon', () => {
    const result = validateEquip({
      itemId: SQUIRES_SWORD,
      itemType: 'weapon',
      bodyPart: 'rhand',
      ownedCount: 1,
      currentEquippedWeaponItemId: null,
    });

    expect(result).toEqual({ ok: true, equippedWeaponItemId: SQUIRES_SWORD });
    expect(applyEquip(null, result)).toBe(SQUIRES_SWORD);
  });

  it('rejects equipping an item the player does not own', () => {
    const result = validateEquip({
      itemId: SQUIRES_SWORD,
      itemType: 'weapon',
      bodyPart: 'rhand',
      ownedCount: 0,
      currentEquippedWeaponItemId: null,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('not_owned');
      expect(result.equippedWeaponItemId).toBeNull();
    }
    expect(applyEquip(null, result)).toBeNull();
  });

  it('rejects equipping a consumable', () => {
    const result = validateEquip({
      itemId: POTION,
      itemType: 'consumable',
      bodyPart: null,
      ownedCount: 3,
      currentEquippedWeaponItemId: null,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('not_weapon');
      expect(result.equippedWeaponItemId).toBeNull();
    }
    expect(applyEquip(null, result)).toBeNull();
  });

  it('rejects equipping a weapon without rhand body part', () => {
    const result = validateEquip({
      itemId: 9999,
      itemType: 'weapon',
      bodyPart: 'lrhand',
      ownedCount: 1,
      currentEquippedWeaponItemId: null,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('invalid_slot');
      expect(result.equippedWeaponItemId).toBeNull();
    }
  });

  it('leaves the current slot unchanged when validation fails', () => {
    const current = SQUIRES_SWORD;
    const result = validateEquip({
      itemId: POTION,
      itemType: 'consumable',
      bodyPart: null,
      ownedCount: 1,
      currentEquippedWeaponItemId: current,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.equippedWeaponItemId).toBe(current);
    }
    expect(applyEquip(current, result)).toBe(current);
  });
});
