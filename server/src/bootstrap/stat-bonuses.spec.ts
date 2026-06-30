import { describe, it, expect } from 'vitest';
import {
  lookupStrBonus,
  lookupIntBonus,
  lookupDexBonus,
  lookupConBonus,
} from '@nj/game-core';
import { ensureStatBonusesRegistered } from './stat-bonuses';

describe('ensureStatBonusesRegistered', () => {
  it('registers DEX 34 so mob-vs-player hit rolls never throw (live crash regression)', () => {
    ensureStatBonusesRegistered();
    expect(() => lookupDexBonus(34)).not.toThrow();
    expect(lookupDexBonus(34)).toBeCloseTo(1.14, 2);
  });

  it('registers the full combat stat range used per swing', () => {
    ensureStatBonusesRegistered();
    for (let v = 1; v <= 60; v++) {
      expect(() => lookupStrBonus(v), `STR ${v}`).not.toThrow();
      expect(() => lookupIntBonus(v), `INT ${v}`).not.toThrow();
      expect(() => lookupDexBonus(v), `DEX ${v}`).not.toThrow();
      expect(() => lookupConBonus(v), `CON ${v}`).not.toThrow();
    }
  });
});
