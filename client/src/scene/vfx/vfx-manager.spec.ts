import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { EntityAction } from '@nj/game-core';
import { createVfxManager } from './vfx-manager';

describe('vfx-manager core', () => {
  let scene: THREE.Scene;

  beforeEach(() => {
    scene = new THREE.Scene();
  });

  it('returns zeroed hook snapshot initially', () => {
    const mgr = createVfxManager(scene);
    expect(mgr.getHookSnapshot()).toEqual({
      powerStrikeCount: 0,
      meleeHitCount: 0,
      levelUpCount: 0,
      targetRingVisible: false,
      activeEffectCount: 0,
    });
  });

  it('tracks player and mob syncs without throwing', () => {
    const mgr = createVfxManager(scene);
    expect(() => {
      mgr.syncPlayer({
        hp: 100,
        level: 1,
        action: EntityAction.None,
        actionSeq: 0,
        x: 0,
        y: 0,
        z: 0,
      });
      mgr.syncMob({
        id: 'mob-1',
        hp: 50,
        x: 1,
        y: 0,
        z: 2,
        action: EntityAction.None,
        actionSeq: 0,
      });
      mgr.tick(0);
    }).not.toThrow();
  });
});
