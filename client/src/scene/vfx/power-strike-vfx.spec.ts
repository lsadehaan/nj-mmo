import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';
import { initGameState } from '../../test-hook';
import {
  POWER_STRIKE_DURATION_MS,
  POWER_STRIKE_TAG,
  countPowerStrikeVfx,
  incrementPowerStrikeHook,
  spawnPowerStrikeVfx,
  tickPowerStrikeVfx,
} from './power-strike-vfx';
import { countTaggedVfx } from './vfx-lifecycle';

describe('power-strike-vfx', () => {
  let scene: THREE.Scene;

  beforeEach(() => {
    scene = new THREE.Scene();
    initGameState();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('spawns tagged arc between player and target', () => {
    expect(countPowerStrikeVfx(scene)).toBe(0);
    spawnPowerStrikeVfx(scene, { x: 0, y: 1, z: 0 }, { x: 3, y: 1, z: 0 }, 0);
    expect(countTaggedVfx(scene, POWER_STRIKE_TAG)).toBeGreaterThan(0);
    expect(countTaggedVfx(scene, 'skillFlash')).toBe(0);
  });

  it('increments hook counter on spawn', () => {
    const state = initGameState();
    state.vfx = {
      powerStrikeCount: 0,
      meleeHitCount: 0,
      levelUpCount: 0,
      targetRingVisible: false,
      activeEffectCount: 0,
    };
    incrementPowerStrikeHook(state.vfx);
    expect(state.vfx.powerStrikeCount).toBe(1);
  });

  it('fades opacity over the effect duration', () => {
    const group = spawnPowerStrikeVfx(
      scene,
      { x: 0, y: 1, z: 0 },
      { x: 2, y: 1, z: 0 },
      0
    );
    tickPowerStrikeVfx(group, POWER_STRIKE_DURATION_MS / 2);
    const mesh = group.children[0] as THREE.Mesh;
    const opacity = (mesh.material as THREE.MeshBasicMaterial).opacity;
    expect(opacity).toBeLessThan(0.95);
    expect(opacity).toBeGreaterThan(0);
  });
});
