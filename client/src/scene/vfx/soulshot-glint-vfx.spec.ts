import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { EntityAction } from '@nj/game-core';
import {
  countSoulshotGlint,
  shouldSoulshotGlint,
  spawnSoulshotGlint,
} from './soulshot-glint-vfx';

describe('soulshot-glint-vfx', () => {
  let scene: THREE.Scene;

  beforeEach(() => {
    scene = new THREE.Scene();
  });

  it('spawns glint when soulshots present and attack seq bumps', () => {
    expect(
      shouldSoulshotGlint(5, EntityAction.None, 0, EntityAction.Attack, 1)
    ).toBe(true);
    const weapon = new THREE.Group();
    scene.add(weapon);
    spawnSoulshotGlint(scene, weapon, 0);
    expect(countSoulshotGlint(scene)).toBeGreaterThan(0);
  });

  it('does not spawn without soulshots', () => {
    expect(
      shouldSoulshotGlint(0, EntityAction.None, 0, EntityAction.Attack, 1)
    ).toBe(false);
  });
});
