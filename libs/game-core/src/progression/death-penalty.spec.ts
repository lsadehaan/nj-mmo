import { describe, it, expect } from 'vitest';
import type { ExperienceCurveRow } from '../experience';
import {
  calcDeathXpLoss,
  type ExperienceLossRow,
  NEWBIE_XP_PROTECTION_MAX_LEVEL,
} from './death-penalty';

const ANCHOR_CURVE: ExperienceCurveRow[] = [
  { level: 1, xpToNextLevel: 0 },
  { level: 2, xpToNextLevel: 68 },
  { level: 9, xpToNextLevel: 40000 },
  { level: 10, xpToNextLevel: 48230 },
  { level: 11, xpToNextLevel: 71203 },
  { level: 20, xpToNextLevel: 835864 },
];

const ANCHOR_LOSS: ExperienceLossRow[] = [
  { level: 9, percentLost: 9.0 },
  { level: 10, percentLost: 8.875 },
  { level: 15, percentLost: 8.25 },
  { level: 20, percentLost: 7.625 },
];

describe('calcDeathXpLoss (PROG27-01, PROG27-02, PROG27-45)', () => {
  it('PROG27-01: level 10 loses 2039 XP from 50000', () => {
    const result = calcDeathXpLoss(
      { level: 10, xp: 50000, karma: 0, killerKind: 'mob' },
      ANCHOR_CURVE,
      ANCHOR_LOSS
    );
    expect(result.lostExp).toBe(2039);
    expect(result.newXp).toBe(47961);
    expect(result.expBeforeDeath).toBe(50000);
  });

  it('PROG27-02: level 9 has zero XP loss', () => {
    const result = calcDeathXpLoss(
      { level: 9, xp: 40000, karma: 0, killerKind: 'mob' },
      ANCHOR_CURVE,
      ANCHOR_LOSS
    );
    expect(result.lostExp).toBe(0);
    expect(result.newXp).toBe(40000);
  });

  it('PROG27-45: karma multiplier increases percent lost', () => {
    const base = calcDeathXpLoss(
      { level: 10, xp: 50000, karma: 0, killerKind: 'mob' },
      ANCHOR_CURVE,
      ANCHOR_LOSS
    );
    const karma = calcDeathXpLoss(
      { level: 10, xp: 50000, karma: -100, killerKind: 'mob' },
      ANCHOR_CURVE,
      ANCHOR_LOSS,
      { karmaExpLostMult: 1.1 }
    );
    expect(karma.lostExp).toBeGreaterThan(base.lostExp);
    expect(karma.lostExp).toBe(Math.round(base.lostExp * 1.1));
  });

  it('newbie protection max level is 9', () => {
    expect(NEWBIE_XP_PROTECTION_MAX_LEVEL).toBe(9);
  });
});
