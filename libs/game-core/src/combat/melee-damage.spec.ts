import { describe, it, expect } from 'vitest';
import { calcMeleeDamage } from './melee-damage';
import { STARTER_COMBAT, GREMLIN_COMBAT } from './starter-combat';

describe('calcMeleeDamage', () => {
  it('deals 17 damage with starter vs Gremlin and RNG offset 0', () => {
    const damage = calcMeleeDamage(
      { pAtk: STARTER_COMBAT.pAtk, randomDamage: STARTER_COMBAT.randomDamage },
      { pDef: GREMLIN_COMBAT.pDef },
      { rngOffset: 0 }
    );
    expect(damage).toBe(17);
  });

  it('deals 15 damage with starter vs Gremlin and RNG offset -10', () => {
    const damage = calcMeleeDamage(
      { pAtk: STARTER_COMBAT.pAtk, randomDamage: STARTER_COMBAT.randomDamage },
      { pDef: GREMLIN_COMBAT.pDef },
      { rngOffset: -10 }
    );
    expect(damage).toBe(15);
  });

  it('never returns less than 1', () => {
    const damage = calcMeleeDamage(
      { pAtk: 1, randomDamage: 0 },
      { pDef: 9999 },
      { rngOffset: -10 }
    );
    expect(damage).toBe(1);
  });

  it('uses rng.nextDamageOffset when rngOffset is omitted', () => {
    const damage = calcMeleeDamage(
      { pAtk: 10, randomDamage: 0 },
      { pDef: 44.44444 },
      { rng: { nextDamageOffset: () => 0, nextFloat: () => 0, nextInt: () => 0 } }
    );
    expect(damage).toBe(17);
  });
});
