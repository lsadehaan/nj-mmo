import { describe, it, expect } from 'vitest';
import { isInMeleeRange, horizontalDistance } from './combat-range';
import { STARTER_COMBAT } from './starter-combat';

describe('horizontalDistance', () => {
  it('measures XZ plane distance', () => {
    expect(horizontalDistance(0, 0, 3, 4)).toBe(5);
  });
});

describe('isInMeleeRange', () => {
  const range = STARTER_COMBAT.meleeRange;

  it('is true at 3.9 units', () => {
    expect(isInMeleeRange(0, 0, 3.9, 0, range)).toBe(true);
  });

  it('is true at exactly 4.0 units', () => {
    expect(isInMeleeRange(0, 0, 4.0, 0, range)).toBe(true);
  });

  it('is false at 4.1 units', () => {
    expect(isInMeleeRange(0, 0, 4.1, 0, range)).toBe(false);
  });
});
