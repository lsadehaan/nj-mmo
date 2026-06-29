import { describe, it, expect } from 'vitest';
import { isInRangedAttackBand, shouldRangedMobAdvance } from './ranged-mob-ai';

describe('ranged mob AI helpers', () => {
  const minRange = 4;
  const maxRange = 8;

  it('chases when beyond preferred attack range (BEST22-45)', () => {
    expect(shouldRangedMobAdvance(10, minRange, maxRange)).toBe(true);
    expect(shouldRangedMobAdvance(8.1, minRange, maxRange)).toBe(true);
  });

  it('holds when inside ranged attack band (BEST22-46)', () => {
    expect(shouldRangedMobAdvance(6, minRange, maxRange)).toBe(false);
    expect(isInRangedAttackBand(6, minRange, maxRange)).toBe(true);
    expect(isInRangedAttackBand(4, minRange, maxRange)).toBe(true);
    expect(isInRangedAttackBand(8, minRange, maxRange)).toBe(true);
  });

  it('does not treat out-of-band distances as hold band', () => {
    expect(isInRangedAttackBand(3.9, minRange, maxRange)).toBe(false);
    expect(isInRangedAttackBand(8.1, minRange, maxRange)).toBe(false);
  });
});
