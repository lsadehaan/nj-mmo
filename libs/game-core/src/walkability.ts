import { WORLD_MIN, WORLD_MAX } from './world-constants';
import { sampleHeight } from './terrain';
import { isBlocked, segmentIntersectsBlocker } from './world-blockers';
import { isWaterZone } from './ti-zones';

export interface Vec2 {
  x: number;
  z: number;
}

export const MAX_STEP_HEIGHT = 0.75;
export const MAX_SLOPE_TANGENT = 0.55;
export const WALK_CHECK_SUBDIVISIONS = 4;

function isInBounds(x: number, z: number): boolean {
  return x >= WORLD_MIN && x <= WORLD_MAX && z >= WORLD_MIN && z <= WORLD_MAX;
}

export function isWalkable(from: Vec2, to: Vec2): boolean {
  if (!isInBounds(from.x, from.z) || !isInBounds(to.x, to.z)) {
    return false;
  }

  if (isWaterZone(to.x, to.z)) {
    return false;
  }

  if (segmentIntersectsBlocker(from.x, from.z, to.x, to.z)) {
    return false;
  }

  const subdivisions = WALK_CHECK_SUBDIVISIONS;
  let prevX = from.x;
  let prevZ = from.z;
  let prevH = sampleHeight(prevX, prevZ);

  for (let i = 1; i <= subdivisions; i++) {
    const t = i / subdivisions;
    const x = from.x + (to.x - from.x) * t;
    const z = from.z + (to.z - from.z) * t;

    if (!isInBounds(x, z) || isBlocked(x, z)) {
      return false;
    }

    const h = sampleHeight(x, z);
    const dx = x - prevX;
    const dz = z - prevZ;
    const horiz = Math.hypot(dx, dz);

    if (horiz > 1e-9) {
      const dh = Math.abs(h - prevH);
      if (dh / horiz > MAX_SLOPE_TANGENT) return false;
      if (dh > MAX_STEP_HEIGHT) return false;
    }

    prevX = x;
    prevZ = z;
    prevH = h;
  }

  return true;
}
