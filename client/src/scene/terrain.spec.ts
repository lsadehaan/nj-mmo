import { describe, it, expect } from 'vitest';
import { generateTerrain } from './terrain';

const opts = { size: 200, segments: 32, heightScale: 8, seed: 42 };

describe('generateTerrain', () => {
  it('is deterministic for the same seed', () => {
    const a = generateTerrain(42, opts);
    const b = generateTerrain(42, opts);
    expect(Array.from(a.vertices)).toEqual(Array.from(b.vertices));
    expect(Array.from(a.indices)).toEqual(Array.from(b.indices));
  });

  it('sampleHeight matches vertex height at the same point', () => {
    const terrain = generateTerrain(42, opts);
    const x = terrain.vertices[0];
    const z = terrain.vertices[2];
    expect(terrain.sampleHeight(x, z)).toBeCloseTo(terrain.heights[0], 5);
  });

  it('produces different geometry for different seeds', () => {
    const a = generateTerrain(1, opts);
    const b = generateTerrain(2, opts);
    expect(Array.from(a.vertices)).not.toEqual(Array.from(b.vertices));
  });
});
