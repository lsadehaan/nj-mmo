import { snapEntityY } from '@nj/game-core';
import type { PathMoveState } from '@nj/game-core';

export interface PlayerPlacementTarget {
  x: number;
  y: number;
  z: number;
}

/** Set player position, snap Y, and clear movement targets (room-test + e2e intent). */
export function placePlayerAt(
  player: PlayerPlacementTarget,
  tickState: PathMoveState | undefined,
  x: number,
  z: number
): void {
  player.x = x;
  player.z = z;
  player.y = snapEntityY(x, z);
  if (tickState) {
    tickState.x = x;
    tickState.z = z;
    tickState.targetX = null;
    tickState.targetZ = null;
  }
}

/** Reduce HP by amount, floored at 1 (e2e precondition setup). */
export function applyE2eDamage(hp: number, amount: number): number {
  return Math.max(1, hp - Math.max(0, amount));
}
