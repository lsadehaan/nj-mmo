export interface PlayerMoveState {
  x: number;
  y: number;
  z: number;
  targetX: number | null;
  targetZ: number | null;
}

export interface MovementIntent {
  targetX: number;
  targetZ: number;
}

export const ARRIVAL_EPSILON = 0.05;
export const DEFAULT_MOVE_SPEED = 8;

export function step(
  state: PlayerMoveState,
  intent: MovementIntent | null,
  dt: number,
  speed: number = DEFAULT_MOVE_SPEED
): PlayerMoveState {
  let { x, y, z, targetX, targetZ } = state;

  if (intent !== null) {
    targetX = intent.targetX;
    targetZ = intent.targetZ;
  }

  if (targetX === null || targetZ === null) {
    return { x, y, z, targetX, targetZ };
  }

  const dx = targetX - x;
  const dz = targetZ - z;
  const dist = Math.hypot(dx, dz);

  if (dist <= ARRIVAL_EPSILON) {
    return { x: targetX, y, z: targetZ, targetX, targetZ };
  }

  const move = Math.min(speed * dt, dist - ARRIVAL_EPSILON);
  const nx = x + (dx / dist) * move;
  const nz = z + (dz / dist) * move;

  if (!Number.isFinite(nx) || !Number.isFinite(nz)) {
    return { x, y, z, targetX, targetZ };
  }

  return { x: nx, y, z: nz, targetX, targetZ };
}

export function createInitialMoveState(x = 0, y = 0, z = 0): PlayerMoveState {
  return { x, y, z, targetX: null, targetZ: null };
}
