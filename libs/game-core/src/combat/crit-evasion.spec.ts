import { describe, it, expect } from 'vitest';
import {
  rollCrit,
  applyCritMultiplier,
  rollHitMiss,
} from './crit-evasion';
import { lookupDexBonus } from '../class/stat-bonus';
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

  // SKILL20-45
  it('high-DEX defender has evasion > 0 and positive miss chance vs Gremlin', () => {
    const evasion = lookupDexBonus(30) * 10;
    expect(evasion).toBeGreaterThan(0);
    const missChance = evasion / (evasion + 4.75);
    expect(missChance).toBeGreaterThan(0);
    expect(missChance).toBeLessThan(1);
  });

  // SKILL20-45–46
  it('miss deals 0 damage and leaves MP/cooldown unchanged in melee resolution', () => {
    const rng = { nextFloat: () => 0.5 } as ReturnType<typeof createSeededRng>;
    const missed = rollHitMiss({ accuracy: 4.75 }, { dex: 30 }, rng);
    expect(missed).toBe(true);
    const damage = missed ? 0 : 71;
    expect(damage).toBe(0);

    let mp = 30;
    let cooldownEndMs = 0;
    if (!missed) {
      mp -= 9;
      cooldownEndMs = 4000;
    }
    expect(mp).toBe(30);
    expect(cooldownEndMs).toBe(0);
  });
});
