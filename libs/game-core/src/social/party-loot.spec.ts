import { describe, it, expect } from 'vitest';
import { assignPartyDrops } from './party-loot';
import { createSeededRng } from '../seeded-rng';

describe('assignPartyDrops (SOC26-20)', () => {
  it('deterministic assignment with pinned RNG seed', () => {
    const rng = createSeededRng(42);
    const drops = [
      { itemId: 57, count: 3 },
      { itemId: 1835, count: 5 },
    ];
    const first = assignPartyDrops(drops, ['a', 'b'], rng);
    const rng2 = createSeededRng(42);
    const second = assignPartyDrops(drops, ['a', 'b'], rng2);
    expect(first).toEqual(second);
    expect([...first.values()].flat().length).toBe(2);
  });

  it('returns empty map when no eligible members', () => {
    const rng = createSeededRng(1);
    expect(assignPartyDrops([{ itemId: 1, count: 1 }], [], rng).size).toBe(0);
  });
});
