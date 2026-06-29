import { describe, it, expect } from 'vitest';
import { calcClassBasePAtk, calcClassBaseMAtk } from './class-combat';
import { calcMeleeDamage, calcPhysicalSkillDamage } from '../combat/melee-damage';
import { GREMLIN_COMBAT } from '../combat/starter-combat';
import {
  applyClassLevelUpReward,
  classVitalsAtLevel,
  type ClassVitalsRow,
} from './class-vitals';

const HUMAN_FIGHTER_CURVE: ClassVitalsRow[] = [
  { level: 1, hp: 80, mp: 30 },
  { level: 2, hp: 91.83, mp: 35.46 },
];

describe('calcClassBasePAtk', () => {
  it('Human Fighter naked pAtk at level 1 is 5 (CHAR19-08)', () => {
    expect(calcClassBasePAtk({ basePAtk: 4, baseStr: 40 }, 1)).toBe(5);
  });

  it('Human Mystic naked pAtk at level 1 is 2 (CHAR19-09)', () => {
    expect(calcClassBasePAtk({ basePAtk: 3, baseStr: 22 }, 1)).toBe(2);
  });
});

describe('calcClassBaseMAtk', () => {
  it('Human Mystic naked mAtk at level 1 is 8 (SKILL20-28)', () => {
    expect(calcClassBaseMAtk({ baseMAtk: 6, baseInt: 19 }, 1)).toBe(8);
  });
});

describe('class skill damage anchors', () => {
  // SKILL20-21
  it('Power Strike L1 deals 71 with class pAtk 11 vs Gremlin', () => {
    const damage = calcPhysicalSkillDamage(
      { pAtk: 11, randomDamage: 10 },
      { pDef: GREMLIN_COMBAT.pDef },
      30,
      { rngOffset: 0 }
    );
    expect(damage).toBe(71);
  });

  // SKILL20-23
  it('Iron Punch L1 deals 72 with Orc naked pAtk 8 vs Gremlin', () => {
    const damage = calcPhysicalSkillDamage(
      { pAtk: 8, randomDamage: 10 },
      { pDef: GREMLIN_COMBAT.pDef },
      34,
      { rngOffset: 0 }
    );
    expect(damage).toBe(Math.floor((77 * (8 + 34)) / GREMLIN_COMBAT.pDef));
    expect(damage).toBe(72);
  });
});

describe('class melee damage anchors', () => {
  it('Human Fighter naked vs Gremlin deals 8 (CHAR19-10)', () => {
    const pAtk = calcClassBasePAtk({ basePAtk: 4, baseStr: 40 }, 1);
    const damage = calcMeleeDamage(
      { pAtk, randomDamage: 10 },
      { pDef: GREMLIN_COMBAT.pDef },
      { rngOffset: 0 }
    );
    expect(damage).toBe(8);
  });

  it('Human Mystic naked vs Gremlin deals 3 (CHAR19-11)', () => {
    const pAtk = calcClassBasePAtk({ basePAtk: 3, baseStr: 22 }, 1);
    const damage = calcMeleeDamage(
      { pAtk, randomDamage: 10 },
      { pDef: GREMLIN_COMBAT.pDef },
      { rngOffset: 0 }
    );
    expect(damage).toBe(3);
  });
});

describe('classVitalsAtLevel', () => {
  it('Human Fighter level 1 vitals (CHAR19-12)', () => {
    expect(classVitalsAtLevel(HUMAN_FIGHTER_CURVE, 1)).toEqual({ maxHp: 80, maxMp: 30 });
  });
});

describe('applyClassLevelUpReward', () => {
  it('Human Fighter 1→2 restores full HP/MP from curve (CHAR19-13)', () => {
    const result = applyClassLevelUpReward(
      1,
      2,
      { maxHp: 80, maxMp: 30, hp: 40, mp: 10 },
      HUMAN_FIGHTER_CURVE
    );
    expect(result.maxHp).toBeCloseTo(91.83, 2);
    expect(result.maxMp).toBeCloseTo(35.46, 2);
    expect(result.hp).toBeCloseTo(91.83, 2);
    expect(result.mp).toBeCloseTo(35.46, 2);
  });
});
