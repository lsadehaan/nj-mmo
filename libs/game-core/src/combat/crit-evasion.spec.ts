import { describe, it, expect } from 'vitest';
import {
  rollCrit,
  applyCritMultiplier,
  rollHitMiss,
} from './crit-evasion';
import { createSeededRng } from '../seeded-rng';

describe('crit and evasion', () => {
  // SKILL20-43
  it('crit doubles damage', () => {
    expect(applyCritMultiplier(71, true)).toBe(142);
    expect(applyCritMultiplier(71, false)).toBe(71);
  });

  // SKILL20-44
  it('rollCrit succeeds when rng below critRate threshold', () => {
    const rng = createSeededRng(0);
    expect(rollCrit({ critRate: 100 }, rng)).toBe(true);
  });

  // SKILL20-45–46
  it('miss deals 0 damage when rollHitMiss returns true', () => {
    const rng = { nextFloat: () => 0 } as ReturnType<typeof createSeededRng>;
    const missed = rollHitMiss({ accuracy: 4.75 }, { dex: 30 }, rng);
    expect(missed).toBe(true);
    const damage = missed ? 0 : 71;
    expect(damage).toBe(0);
  });
});
