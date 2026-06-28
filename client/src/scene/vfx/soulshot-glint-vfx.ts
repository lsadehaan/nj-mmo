import * as THREE from 'three';
import { EntityAction } from '@nj/game-core';
import { detectActionEdge } from './vfx-triggers';

export const SOULSHOT_GLINT_TAG = 'soulshotGlint';
export const SOULSHOT_ITEM_ID = 1835;
const GLINT_DURATION_MS = 300;

export function shouldSoulshotGlint(
  soulshotCount: number,
  prevAction: EntityAction,
  prevSeq: number,
  nextAction: EntityAction,
  nextSeq: number
): boolean {
  if (soulshotCount <= 0) return false;
  return (
    detectActionEdge(prevAction, prevSeq, nextAction, nextSeq, 'attack') ||
    detectActionEdge(prevAction, prevSeq, nextAction, nextSeq, 'cast')
  );
}

export function spawnSoulshotGlint(
  scene: THREE.Scene,
  weaponRoot: THREE.Object3D,
  nowMs: number
): THREE.Group {
  const group = new THREE.Group();
  group.userData.vfxTag = SOULSHOT_GLINT_TAG;
  group.userData.spawnedAtMs = nowMs;
  group.position.copy(weaponRoot.position);
  group.position.y += 0.2;

  const glint = new THREE.Mesh(
    new THREE.SphereGeometry(0.08, 6, 6),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95 })
  );
  glint.userData.vfxTag = SOULSHOT_GLINT_TAG;
  group.add(glint);
  weaponRoot.add(group);
  return group;
}

export function tickSoulshotGlint(group: THREE.Group, elapsedMs: number): boolean {
  const t = Math.min(1, elapsedMs / GLINT_DURATION_MS);
  const glint = group.children[0] as THREE.Mesh;
  (glint.material as THREE.MeshBasicMaterial).opacity = (1 - t) * 0.95;
  return t >= 1;
}

export function countSoulshotGlint(scene: THREE.Scene): number {
  let count = 0;
  scene.traverse((obj) => {
    if (obj.userData.vfxTag === SOULSHOT_GLINT_TAG) count += 1;
  });
  return count;
}
