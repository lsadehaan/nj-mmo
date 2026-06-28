import * as THREE from 'three';
import { countTaggedVfx } from './vfx-lifecycle';

export const LOOT_PUFF_TAG = 'lootPuff';
export const LOOT_PUFF_DURATION_MS = 800;

export function spawnLootPuffVfx(
  scene: THREE.Scene,
  pos: { x: number; y: number; z: number },
  nowMs: number
): THREE.Group {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(18);
  for (let i = 0; i < 6; i++) {
    positions[i * 3] = (i - 2.5) * 0.15;
    positions[i * 3 + 1] = 0.05 + (i % 2) * 0.1;
    positions[i * 3 + 2] = ((i % 3) - 1) * 0.15;
  }
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const points = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      color: 0xffee88,
      size: 0.1,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    })
  );

  const group = new THREE.Group();
  group.userData.vfxTag = LOOT_PUFF_TAG;
  group.userData.spawnedAtMs = nowMs;
  group.position.set(pos.x, pos.y + 0.05, pos.z);
  group.add(points);
  scene.add(group);
  return group;
}

export function tickLootPuffVfx(group: THREE.Group, elapsedMs: number): void {
  const t = Math.min(1, elapsedMs / LOOT_PUFF_DURATION_MS);
  const points = group.children[0] as THREE.Points;
  (points.material as THREE.PointsMaterial).opacity = (1 - t) * 0.9;
  points.position.y = t * 0.3;
}

export function countLootPuffVfx(scene: THREE.Scene): number {
  return countTaggedVfx(scene, LOOT_PUFF_TAG);
}
