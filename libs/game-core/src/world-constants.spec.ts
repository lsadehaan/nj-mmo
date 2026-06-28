import { describe, it, expect } from 'vitest';
import {
  SPAWN_Y,
  SPAWN_X,
  SPAWN_Z,
  TERRAIN_SEED,
  WORLD_MIN,
  WORLD_MAX,
} from './world-constants';
import { snapEntityY } from './terrain';

const SPAWN_Y_ANCHOR = 4.263961466789237;

describe('world constants', () => {
  it('exports spawn position and world bounds per spec', () => {
    expect(TERRAIN_SEED).toBe(42);
    expect(WORLD_MIN).toBe(-95);
    expect(WORLD_MAX).toBe(95);
    expect(SPAWN_X).toBe(0);
    expect(SPAWN_Z).toBe(0);
    expect(SPAWN_Y).toBeCloseTo(SPAWN_Y_ANCHOR, 10);
    expect(Number.isFinite(SPAWN_Y)).toBe(true);
  });

  it('SPAWN_Y equals snapEntityY(SPAWN_X, SPAWN_Z)', () => {
    expect(SPAWN_Y).toBeCloseTo(snapEntityY(SPAWN_X, SPAWN_Z), 10);
  });
});
