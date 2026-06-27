import type { MovementIntent } from '@nj/game-core';

export interface GroundHit {
  x: number;
  z: number;
}

export interface RaycastInput {
  clientX: number;
  clientY: number;
}

export interface RaycastCamera {
  raycaster: {
    setFromCamera: (coords: { x: number; y: number }, camera: unknown) => void;
  };
  camera: unknown;
  ndcFromEvent: (ev: RaycastInput, width: number, height: number) => { x: number; y: number };
}

export interface TerrainMesh {
  mesh: unknown;
}

export function ndcFromPointer(
  ev: RaycastInput,
  width: number,
  height: number,
  offsetX = 0,
  offsetY = 0
): { x: number; y: number } {
  return {
    x: ((ev.clientX - offsetX) / width) * 2 - 1,
    y: -((ev.clientY - offsetY) / height) * 2 + 1,
  };
}

export function raycastGround(
  ev: RaycastInput,
  deps: RaycastCamera,
  terrain: TerrainMesh,
  width: number,
  height: number,
  intersect: (
    raycaster: RaycastCamera['raycaster'],
    mesh: unknown
  ) => Array<{ point: { x: number; y: number; z: number } }>
): GroundHit | null {
  const ndc = deps.ndcFromEvent(ev, width, height);
  deps.raycaster.setFromCamera(ndc, deps.camera);
  const hits = intersect(deps.raycaster, terrain.mesh);
  if (hits.length === 0) return null;
  return { x: hits[0].point.x, z: hits[0].point.z };
}

export function toMovementIntent(hit: GroundHit | null): MovementIntent | null {
  if (!hit) return null;
  return { targetX: hit.x, targetZ: hit.z };
}
