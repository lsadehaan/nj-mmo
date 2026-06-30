import { describe, it, expect } from 'vitest';
import type { ExperienceCurveRow } from '../experience';
import { grantXpCapped, removeXp, TI_LEVEL_CAP } from './experience-cap';

const CAP_CURVE: ExperienceCurveRow[] = [
  { level: 1, xpToNextLevel: 0 },
  { level: 2, xpToNextLevel: 68 },
  { level: 10, xpToNextLevel: 48230 },
  { level: 11, xpToNextLevel: 71203 },
  { level: 19, xpToNextLevel: 675597 },
  { level: 20, xpToNextLevel: 835864 },
  { level: 21, xpToNextLevel: 1023785 },
];

describe('removeXp (PROG27-03, PROG27-04)', () => {
  it('PROG27-03: delevels 11→10 on large XP removal', () => {
    expect(removeXp(11, 72000, 10000, CAP_CURVE, { delevelMin: 10 })).toEqual({
      level: 10,
      xp: 62000,
    });
  });

  it('PROG27-04: stays level 10 on small XP removal', () => {
    expect(removeXp(10, 50000, 500, CAP_CURVE, { delevelMin: 10 })).toEqual({
      level: 10,
      xp: 49500,
    });
  });
});

describe('grantXpCapped (PROG27-15)', () => {
  it('PROG27-15: caps level at 20 when grant would exceed cap', () => {
    expect(grantXpCapped(19, 800000, 50000, CAP_CURVE)).toEqual({
      level: 20,
      xp: 835864,
    });
    expect(grantXpCapped(20, 835864, 100000, CAP_CURVE)).toEqual({
      level: 20,
      xp: 935864,
    });
    expect(TI_LEVEL_CAP).toBe(20);
  });
});
