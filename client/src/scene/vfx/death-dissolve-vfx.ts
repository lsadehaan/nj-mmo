import * as THREE from 'three';
import { ACTION_DURATION_MS, EntityAction } from '@nj/game-core';

export const DEATH_DISSOLVE_DURATION_MS = ACTION_DURATION_MS[EntityAction.Die];
const SINK_Y = 0.15;

export interface DissolveHandle {
  root: THREE.Object3D;
  spawnedAtMs: number;
  materials: Array<{ mat: THREE.Material; originalOpacity: number }>;
}

function collectMaterials(root: THREE.Object3D): Array<{ mat: THREE.Material; originalOpacity: number }> {
  const out: Array<{ mat: THREE.Material; originalOpacity: number }> = [];
  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const mat of mats) {
      if (!('opacity' in mat)) return;
      const m = mat as THREE.MeshLambertMaterial | THREE.MeshBasicMaterial;
      if (m.transparent !== true) m.transparent = true;
      out.push({ mat: m, originalOpacity: m.opacity ?? 1 });
    }
  });
  return out;
}

export function attachDeathDissolve(root: THREE.Object3D, nowMs: number): DissolveHandle {
  const materials = collectMaterials(root);
  return { root, spawnedAtMs: nowMs, materials };
}

export function tickDissolve(handle: DissolveHandle, nowMs: number): boolean {
  const elapsed = nowMs - handle.spawnedAtMs;
  const t = Math.min(1, elapsed / DEATH_DISSOLVE_DURATION_MS);
  const opacity = 1 - t;
  for (const { mat } of handle.materials) {
    (mat as THREE.MeshLambertMaterial).opacity = opacity;
  }
  if (handle.root.userData.dissolveStartY === undefined) {
    handle.root.userData.dissolveStartY = handle.root.position.y;
  }
  const baseY = handle.root.userData.dissolveStartY as number;
  handle.root.position.y = baseY - SINK_Y * t;
  return t >= 1;
}

export function restoreOpacity(handle: DissolveHandle): void {
  for (const { mat, originalOpacity } of handle.materials) {
    (mat as THREE.MeshLambertMaterial).opacity = originalOpacity;
    if (originalOpacity >= 1) {
      (mat as THREE.MeshLambertMaterial).transparent = false;
    }
  }
  const startY = handle.root.userData.dissolveStartY as number | undefined;
  if (startY !== undefined) handle.root.position.y = startY;
  delete handle.root.userData.dissolveStartY;
}

export function sampleDissolveOpacity(handle: DissolveHandle, nowMs: number): number {
  const t = Math.min(1, (nowMs - handle.spawnedAtMs) / DEATH_DISSOLVE_DURATION_MS);
  return 1 - t;
}
