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

export const DEFAULT_CAMERA_OFFSET: CameraOffset = { x: 0, y: 12, z: 18 };

export function computeCameraPosition(
  playerPos: Vec3,
  offset: CameraOffset = DEFAULT_CAMERA_OFFSET
): Vec3 {
  return {
    x: playerPos.x + offset.x,
    y: playerPos.y + offset.y,
    z: playerPos.z + offset.z,
  };
}

export interface FollowCamera {
  position: Vec3;
  lookAt: (target: Vec3) => void;
}

export function applyTo(
  camera: FollowCamera,
  playerPos: Vec3,
  offset: CameraOffset = DEFAULT_CAMERA_OFFSET
): void {
  const pos = computeCameraPosition(playerPos, offset);
  camera.position.x = pos.x;
  camera.position.y = pos.y;
  camera.position.z = pos.z;
  camera.lookAt(playerPos);
}
