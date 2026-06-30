export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface CameraOffset {
  x: number;
  y: number;
  z: number;
}

export const DEFAULT_CAMERA_OFFSET: CameraOffset = { x: 0, y: 9, z: 14 };

/**
 * Position the camera relative to the player. `yaw` orbits the camera around
 * the player on the horizontal plane (radians); 0 keeps the camera due south
 * looking north (the historical default). Rotating lets the player bring mobs
 * on any side into view so they can be clicked.
 */
export function computeCameraPosition(
  playerPos: Vec3,
  offset: CameraOffset = DEFAULT_CAMERA_OFFSET,
  yaw = 0
): Vec3 {
  const sin = Math.sin(yaw);
  const cos = Math.cos(yaw);
  const rotatedX = offset.x * cos - offset.z * sin;
  const rotatedZ = offset.x * sin + offset.z * cos;
  return {
    x: playerPos.x + rotatedX,
    y: playerPos.y + offset.y,
    z: playerPos.z + rotatedZ,
  };
}

export interface FollowCamera {
  position: Vec3;
  lookAt: (target: Vec3) => void;
}

export function applyTo(
  camera: FollowCamera,
  playerPos: Vec3,
  offset: CameraOffset = DEFAULT_CAMERA_OFFSET,
  yaw = 0
): void {
  const pos = computeCameraPosition(playerPos, offset, yaw);
  camera.position.x = pos.x;
  camera.position.y = pos.y;
  camera.position.z = pos.z;
  camera.lookAt(playerPos);
}
