import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import {
  MELEE_HIT_DURATION_MS,
  MELEE_HIT_POOL_SIZE,
  countMeleeHitVfx,
  createMeleeHitPool,
  retireMeleeHitSlot,
  spawnMeleeHitVfx,
  tickMeleeHitSlot,
} from './melee-hit-vfx';

describe('melee-hit-vfx', () => {
  let scene: THREE.Scene;

  beforeEach(() => {
    scene = new THREE.Scene();
  });

  it('ninth spawn reuses a pool slot', () => {
    const pool = createMeleeHitPool(scene);
    const slots = [];
    for (let i = 0; i < MELEE_HIT_POOL_SIZE + 1; i++) {
      slots.push(spawnMeleeHitVfx(pool, scene, { x: i, y: 0, z: 0 }, i));
    }
    expect(pool.activeCount()).toBe(MELEE_HIT_POOL_SIZE);
    expect(slots[0]).toBe(slots[MELEE_HIT_POOL_SIZE]);
  });

  it('retires after 250ms and decreases visible active hits', () => {
    const pool = createMeleeHitPool(scene);
    const slot = spawnMeleeHitVfx(pool, scene, { x: 0, y: 0, z: 0 }, 0);
    expect(slot.group.visible).toBe(true);
    const done = tickMeleeHitSlot(slot, MELEE_HIT_DURATION_MS);
    expect(done).toBe(true);
    retireMeleeHitSlot(pool, slot);
    expect(slot.group.visible).toBe(false);
    expect(countMeleeHitVfx(scene)).toBe(MELEE_HIT_POOL_SIZE);
  });
});
