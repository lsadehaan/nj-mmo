import { describe, it, expect } from 'vitest';
import { grantXp, type ExperienceCurveRow } from './experience';

const TEST_CURVE: ExperienceCurveRow[] = [
  { level: 1, xpToNextLevel: 0 },
  { level: 2, xpToNextLevel: 68 },
  { level: 3, xpToNextLevel: 364 },
];

describe('grantXp', () => {
  it('grants 44 xp at level 1 without leveling up', () => {
    expect(grantXp(1, 0, 44, TEST_CURVE)).toEqual({ level: 1, xp: 44 });
  });

  it('levels to 2 at cumulative 88 xp', () => {
    expect(grantXp(1, 44, 44, TEST_CURVE)).toEqual({ level: 2, xp: 88 });
  });

  it('can level multiple times in one grant', () => {
    expect(grantXp(1, 0, 400, TEST_CURVE)).toEqual({ level: 3, xp: 400 });
  });

  it('preserves level when xp stays below the next threshold', () => {
    expect(grantXp(2, 88, 10, TEST_CURVE)).toEqual({ level: 2, xp: 98 });
  });

  it('handles zero xp grant', () => {
    expect(grantXp(1, 44, 0, TEST_CURVE)).toEqual({ level: 1, xp: 44 });
  });
});
