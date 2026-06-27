import { describe, it, expect } from 'vitest';
import { buildVillage } from './village';
import { generateTerrain } from './terrain';

describe('buildVillage', () => {
  const terrain = generateTerrain(42, {
    size: 200,
    segments: 32,
    heightScale: 8,
    seed: 42,
  });

  it('returns 5 buildings, 1 ground patch, and 1 peace-zone marker', () => {
    const specs = buildVillage({ seed: 42, sampleHeight: terrain.sampleHeight });
    expect(specs.filter((s) => s.kind === 'building')).toHaveLength(5);
    expect(specs.filter((s) => s.kind === 'ground')).toHaveLength(1);
    expect(specs.filter((s) => s.kind === 'peace-zone')).toHaveLength(1);
  });

  it('places buildings deterministically on terrain height', () => {
    const a = buildVillage({ seed: 42, sampleHeight: terrain.sampleHeight });
    const b = buildVillage({ seed: 42, sampleHeight: terrain.sampleHeight });
    expect(a).toEqual(b);
    expect(a[1].y).toBeCloseTo(terrain.sampleHeight(a[1].x, a[1].z) + a[1].height / 2, 5);
  });
});
