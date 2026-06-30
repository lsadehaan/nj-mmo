export {
  detectHpHit,
  detectLevelUp,
  detectActionEdge,
  countLevelUps,
  actionToClip,
} from '../scene/vfx/vfx-triggers';

export const FOOTSTEP_MIN_DISTANCE_M = 0.8;
export const FOOTSTEP_MIN_INTERVAL_MS = 350;

export function shouldPlayFootstep(
  distanceM: number,
  elapsedMs: number,
  zoneType: string
): boolean {
  if (zoneType === 'water') return false;
  if (distanceM < FOOTSTEP_MIN_DISTANCE_M) return false;
  if (elapsedMs < FOOTSTEP_MIN_INTERVAL_MS) return false;
  return true;
}

export function planarDistance(
  ax: number,
  az: number,
  bx: number,
  bz: number
): number {
  const dx = bx - ax;
  const dz = bz - az;
  return Math.hypot(dx, dz);
}
