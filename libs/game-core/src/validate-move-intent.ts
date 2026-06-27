import { WORLD_MIN, WORLD_MAX } from './world-constants';

export function isValidMoveIntent(targetX: number, targetZ: number): boolean {
  if (!Number.isFinite(targetX) || !Number.isFinite(targetZ)) {
    return false;
  }
  if (targetX < WORLD_MIN || targetX > WORLD_MAX) {
    return false;
  }
  if (targetZ < WORLD_MIN || targetZ > WORLD_MAX) {
    return false;
  }
  return true;
}
