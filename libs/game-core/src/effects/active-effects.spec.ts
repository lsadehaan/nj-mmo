import { describe, it, expect } from 'vitest';
import {
  applyBuffSelf,
  applyDebuffEnemy,
  getPatkMultiplier,
  tickActiveEffects,
} from './active-effects';

describe('active effects', () => {
  // SKILL20-38
  it('Might buff applies 1.08 pAtk multiplier', () => {
    const target = { activeEffect: null };
    applyBuffSelf(target, 1068, 1.08, 1200, 0);
    expect(getPatkMultiplier(target)).toBeCloseTo(1.08);
  });

  // SKILL20-39
  it('Curse Weakness debuff applies 0.88 pAtk multiplier', () => {
    const target = { activeEffect: null };
    applyDebuffEnemy(target, 1164, 0.88, 30, 0);
    expect(getPatkMultiplier(target)).toBeCloseTo(0.88);
  });

  // SKILL20-40
  it('effect expires after abnormalTime', () => {
    const target = { activeEffect: null };
    applyBuffSelf(target, 1068, 1.08, 10, 0);
    tickActiveEffects(target, 9999);
    expect(target.activeEffect).not.toBeNull();
    tickActiveEffects(target, 10001);
    expect(target.activeEffect).toBeNull();
    expect(getPatkMultiplier(target)).toBe(1);
  });
});
