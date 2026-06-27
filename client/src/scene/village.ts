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

const BUILDING_LAYOUT = [
  { x: -12, z: -8, w: 6, d: 5, h: 4, color: 0x8b4513 },
  { x: 12, z: -8, w: 5, d: 6, h: 5, color: 0xa0522d },
  { x: -10, z: 10, w: 7, d: 4, h: 3.5, color: 0xcd853f },
  { x: 8, z: 12, w: 5, d: 5, h: 4.5, color: 0x8b7355 },
  { x: 0, z: -14, w: 8, d: 6, h: 6, color: 0x6b4423 },
] as const;

export function buildVillage(opts: VillageOptions): SceneObjectSpec[] {
  const { sampleHeight } = opts;
  const specs: SceneObjectSpec[] = [];

  specs.push({
    kind: 'ground',
    x: 0,
    y: sampleHeight(0, 0),
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
      y: sampleHeight(b.x, b.z) + b.h / 2,
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
    y: sampleHeight(0, 0) + 3,
    z: 0,
    width: 2,
    depth: 2,
    height: 6,
    color: 0x00ff88,
  });

  return specs;
}
