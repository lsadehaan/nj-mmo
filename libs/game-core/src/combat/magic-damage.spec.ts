import { describe, it, expect } from 'vitest';
import { calcMagicSkillDamage, applyShotMultiplier } from './magic-damage';
import { GREMLIN_COMBAT } from './starter-combat';

describe('calcMagicSkillDamage', () => {
  // SKILL20-28
  it('Wind Strike L1 deals 40 vs Gremlin with mAtk 8 and rng offset 0', () => {
    const damage = calcMagicSkillDamage(
      { mAtk: 8 },
      { mDef: GREMLIN_COMBAT.pDef },
      12,
      { rngOffset: 0 }
    );
    expect(damage).toBe(40);
  });

  it('Wind Strike + spiritshot deals 80', () => {
    const base = calcMagicSkillDamage(
      { mAtk: 8 },
      { mDef: GREMLIN_COMBAT.pDef },
      12,
      { rngOffset: 0 }
    );
    expect(applyShotMultiplier(base, 2)).toBe(80);
  });
});

describe('applyShotMultiplier', () => {
  // SKILL20-33
  it('applies 2x soulshot multiplier', () => {
    expect(applyShotMultiplier(71, 2)).toBe(142);
  });
});
