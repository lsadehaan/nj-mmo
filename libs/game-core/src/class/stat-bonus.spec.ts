import { describe, it, expect } from 'vitest';
import { lookupStrBonus } from './stat-bonus';

describe('lookupStrBonus', () => {
  it('returns 1.2 for STR 40 (CHAR19-07)', () => {
    expect(lookupStrBonus(40)).toBe(1.2);
  });
});
