import { describe, it, expect } from 'vitest';
import {
  SPAWN_Y,
  SPAWN_X,
  SPAWN_Z,
  TERRAIN_SEED,
  TERRAIN_SIZE,
  WORLD_MIN,
  WORLD_MAX,
} from './world-constants';
import { snapEntityY } from './terrain';

describe('world constants', () => {
  it('exports expanded world bounds (TIW23-03)', () => {
    expect(TERRAIN_SEED).toBe(42);
    expect(WORLD_MIN).toBe(-315);
    expect(WORLD_MAX).toBe(315);
    expect(TERRAIN_SIZE).toBe(640);
    expect(SPAWN_X).toBe(0);
    expect(SPAWN_Z).toBe(0);
    expect(Number.isFinite(SPAWN_Y)).toBe(true);
  });

  it('SPAWN_Y equals snapEntityY(SPAWN_X, SPAWN_Z) (TIW23-05)', () => {
    expect(SPAWN_Y).toBeCloseTo(snapEntityY(SPAWN_X, SPAWN_Z), 10);
  });
});
