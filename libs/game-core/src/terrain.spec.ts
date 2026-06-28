import { describe, it, expect } from 'vitest';
import { sampleHeight, snapEntityY, TERRAIN_CONFIG } from './terrain';

const ORIGIN_HEIGHT = 3.263961466789237;

describe('terrain', () => {
  it('sampleHeight(0,0) matches spec anchor for seed 42', () => {
    expect(sampleHeight(0, 0)).toBeCloseTo(ORIGIN_HEIGHT, 10);
  });

  it('returns identical results for identical inputs (deterministic)', () => {
    const a = sampleHeight(12.5, -33.2);
    const b = sampleHeight(12.5, -33.2);
    expect(a).toBe(b);
  });

  it('snapEntityY adds FEET_OFFSET to sampleHeight', () => {
    expect(snapEntityY(0, 0)).toBeCloseTo(sampleHeight(0, 0) + 1, 10);
  });

  it('TERRAIN_CONFIG matches client renderer opts', () => {
    expect(TERRAIN_CONFIG).toEqual({
      seed: 42,
      size: 200,
      segments: 64,
      heightScale: 10,
    });
  });
});
