import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { createTargetRing } from './target-ring-vfx';

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
});
