import { BUILDING_LAYOUT_EXPORT, sampleHeight, TERRAIN_CONFIG, type TerrainConfig } from '@nj/game-core';

export interface SceneObjectSpec {
  kind: 'ground' | 'building' | 'peace-zone';
  x: number;
  y: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  color: number;
}

export interface VillageOptions {
  seed: number;
  sampleHeight: (x: number, z: number) => number;
}

const BUILDING_COLORS = [0x8b4513, 0xa0522d, 0xcd853f, 0x8b7355, 0x6b4423] as const;

const BUILDING_LAYOUT = BUILDING_LAYOUT_EXPORT.map((b, i) => ({
  ...b,
  h: [4, 5, 3.5, 4.5, 6][i],
  color: BUILDING_COLORS[i],
}));

export { BUILDING_LAYOUT };

export function buildVillage(opts: VillageOptions): SceneObjectSpec[] {
  const { sampleHeight: heightAt } = opts;
  const specs: SceneObjectSpec[] = [];

  specs.push({
    kind: 'ground',
    x: 0,
    y: heightAt(0, 0),
    z: 0,
    width: 40,
    depth: 40,
    height: 0.1,
    color: 0xc2b280,
  });

  for (const b of BUILDING_LAYOUT) {
    specs.push({
      kind: 'building',
      x: b.x,
      y: heightAt(b.x, b.z) + b.h / 2,
      z: b.z,
      width: b.w,
      depth: b.d,
      height: b.h,
      color: b.color,
    });
  }

  specs.push({
    kind: 'peace-zone',
    x: 0,
    y: heightAt(0, 0) + 3,
    z: 0,
    width: 2,
    depth: 2,
    height: 6,
    color: 0x00ff88,
  });

  return specs;
}

export function defaultTerrainConfig(seed: number): TerrainConfig {
  return { ...TERRAIN_CONFIG, seed };
}
