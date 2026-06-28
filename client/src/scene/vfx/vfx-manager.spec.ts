import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { EntityAction } from '@nj/game-core';
import { createVfxManager } from './vfx-manager';

const basePlayer = {
  hp: 100,
  level: 1,
  action: EntityAction.None,
  actionSeq: 0,
  x: 0,
  y: 1,
  z: 0,
};

describe('vfx-manager', () => {
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

  it('increments meleeHitCount when mob hp decreases', () => {
    const mgr = createVfxManager(scene);
    mgr.syncMob({
      id: 'mob-1',
      hp: 41,
      x: 2,
      y: 0,
      z: 0,
      action: EntityAction.None,
      actionSeq: 0,
    });
    mgr.syncMob({
      id: 'mob-1',
      hp: 24,
      x: 2,
      y: 0,
      z: 0,
      action: EntityAction.None,
      actionSeq: 0,
    });
    expect(mgr.getHookSnapshot().meleeHitCount).toBe(1);
  });

  it('increments powerStrikeCount on cast actionSeq bump with target', () => {
    const mgr = createVfxManager(scene);
    mgr.setTargetMobId('mob-1');
    mgr.syncMob({
      id: 'mob-1',
      hp: 50,
      x: 3,
      y: 0,
      z: 0,
      action: EntityAction.None,
      actionSeq: 0,
    });
    mgr.syncPlayer({ ...basePlayer });
    mgr.syncPlayer({
      ...basePlayer,
      action: EntityAction.Cast,
      actionSeq: 1,
    });
    expect(mgr.getHookSnapshot().powerStrikeCount).toBe(1);
  });

  it('increments levelUpCount when player level increases', () => {
    const mgr = createVfxManager(scene);
    mgr.syncPlayer({ ...basePlayer, level: 1 });
    mgr.syncPlayer({ ...basePlayer, level: 2 });
    expect(mgr.getHookSnapshot().levelUpCount).toBe(1);
  });

  it('tracks activeEffectCount for spawned timed VFX', () => {
    const mgr = createVfxManager(scene);
    mgr.setTargetMobId('mob-1');
    mgr.syncMob({
      id: 'mob-1',
      hp: 50,
      x: 2,
      y: 0,
      z: 0,
      action: EntityAction.None,
      actionSeq: 0,
    });
    mgr.syncPlayer({ ...basePlayer });
    mgr.syncPlayer({
      ...basePlayer,
      action: EntityAction.Cast,
      actionSeq: 1,
    });
    expect(mgr.getHookSnapshot().activeEffectCount).toBeGreaterThan(0);
    mgr.tick(performance.now() + 900);
    expect(mgr.getHookSnapshot().activeEffectCount).toBe(0);
  });

  it('sets targetRingVisible when target mob is valid', () => {
    const mgr = createVfxManager(scene);
    mgr.syncMob({
      id: 'mob-1',
      hp: 50,
      x: 1,
      y: 0,
      z: 2,
      action: EntityAction.None,
      actionSeq: 0,
    });
    mgr.setTargetMobId('mob-1');
    expect(mgr.getHookSnapshot().targetRingVisible).toBe(true);
    mgr.setTargetMobId(null);
    expect(mgr.getHookSnapshot().targetRingVisible).toBe(false);
  });
});
