import { listTiZones } from '@nj/game-core';
import { WORLD_MIN, WORLD_MAX } from '@nj/game-core';

export interface ZoneBounds {
  id: string;
  displayName: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export function zoneBoundsFromTiZones(): ZoneBounds[] {
  return listTiZones().map((zone) => {
    const xs = zone.polygon.map((p) => p.x);
    const zs = zone.polygon.map((p) => p.z);
    return {
      id: zone.id,
      displayName: zone.displayName,
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minZ: Math.min(...zs),
      maxZ: Math.max(...zs),
    };
  });
}

export function normalizeWorldToMinimap(
  x: number,
  z: number,
  sizePx: number
): { leftPx: number; topPx: number } {
  const range = WORLD_MAX - WORLD_MIN;
  const nx = (x - WORLD_MIN) / range;
  const nz = (z - WORLD_MIN) / range;
  const clampedX = Math.max(0, Math.min(1, nx));
  const clampedZ = Math.max(0, Math.min(1, nz));
  return {
    leftPx: clampedX * sizePx,
    topPx: (1 - clampedZ) * sizePx,
  };
}

export { WORLD_MIN, WORLD_MAX };
