import { describe, it, expect } from 'vitest';
import { applyRestoreExp, calcRestoreExpCost } from './restore-exp';

describe('restoreExp (PROG27-09, PROG27-10)', () => {
  it('PROG27-09: restores XP and deducts adena', () => {
    const result = applyRestoreExp(
      { xp: 47961, expBeforeDeath: 50000, adena: 50000 },
      { costPerXp: 10 }
    );
    expect(result.ok).toBe(true);
    expect(result.xp).toBe(50000);
    expect(result.adena).toBe(50000 - 2039 * 10);
    expect(result.expBeforeDeath).toBe(0);
  });

  it('PROG27-10: rejects when expBeforeDeath <= xp', () => {
    const result = applyRestoreExp(
      { xp: 50000, expBeforeDeath: 50000, adena: 50000 },
      { costPerXp: 10 }
    );
    expect(result.ok).toBe(false);
    expect(result.xp).toBe(50000);
    expect(result.adena).toBe(50000);
  });

  it('rejects insufficient adena', () => {
    const result = applyRestoreExp(
      { xp: 47961, expBeforeDeath: 50000, adena: 100 },
      { costPerXp: 10 }
    );
    expect(result.ok).toBe(false);
    expect(result.xp).toBe(47961);
  });

  it('calcRestoreExpCost uses min 100', () => {
    expect(calcRestoreExpCost(1, 10)).toBe(100);
    expect(calcRestoreExpCost(2039, 10)).toBe(20390);
  });
});
