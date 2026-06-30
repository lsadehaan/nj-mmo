import { describe, it, expect } from 'vitest';
import { calcClassBasePAtk } from '../class/class-combat';
import {
  calcEffectivePAtk,
  calcPlayerPDef,
  calcClassBasePDef,
} from './equipment-stats';
import { calcArmorSetBonus } from './armor-sets';
import { enchantPAtkBonus, enchantPDefBonus, canEnchant } from './enchant';

describe('equipment-stats', () => {
  const humanFighter = { basePAtk: 4, baseStr: 40, baseCon: 43 };

  it('adds Broadsword +11 pAtk over naked Human Fighter L1 (ITEM25-26)', () => {
    const base = calcClassBasePAtk(humanFighter, 1);
    const withWeapon = calcEffectivePAtk(base, { pAtk: 11, weaponType: 'SWORD', bodyPart: 'rhand' }, 0);
    expect(withWeapon - base).toBe(11);
  });

  it('adds Wooden Breastplate +47 pDef (ITEM25-27)', () => {
    const base = calcClassBasePDef(humanFighter, 1);
    const { pDef } = calcPlayerPDef(base, [{ itemId: 23, pDef: 47, enchantLevel: 0 }], [23]);
    expect(pDef - base).toBe(47);
  });

  it('applies +3 D-grade 1H enchant +12 pAtk (ITEM25-28, ITEM25-48)', () => {
    expect(enchantPAtkBonus('SWORD', 'rhand', 3)).toBe(12);
    const base = calcClassBasePAtk(humanFighter, 1);
    const pAtk = calcEffectivePAtk(
      base,
      { pAtk: 24, weaponType: 'SWORD', bodyPart: 'rhand' },
      3
    );
    expect(pAtk - base).toBe(24 + 12);
  });

  it('applies +3 armor enchant +3 pDef (ITEM25-29)', () => {
    expect(enchantPDefBonus(3)).toBe(3);
  });

  it('applies Wooden set +41 maxHp and +2% pDef (ITEM25-30)', () => {
    const base = calcClassBasePDef(humanFighter, 1);
    const pieces = [
      { itemId: 23, pDef: 47, enchantLevel: 0 },
      { itemId: 2386, pDef: 29, enchantLevel: 0 },
      { itemId: 43, pDef: 19, enchantLevel: 0 },
    ];
    const rawSum = base + 47 + 29 + 19;
    const partial = calcPlayerPDef(base, pieces, [23, 2386]);
    const fullSet = calcPlayerPDef(base, pieces, [23, 2386, 43]);
    expect(fullSet.maxHpBonus).toBe(41);
    expect(fullSet.pDef).toBe(Math.floor(rawSum * 1.02));
    expect(fullSet.pDef).toBeGreaterThan(partial.pDef);
  });
});

describe('enchant', () => {
  it('rejects NG Broadsword (ITEM25-47)', () => {
    expect(
      canEnchant({ crystalType: null, enchantEnabled: false, type: 'weapon' }, 955, 0)
    ).toBe('not_enchantable');
  });

  it('rejects grade mismatch scroll on NG item (ITEM25-46)', () => {
    expect(
      canEnchant({ crystalType: null, enchantEnabled: false, type: 'weapon' }, 955, 0)
    ).toBe('not_enchantable');
  });

  it('rejects +4 attempt (ITEM25-45)', () => {
    expect(
      canEnchant({ crystalType: 'D', enchantEnabled: true, type: 'weapon' }, 955, 3)
    ).toBe('max_safe_enchant');
  });
});
