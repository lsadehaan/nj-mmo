import { describe, it, expect } from 'vitest';
import {
  allocateStatPoint,
  resetStatPoints,
  statPointsEarnedByLevel,
  effectiveStat,
  isValidStatName,
  awardStatPointOnLevelUp,
} from './stat-points';

describe('stat-points (PROG27-21–24, PROG27-43)', () => {
  const base = {
    unspentStatPoints: 0,
    bonusStr: 0,
    bonusDex: 0,
    bonusCon: 0,
    bonusInt: 0,
    bonusWit: 0,
    bonusMen: 0,
  };

  it('PROG27-21: level 5→6 awards 1 unspent point', () => {
    const result = awardStatPointOnLevelUp(base, 5, 6);
    expect(result.unspentStatPoints).toBe(1);
  });

  it('PROG27-22: allocateStat increases bonus and decreases unspent', () => {
    const result = allocateStatPoint({ ...base, unspentStatPoints: 2 }, 'str');
    expect(result.ok).toBe(true);
    expect(result.state.bonusStr).toBe(1);
    expect(result.state.unspentStatPoints).toBe(1);
  });

  it('PROG27-23: rejects allocate when no unspent points', () => {
    const result = allocateStatPoint(base, 'str');
    expect(result.ok).toBe(false);
  });

  it('PROG27-24: reset refunds all bonuses to unspent', () => {
    const state = {
      ...base,
      unspentStatPoints: 0,
      bonusStr: 3,
      bonusDex: 1,
    };
    const reset = resetStatPoints(state, 12);
    expect(reset.bonusStr).toBe(0);
    expect(reset.bonusDex).toBe(0);
    expect(reset.unspentStatPoints).toBe(11);
    expect(statPointsEarnedByLevel(12)).toBe(11);
  });

  it('PROG27-43: invalid stat name rejected', () => {
    expect(isValidStatName('str')).toBe(true);
    expect(isValidStatName('invalid')).toBe(false);
  });

  it('PROG27-27: effectiveStat adds bonus to base', () => {
    expect(effectiveStat(40, 2)).toBe(42);
  });
});
