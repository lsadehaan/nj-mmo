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
  const { x, y, z } = state;
  let { targetX, targetZ } = state;

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

  const move = Math.min(speed * dt, dist);
  if (dist - move <= ARRIVAL_EPSILON) {
    return { x: targetX, y, z: targetZ, targetX, targetZ };
  }

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

export interface PathMoveState extends PlayerMoveState {
  waypoints: ReadonlyArray<{ x: number; z: number }>;
  waypointIndex: number;
}

export function createPathMoveState(x = 0, y = 0, z = 0): PathMoveState {
  return { x, y, z, targetX: null, targetZ: null, waypoints: [], waypointIndex: 0 };
}

export function stepAlongPath(
  state: PathMoveState,
  intent: MovementIntent | null,
  dt: number,
  speed: number = DEFAULT_MOVE_SPEED
): PathMoveState {
  if (intent !== null) {
    return {
      ...state,
      targetX: intent.targetX,
      targetZ: intent.targetZ,
      waypoints: [],
      waypointIndex: 0,
    };
  }

  if (state.waypoints.length === 0) {
    return { ...step(state, null, dt, speed), waypoints: [], waypointIndex: 0 };
  }

  let { x, y, z, waypointIndex, waypoints } = state;

  while (waypointIndex < waypoints.length) {
    const wp = waypoints[waypointIndex];
    const dist = Math.hypot(wp.x - x, wp.z - z);
    if (dist > ARRIVAL_EPSILON) break;
    waypointIndex++;
  }

  if (waypointIndex >= waypoints.length) {
    const last = waypoints[waypoints.length - 1];
    return {
      x: last.x,
      y,
      z: last.z,
      targetX: last.x,
      targetZ: last.z,
      waypoints,
      waypointIndex,
    };
  }

  const target = waypoints[waypointIndex];
  const stepped = step(
    { x, y, z, targetX: target.x, targetZ: target.z },
    null,
    dt,
    speed
  );

  return {
    x: stepped.x,
    y: stepped.y,
    z: stepped.z,
    targetX: target.x,
    targetZ: target.z,
    waypoints,
    waypointIndex,
  };
}
