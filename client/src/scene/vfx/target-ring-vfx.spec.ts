import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { EntityAction } from '@nj/game-core';
import { createTargetRing } from './target-ring-vfx';
import { createVfxManager } from './vfx-manager';

describe('target-ring-vfx', () => {
  let scene: THREE.Scene;

  beforeEach(() => {
    scene = new THREE.Scene();
  });

  it('shows at mob feet and follows position updates', () => {
    const ring = createTargetRing(scene);
    expect(ring.isVisible()).toBe(false);
    ring.showAt({ x: 1, y: 0, z: 2 });
    expect(ring.isVisible()).toBe(true);
    expect(ring.group.position.x).toBe(1);
    ring.follow({ x: 3, y: 0, z: 4 });
    expect(ring.group.position.x).toBe(3);
    expect(ring.group.position.z).toBe(4);
  });

  it('hides without destroying the ring mesh', () => {
    const ring = createTargetRing(scene);
    ring.showAt({ x: 0, y: 0, z: 0 });
    ring.hide();
    expect(ring.isVisible()).toBe(false);
    expect(ring.group.parent).toBe(scene);
  });

  it('hides the ring when targeted mob hp reaches zero', () => {
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

    mgr.syncMob({
      id: 'mob-1',
      hp: 0,
      x: 1,
      y: 0,
      z: 2,
      action: EntityAction.Die,
      actionSeq: 1,
    });
    expect(mgr.getHookSnapshot().targetRingVisible).toBe(false);
  });
});
