import { describe, it, expect } from 'vitest';
import {
  TERRAIN_SEED,
  WORLD_MIN,
  WORLD_MAX,
  SPAWN_X,
  SPAWN_Z,
  SPAWN_Y,
} from './world-constants';

describe('world constants', () => {
  it('exports spawn position and world bounds per spec', () => {
    expect(TERRAIN_SEED).toBe(42);
    expect(WORLD_MIN).toBe(-95);
    expect(WORLD_MAX).toBe(95);
    expect(SPAWN_X).toBe(0);
    expect(SPAWN_Z).toBe(0);
    expect(SPAWN_Y).toBeGreaterThan(0);
    expect(Number.isFinite(SPAWN_Y)).toBe(true);
  });

  it('SPAWN_Y matches terrain sampleHeight(0,0)+1 for seed 42', () => {
    const height = sampleTerrainHeight(0, 0, TERRAIN_SEED);
    expect(SPAWN_Y).toBeCloseTo(height + 1, 10);
  });
});

/** Mirrors client terrain.ts sampleHeight at origin grid point. */
function sampleTerrainHeight(x: number, z: number, seed: number): number {
  const size = 200;
  const segments = 64;
  const heightScale = 10;
  const half = size / 2;
  const col = ((x + half) / size) * segments;
  const row = ((z + half) / size) * segments;
  const nx = col / segments;
  const nz = row / segments;
  return (
    (noise2D(seed, nx * 8, nz * 8) * 0.6 +
      noise2D(seed + 1, nx * 16, nz * 16) * 0.3 +
      noise2D(seed + 2, nx * 32, nz * 32) * 0.1) *
    heightScale
  );
}

function hashSeed(seed: number, x: number, z: number): number {
  let h = seed ^ (x * 374761393) ^ (z * 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

function noise2D(seed: number, x: number, z: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;

  const a = hashSeed(seed, ix, iz) / 0xffffffff;
  const b = hashSeed(seed, ix + 1, iz) / 0xffffffff;
  const c = hashSeed(seed, ix, iz + 1) / 0xffffffff;
  const d = hashSeed(seed, ix + 1, iz + 1) / 0xffffffff;

  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);

  return a * (1 - ux) * (1 - uz) + b * ux * (1 - uz) + c * (1 - ux) * uz + d * ux * uz;
}
