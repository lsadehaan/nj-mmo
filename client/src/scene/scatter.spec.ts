import { describe, it, expect } from 'vitest';
import { scatterProps, createSeededRng } from './scatter';
import { generateTerrain } from './terrain';

describe('scatterProps', () => {
  const terrain = generateTerrain(7, {
    size: 200,
    segments: 32,
    heightScale: 8,
    seed: 7,
  });

  const opts = { count: 20, fieldMin: -80, fieldMax: 80, villageRadius: 25 };

  it('is deterministic for the same seed', () => {
    const a = scatterProps(99, terrain, opts);
    const b = scatterProps(99, terrain, opts);
    expect(a).toEqual(b);
  });

  it('avoids the village ground patch', () => {
    const rng = createSeededRng(99);
    const props = scatterProps(99, terrain, opts, rng);
    for (const p of props) {
      expect(Math.hypot(p.x, p.z)).toBeGreaterThanOrEqual(25);
      expect(p.y).toBeCloseTo(terrain.sampleHeight(p.x, p.z), 5);
    }
  });
});
