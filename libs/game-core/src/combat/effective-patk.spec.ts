import { describe, it, expect } from 'vitest';
import { effectivePAtk } from './effective-patk';
import { calcMeleeDamage } from './melee-damage';
import { STARTER_COMBAT, GREMLIN_COMBAT } from './starter-combat';

describe('effectivePAtk', () => {
  it('returns 16 when Squire\'s Sword (pAtk 6) is equipped on base 10', () => {
    expect(effectivePAtk(10, 2369, 6)).toBe(16);
  });

  it('returns base pAtk when no weapon is equipped', () => {
    expect(effectivePAtk(STARTER_COMBAT.pAtk, null, undefined)).toBe(10);
    expect(effectivePAtk(STARTER_COMBAT.pAtk, 0, 6)).toBe(10);
  });

  it('returns base pAtk when weapon stats are missing', () => {
    expect(effectivePAtk(10, 2369, undefined)).toBe(10);
  });
});

describe('equipped melee damage anchor', () => {
  it('deals 27 damage with pAtk 16 vs Gremlin and RNG offset 0', () => {
    const pAtk = effectivePAtk(STARTER_COMBAT.pAtk, 2369, 6);
    expect(pAtk).toBe(16);
    const damage = calcMeleeDamage(
      { pAtk, randomDamage: 10 },
      { pDef: GREMLIN_COMBAT.pDef },
      { rngOffset: 0 }
    );
    expect(damage).toBe(27);
  });
});
