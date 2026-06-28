import { describe, it, expect } from 'vitest';
import { isWalkable, MAX_SLOPE_TANGENT } from './walkability';
import { WORLD_MIN, WORLD_MAX } from './world-constants';

describe('isWalkable', () => {
  it('returns false when either endpoint is outside world bounds', () => {
    expect(isWalkable({ x: WORLD_MIN - 1, z: 0 }, { x: 0, z: 0 })).toBe(false);
    expect(isWalkable({ x: 0, z: 0 }, { x: WORLD_MAX + 1, z: 0 })).toBe(false);
  });

  it('returns false for steep slope anchor (-42,75)→(-41,75)', () => {
    expect(isWalkable({ x: -42, z: 75 }, { x: -41, z: 75 })).toBe(false);
  });

  it('steep anchor slope exceeds MAX_SLOPE_TANGENT', () => {
    const from = { x: -42, z: 75 };
    const to = { x: -41, z: 75 };
    expect(isWalkable(from, to)).toBe(false);
    expect(MAX_SLOPE_TANGENT).toBe(0.55);
  });

  it('returns false when segment crosses building at (0,-14)', () => {
    expect(isWalkable({ x: 0, z: 5 }, { x: 0, z: -14 })).toBe(false);
  });

  it('returns true for gentle open-field step (20,20)→(21,20)', () => {
    expect(isWalkable({ x: 20, z: 20 }, { x: 21, z: 20 })).toBe(true);
  });
});
