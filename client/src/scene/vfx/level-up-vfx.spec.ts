import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { initGameState } from '../../test-hook';
import {
  LEVEL_UP_DURATION_MS,
  countLevelUpVfx,
  incrementLevelUpHook,
  spawnLevelUpVfx,
  tickLevelUpVfx,
} from './level-up-vfx';
import { disposeObject3D } from './vfx-lifecycle';

describe('level-up-vfx', () => {
  let scene: THREE.Scene;

  beforeEach(() => {
    scene = new THREE.Scene();
    initGameState();
  });

  it('spawns and cleans up after duration', () => {
    const group = spawnLevelUpVfx(scene, { x: 1, y: 0, z: 2 }, 0);
    expect(countLevelUpVfx(scene)).toBeGreaterThan(0);
    tickLevelUpVfx(group, LEVEL_UP_DURATION_MS);
    scene.remove(group);
    disposeObject3D(group);
    expect(countLevelUpVfx(scene)).toBe(0);
  });

  it('increments hook counter', () => {
    const state = initGameState();
    state.vfx = {
      powerStrikeCount: 0,
      meleeHitCount: 0,
      levelUpCount: 0,
      targetRingVisible: false,
      activeEffectCount: 0,
    };
    incrementLevelUpHook(state.vfx);
    expect(state.vfx.levelUpCount).toBe(1);
  });
});
