import { describe, it, expect } from 'vitest';
import { createSeededRng } from './seeded-rng';
import {
  rollDrops,
  GOBLIN_ADENA_DROP_ROW,
  GOBLIN_ADENA_DROP_SEED,
} from './drop-roll';

describe('rollDrops', () => {
  it('grants adena item 57 count 22 with documented seed and 70% chance', () => {
    const rng = createSeededRng(GOBLIN_ADENA_DROP_SEED);
    const results = rollDrops([GOBLIN_ADENA_DROP_ROW], rng);
    expect(results).toEqual([{ itemId: 57, count: 22 }]);
  });

  it('returns empty when chance roll fails at 0.95', () => {
    const rng = {
      nextFloat: () => 0.95,
      nextInt: () => 22,
      nextDamageOffset: () => 0,
    };
    const results = rollDrops([GOBLIN_ADENA_DROP_ROW], rng);
    expect(results).toEqual([]);
  });

  it('rolls each drop row independently', () => {
    const rng = {
      nextFloat: () => 0.1,
      nextInt: (_min: number, _max: number) => 15,
      nextDamageOffset: () => 0,
    };
    const rows = [
      { itemId: 57, minCount: 13, maxCount: 30, chance: 70 },
      { itemId: 100, minCount: 1, maxCount: 1, chance: 50 },
    ];
    expect(rollDrops(rows, rng)).toEqual([
      { itemId: 57, count: 15 },
      { itemId: 100, count: 15 },
    ]);
  });

  it('skips count roll when chance fails', () => {
    let intCalls = 0;
    const rng = {
      nextFloat: () => 0.95,
      nextInt: () => {
        intCalls++;
        return 20;
      },
      nextDamageOffset: () => 0,
    };
    rollDrops([GOBLIN_ADENA_DROP_ROW], rng);
    expect(intCalls).toBe(0);
  });
});
