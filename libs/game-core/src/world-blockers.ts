import { TERRAIN_SEED } from './terrain';
import { scatterProps } from './world-scatter';

export interface Aabb {
  cx: number;
  cz: number;
  halfW: number;
  halfD: number;
}

export interface CircleBlocker {
  x: number;
  z: number;
  radius: number;
}

/** Village buildings — same footprints, centred on expanded TI village. */
const BUILDING_LAYOUT = [
  { x: -12, z: -8, w: 6, d: 5 },
  { x: 12, z: -8, w: 5, d: 6 },
  { x: -10, z: 10, w: 7, d: 4 },
  { x: 8, z: 12, w: 5, d: 5 },
  { x: 0, z: -14, w: 8, d: 6 },
] as const;

export const BUILDING_AABBS: readonly Aabb[] = BUILDING_LAYOUT.map((b) => ({
  cx: b.x,
  cz: b.z,
  halfW: b.w / 2,
  halfD: b.d / 2,
}));

export const BUILDING_LAYOUT_EXPORT = BUILDING_LAYOUT;

/** Landmark collision footprints at zone anchors (prop cores only). */
export const LANDMARK_AABBS: readonly Aabb[] = [
  { cx: -155, cz: 58, halfW: 2, halfD: 2 },
  { cx: -281, cz: 87, halfW: 8, halfD: 6 },
  { cx: -270, cz: 90, halfW: 4, halfD: 3 },
  { cx: -224, cz: 287, halfW: 6, halfD: 4 },
  { cx: -242, cz: 254, halfW: 5, halfD: 4 },
  { cx: -110, cz: 29, halfW: 2, halfD: 2 },
] as const;

const TREE_RADIUS = 1.2;
const ROCK_RADIUS = 0.7;

let cachedPropBlockers: CircleBlocker[] | null = null;
let cachedPropSeed: number | null = null;

export function resetPropBlockerCache(): void {
  cachedPropBlockers = null;
  cachedPropSeed = null;
}

export function getPropBlockers(seed: number = TERRAIN_SEED): readonly CircleBlocker[] {
  if (cachedPropBlockers !== null && cachedPropSeed === seed) {
    return cachedPropBlockers;
  }
  const props = scatterProps(seed, { sampleHeight: () => 0 }, {
    count: 220,
    fieldMin: -300,
    fieldMax: 300,
    villageRadius: 45,
  });
  const blockers = props.map((p) => ({
    x: p.x,
    z: p.z,
    radius: p.kind === 'tree' ? TREE_RADIUS : ROCK_RADIUS,
  }));
  cachedPropBlockers = blockers;
  cachedPropSeed = seed;
  return blockers;
}

export function isPointInAabb(x: number, z: number, aabb: Aabb): boolean {
  return Math.abs(x - aabb.cx) <= aabb.halfW && Math.abs(z - aabb.cz) <= aabb.halfD;
}

export function isPointInCircle(x: number, z: number, circle: CircleBlocker): boolean {
  return Math.hypot(x - circle.x, z - circle.z) <= circle.radius;
}

export function isBlocked(x: number, z: number): boolean {
  for (const aabb of BUILDING_AABBS) {
    if (isPointInAabb(x, z, aabb)) return true;
  }
  for (const aabb of LANDMARK_AABBS) {
    if (isPointInAabb(x, z, aabb)) return true;
  }
  for (const prop of getPropBlockers()) {
    if (isPointInCircle(x, z, prop)) return true;
  }
  return false;
}

/** True when an NPC spawn at (x,z) overlaps buildings/props with margin (default 0.8 m). */
export function isNpcSpawnBlocked(x: number, z: number, margin = 0.8): boolean {
  for (const aabb of BUILDING_AABBS) {
    const expanded: Aabb = {
      cx: aabb.cx,
      cz: aabb.cz,
      halfW: aabb.halfW + margin,
      halfD: aabb.halfD + margin,
    };
    if (isPointInAabb(x, z, expanded)) return true;
  }
  for (const aabb of LANDMARK_AABBS) {
    const expanded: Aabb = {
      cx: aabb.cx,
      cz: aabb.cz,
      halfW: aabb.halfW + margin,
      halfD: aabb.halfD + margin,
    };
    if (isPointInAabb(x, z, expanded)) return true;
  }
  for (const prop of getPropBlockers()) {
    if (isPointInCircle(x, z, { ...prop, radius: prop.radius + margin })) return true;
  }
  return false;
}

/** Segment vs axis-aligned box on XZ (Liang-Barsky style slab test). */
export function segmentIntersectsAabb(
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  aabb: Aabb
): boolean {
  const minX = aabb.cx - aabb.halfW;
  const maxX = aabb.cx + aabb.halfW;
  const minZ = aabb.cz - aabb.halfD;
  const maxZ = aabb.cz + aabb.halfD;

  const dx = x1 - x0;
  const dz = z1 - z0;
  let t0 = 0;
  let t1 = 1;

  for (const [p, d, min, max] of [
    [x0, dx, minX, maxX],
    [z0, dz, minZ, maxZ],
  ] as const) {
    if (Math.abs(d) < 1e-12) {
      if (p < min || p > max) return false;
    } else {
      const inv = 1 / d;
      let tNear = (min - p) * inv;
      let tFar = (max - p) * inv;
      if (tNear > tFar) [tNear, tFar] = [tFar, tNear];
      t0 = Math.max(t0, tNear);
      t1 = Math.min(t1, tFar);
      if (t0 > t1) return false;
    }
  }
  return true;
}

/** Segment vs circle on XZ. */
export function segmentIntersectsCircle(
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  circle: CircleBlocker
): boolean {
  const dx = x1 - x0;
  const dz = z1 - z0;
  const fx = x0 - circle.x;
  const fz = z0 - circle.z;
  const a = dx * dx + dz * dz;
  if (a < 1e-12) {
    return Math.hypot(fx, fz) <= circle.radius;
  }
  const b = 2 * (fx * dx + fz * dz);
  const c = fx * fx + fz * fz - circle.radius * circle.radius;
  let disc = b * b - 4 * a * c;
  if (disc < 0) return false;
  disc = Math.sqrt(disc);
  const t1 = (-b - disc) / (2 * a);
  const t2 = (-b + disc) / (2 * a);
  return (t1 >= 0 && t1 <= 1) || (t2 >= 0 && t2 <= 1) || (t1 < 0 && t2 > 1);
}

export function segmentIntersectsBlocker(
  x0: number,
  z0: number,
  x1: number,
  z1: number
): boolean {
  for (const aabb of BUILDING_AABBS) {
    if (segmentIntersectsAabb(x0, z0, x1, z1, aabb)) return true;
  }
  for (const aabb of LANDMARK_AABBS) {
    if (segmentIntersectsAabb(x0, z0, x1, z1, aabb)) return true;
  }
  for (const prop of getPropBlockers()) {
    if (segmentIntersectsCircle(x0, z0, x1, z1, prop)) return true;
  }
  return false;
}
