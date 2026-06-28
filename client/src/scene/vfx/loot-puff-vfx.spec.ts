import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import {
  LOOT_PUFF_DURATION_MS,
  countLootPuffVfx,
  spawnLootPuffVfx,
  tickLootPuffVfx,
} from './loot-puff-vfx';
import { disposeObject3D } from './vfx-lifecycle';

describe('loot-puff-vfx', () => {
  let scene: THREE.Scene;

  beforeEach(() => {
    scene = new THREE.Scene();
  });

  it('spawns sparkle at death position and cleans up', () => {
    const group = spawnLootPuffVfx(scene, { x: 1, y: 0, z: 2 }, 0);
    expect(countLootPuffVfx(scene)).toBeGreaterThan(0);
    tickLootPuffVfx(group, LOOT_PUFF_DURATION_MS);
    scene.remove(group);
    disposeObject3D(group);
    expect(countLootPuffVfx(scene)).toBe(0);
  });
});
