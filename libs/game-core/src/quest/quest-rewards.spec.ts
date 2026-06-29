import { describe, it, expect } from 'vitest';
import { grantQuestRewards } from './quest-rewards';
import type { ExperienceCurveRow } from '../experience';

const curve: ExperienceCurveRow[] = [
  { level: 1, xpToNextLevel: 0 },
  { level: 2, xpToNextLevel: 100 },
  { level: 3, xpToNextLevel: 500 },
  { level: 15, xpToNextLevel: 50000 },
];

describe('quest-rewards', () => {
  // QUEST21-07
  it('grantQuestRewards with XP 3000 may increase level', () => {
    const result = grantQuestRewards(
      [{ xp: 3000 }],
      { level: 1, xp: 0, adena: 0 },
      curve,
      'fighter'
    );
    expect(result.xp).toBe(3000);
    expect(result.level).toBeGreaterThanOrEqual(1);
  });

  it('grants class-specific tutorial shot reward', () => {
    const fighter = grantQuestRewards(
      [
        { itemId: 1835, count: 200, rewardClass: 'fighter' },
        { itemId: 2509, count: 100, rewardClass: 'mystic' },
      ],
      { level: 1, xp: 0, adena: 0 },
      curve,
      'fighter'
    );
    expect(fighter.items).toEqual([{ itemId: 1835, count: 200 }]);

    const mystic = grantQuestRewards(
      [
        { itemId: 1835, count: 200, rewardClass: 'fighter' },
        { itemId: 2509, count: 100, rewardClass: 'mystic' },
      ],
      { level: 1, xp: 0, adena: 0 },
      curve,
      'mystic'
    );
    expect(mystic.items).toEqual([{ itemId: 2509, count: 100 }]);
  });
});
