import * as THREE from 'three';
import { countTaggedVfx, createPool, disposeObject3D } from './vfx-lifecycle';
import type { GameStateVfx } from '../../test-hook';

export const MELEE_HIT_TAG = 'meleeHit';
export const MELEE_HIT_DURATION_MS = 250;
export const MELEE_HIT_POOL_SIZE = 8;
const TORSO_OFFSET_Y = 0.9;

interface MeleeHitSlot {
  group: THREE.Group;
  points: THREE.Points;
}

function createMeleeHitSlot(): MeleeHitSlot {
  const count = 24;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const r = 0.15 + (i % 5) * 0.04;
    positions[i * 3] = Math.cos(angle) * r;
    positions[i * 3 + 1] = (i % 7) * 0.05;
    positions[i * 3 + 2] = Math.sin(angle) * r;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: 0xffaa44,
    size: 0.12,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
  });
  const points = new THREE.Points(geometry, material);

  const group = new THREE.Group();
  group.userData.vfxTag = MELEE_HIT_TAG;
  group.visible = false;
  group.add(points);
  return { group, points };
}

export function createMeleeHitPool(scene: THREE.Scene) {
  const pool = createPool(MELEE_HIT_POOL_SIZE, () => {
    const slot = createMeleeHitSlot();
    scene.add(slot.group);
    return slot;
  });
  return pool;
}

export function spawnMeleeHitVfx(
  pool: ReturnType<typeof createMeleeHitPool>,
  scene: THREE.Scene,
  pos: { x: number; y: number; z: number },
  nowMs: number
): MeleeHitSlot {
  const slot = pool.acquire();
  slot.group.position.set(pos.x, pos.y + TORSO_OFFSET_Y, pos.z);
  slot.group.visible = true;
  slot.group.userData.spawnedAtMs = nowMs;
  slot.group.userData.expiresAtMs = nowMs + MELEE_HIT_DURATION_MS;
  (slot.points.material as THREE.PointsMaterial).opacity = 0.95;
  slot.points.scale.setScalar(1);
  return slot;
}

export function tickMeleeHitSlot(slot: MeleeHitSlot, elapsedMs: number): boolean {
  const t = Math.min(1, elapsedMs / MELEE_HIT_DURATION_MS);
  const mat = slot.points.material as THREE.PointsMaterial;
  mat.opacity = (1 - t) * 0.95;
  slot.points.scale.setScalar(1 + t * 1.5);
  return t >= 1;
}

export function retireMeleeHitSlot(
  pool: ReturnType<typeof createMeleeHitPool>,
  slot: MeleeHitSlot
): void {
  slot.group.visible = false;
  pool.release(slot);
}

export function countMeleeHitVfx(scene: THREE.Scene): number {
  return countTaggedVfx(scene, MELEE_HIT_TAG);
}

export function incrementMeleeHitHook(vfx: GameStateVfx): void {
  vfx.meleeHitCount += 1;
}

export type { MeleeHitSlot };
