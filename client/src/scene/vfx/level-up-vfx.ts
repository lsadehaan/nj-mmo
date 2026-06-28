import * as THREE from 'three';
import { countTaggedVfx } from './vfx-lifecycle';
import type { GameStateVfx } from '../../test-hook';

export const LEVEL_UP_TAG = 'levelUp';
export const LEVEL_UP_DURATION_MS = 1000;

export function spawnLevelUpVfx(
  scene: THREE.Scene,
  pos: { x: number; y: number; z: number },
  nowMs: number
): THREE.Group {
  const count = 36;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const r = 0.3 + (i % 4) * 0.15;
    positions[i * 3] = Math.cos(angle) * r;
    positions[i * 3 + 1] = (i % 8) * 0.12;
    positions[i * 3 + 2] = Math.sin(angle) * r;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: 0xffcc44,
    size: 0.14,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
  });
  const points = new THREE.Points(geometry, material);
  points.userData.vfxTag = LEVEL_UP_TAG;

  const group = new THREE.Group();
  group.userData.vfxTag = LEVEL_UP_TAG;
  group.userData.spawnedAtMs = nowMs;
  group.position.set(pos.x, pos.y, pos.z);
  group.add(points);
  scene.add(group);
  return group;
}

export function tickLevelUpVfx(group: THREE.Group, elapsedMs: number): void {
  const t = Math.min(1, elapsedMs / LEVEL_UP_DURATION_MS);
  const points = group.children[0] as THREE.Points;
  const mat = points.material as THREE.PointsMaterial;
  mat.opacity = (1 - t) * 0.95;
  points.position.y = t * 1.5;
  points.scale.setScalar(1 + t * 0.8);
}

export function countLevelUpVfx(scene: THREE.Scene): number {
  return countTaggedVfx(scene, LEVEL_UP_TAG);
}

export function incrementLevelUpHook(vfx: GameStateVfx): void {
  vfx.levelUpCount += 1;
}
