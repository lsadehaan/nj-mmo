import { describe, it, expect } from 'vitest';
import { sampleHeight, snapEntityY, TERRAIN_CONFIG } from './terrain';
import { SPAWN_Y } from './world-constants';

describe('terrain', () => {
  it('sampleHeight(0,0) returns finite height (TIW23-05)', () => {
    const h = sampleHeight(0, 0);
    expect(Number.isFinite(h)).toBe(true);
    expect(SPAWN_Y).toBeCloseTo(snapEntityY(0, 0), 10);
  });

  it('returns identical results for identical inputs (deterministic)', () => {
    const a = sampleHeight(12.5, -33.2);
    const b = sampleHeight(12.5, -33.2);
    expect(a).toBe(b);
  });

  it('snapEntityY adds FEET_OFFSET to sampleHeight', () => {
    expect(snapEntityY(0, 0)).toBeCloseTo(sampleHeight(0, 0) + 1, 10);
  });

  it('TERRAIN_CONFIG is 640 m with 128 segments (TIW23-04)', () => {
    expect(TERRAIN_CONFIG).toEqual({
      seed: 42,
      size: 640,
      segments: 128,
      heightScale: 10,
    });
  });
});
