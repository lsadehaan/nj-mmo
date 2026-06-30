import { getZoneAt } from './ti-zones';

export interface TerrainConfig {
  seed: number;
  size: number;
  segments: number;
  heightScale: number;
}

/** Terrain seed shared with client renderer (WORLD_SEED). */
export const TERRAIN_SEED = 42;

export const TERRAIN_CONFIG: TerrainConfig = {
  seed: TERRAIN_SEED,
  size: 640,
  segments: 128,
  heightScale: 10,
};

export const FEET_OFFSET = 1.0;

export interface TerrainData {
  seed: number;
  size: number;
  segments: number;
  vertices: Float32Array;
  indices: Uint32Array;
  heights: Float32Array;
  sampleHeight: (x: number, z: number) => number;
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

function regionOffset(zoneId: string, type: string): number {
  if (type === 'water' || zoneId === 'harbor') return -0.35;
  if (zoneId === 'elven_ruins' || zoneId === 'cave_of_souls') return 0.45;
  return 0;
}

export function sampleHeight(
  x: number,
  z: number,
  config: TerrainConfig = TERRAIN_CONFIG
): number {
  const { seed, segments, heightScale } = config;
  const size = config.size;
  const half = size / 2;
  const col = ((x + half) / size) * segments;
  const row = ((z + half) / size) * segments;
  const nx = col / segments;
  const nz = row / segments;
  const base =
    (noise2D(seed, nx * 8, nz * 8) * 0.6 +
      noise2D(seed + 1, nx * 16, nz * 16) * 0.3 +
      noise2D(seed + 2, nx * 32, nz * 32) * 0.1) *
    heightScale;
  const { zoneId, type } = getZoneAt(x, z);
  return base + regionOffset(zoneId, type);
}

export function snapEntityY(x: number, z: number, config?: TerrainConfig): number {
  return sampleHeight(x, z, config) + FEET_OFFSET;
}

export function generateTerrainData(config: TerrainConfig = TERRAIN_CONFIG): TerrainData {
  const { seed, size, segments, heightScale } = config;
  const vertCount = (segments + 1) * (segments + 1);
  const vertices = new Float32Array(vertCount * 3);
  const heights = new Float32Array(vertCount);
  const half = size / 2;

  let vi = 0;
  for (let row = 0; row <= segments; row++) {
    for (let col = 0; col <= segments; col++) {
      const x = (col / segments) * size - half;
      const z = (row / segments) * size - half;
      const h = sampleHeight(x, z, config);

      heights[vi / 3] = h;
      vertices[vi] = x;
      vertices[vi + 1] = h;
      vertices[vi + 2] = z;
      vi += 3;
    }
  }

  const indices: number[] = [];
  for (let row = 0; row < segments; row++) {
    for (let col = 0; col < segments; col++) {
      const a = row * (segments + 1) + col;
      const b = a + 1;
      const c = a + segments + 1;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const sampleAt = (x: number, z: number): number => sampleHeight(x, z, config);

  return {
    seed,
    size,
    segments,
    vertices,
    indices: new Uint32Array(indices),
    heights,
    sampleHeight: sampleAt,
  };
}
