import { describe, it, expect } from 'vitest';
import { isWalkable } from './walkability';
import { WORLD_MIN, WORLD_MAX } from './world-constants';
import { HARBOR_WATER_SAMPLE } from './ti-zones';

describe('isWalkable', () => {
  it('returns false when either endpoint is outside world bounds', () => {
    expect(isWalkable({ x: WORLD_MIN - 1, z: 0 }, { x: 0, z: 0 })).toBe(false);
    expect(isWalkable({ x: 0, z: 0 }, { x: WORLD_MAX + 1, z: 0 })).toBe(false);
  });

  it('rejects step into harbour water (TIW23-23)', () => {
    const land = { x: HARBOR_WATER_SAMPLE.x, z: HARBOR_WATER_SAMPLE.z - 5 };
    expect(isWalkable(land, HARBOR_WATER_SAMPLE)).toBe(false);
  });

  it('accepts gentle open-field step away from village buildings', () => {
    expect(isWalkable({ x: -100, z: 20 }, { x: -99, z: 20 })).toBe(true);
  });

  it('returns false when stepping onto landmark core', () => {
    expect(isWalkable({ x: -150, z: 55 }, { x: -155, z: 58 })).toBe(false);
  });

  it('returns false when segment crosses building at (0,-14)', () => {
    expect(isWalkable({ x: 0, z: 5 }, { x: 0, z: -14 })).toBe(false);
  });
});
