import * as THREE from 'three';
import { ACTION_DURATION_MS, EntityAction } from '@nj/game-core';
import type { GameStateVfx } from '../../test-hook';

export const POWER_STRIKE_TAG = 'powerStrike';
export const POWER_STRIKE_DURATION_MS = ACTION_DURATION_MS[EntityAction.Cast];

export function countPowerStrikeVfx(scene: THREE.Scene): number {
  let count = 0;
  scene.traverse((obj) => {
    if (obj.userData.vfxTag === POWER_STRIKE_TAG) count += 1;
  });
  return count;
}

export function spawnPowerStrikeVfx(
  scene: THREE.Scene,
  from: { x: number; y: number; z: number },
  to: { x: number; y: number; z: number },
  nowMs: number
): THREE.Group {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const len = Math.hypot(dx, dz) || 1;
  const midX = from.x + dx * 0.5;
  const midZ = from.z + dz * 0.5;
  const midY = (from.y + to.y) * 0.5 + 0.5;

  const group = new THREE.Group();
  group.userData.vfxTag = POWER_STRIKE_TAG;
  group.userData.spawnedAtMs = nowMs;
  group.position.set(midX, midY, midZ);
  group.rotation.y = Math.atan2(dx, dz);

  const impact = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xffcc44, transparent: true, opacity: 0.95 })
  );
  impact.userData.vfxTag = POWER_STRIKE_TAG;
  group.add(impact);

  const slash = new THREE.Mesh(
    new THREE.PlaneGeometry(0.35, Math.min(len, 3.2)),
    new THREE.MeshBasicMaterial({
      color: 0xffeeaa,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
    })
  );
  slash.userData.vfxTag = POWER_STRIKE_TAG;
  slash.rotation.x = -Math.PI / 2;
  group.add(slash);

  const trail = new THREE.Mesh(
    new THREE.PlaneGeometry(0.12, Math.min(len, 2.8)),
    new THREE.MeshBasicMaterial({
      color: 0xaaddff,
      transparent: true,
      opacity: 0.75,
      side: THREE.DoubleSide,
    })
  );
  trail.userData.vfxTag = POWER_STRIKE_TAG;
  trail.rotation.x = -Math.PI / 2;
  trail.position.y = 0.08;
  group.add(trail);

  scene.add(group);
  return group;
}

export function tickPowerStrikeVfx(group: THREE.Group, elapsedMs: number): void {
  const t = Math.min(1, elapsedMs / POWER_STRIKE_DURATION_MS);
  group.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    const mat = obj.material as THREE.MeshBasicMaterial;
    mat.opacity = (1 - t) * (obj === group.children[0] ? 0.95 : 0.85);
    const scale = 1 + t * 0.35;
    obj.scale.set(scale, scale, scale);
  });
}

export function incrementPowerStrikeHook(vfx: GameStateVfx): void {
  vfx.powerStrikeCount += 1;
}
