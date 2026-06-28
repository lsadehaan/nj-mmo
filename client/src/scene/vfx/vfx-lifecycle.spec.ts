import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';
import {
  countTaggedVfx,
  createPool,
  disposeObject3D,
  tickActiveVfx,
  type TimedVfxEntry,
} from './vfx-lifecycle';

const TEST_TAG = 'testVfx';

describe('vfx-lifecycle', () => {
  let scene: THREE.Scene;

  beforeEach(() => {
    scene = new THREE.Scene();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('countTaggedVfx returns objects with matching userData.vfxTag', () => {
    const a = new THREE.Group();
    a.userData.vfxTag = TEST_TAG;
    const b = new THREE.Mesh();
    b.userData.vfxTag = TEST_TAG;
    const c = new THREE.Mesh();
    c.userData.vfxTag = 'other';
    scene.add(a, b, c);
    expect(countTaggedVfx(scene, TEST_TAG)).toBe(2);
  });

  it('disposeObject3D disposes mesh geometry and materials', () => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    const geoDispose = vi.spyOn(mesh.geometry, 'dispose');
    const matDispose = vi.spyOn(mesh.material as THREE.Material, 'dispose');
    disposeObject3D(mesh);
    expect(geoDispose).toHaveBeenCalled();
    expect(matDispose).toHaveBeenCalled();
  });

  it('pool reuses oldest slot when at capacity', () => {
    const pool = createPool(2, (i) => ({ id: i }));
    const a = pool.acquire();
    const b = pool.acquire();
    expect(pool.activeCount()).toBe(2);
    pool.release(a);
    const c = pool.acquire();
    expect(c).toBe(a);
    pool.release(b);
    pool.release(c);
    expect(pool.activeCount()).toBe(0);
  });

  it('tickActiveVfx removes expired entries and disposes them', () => {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.1),
      new THREE.MeshBasicMaterial()
    );
    mesh.userData.vfxTag = TEST_TAG;
    scene.add(mesh);
    const now = 1000;
    const entries: TimedVfxEntry[] = [
      {
        root: mesh,
        tag: TEST_TAG,
        spawnedAtMs: now,
        expiresAtMs: now + 250,
      },
    ];

    const afterTick = tickActiveVfx(scene, entries, now + 100);
    expect(afterTick).toHaveLength(1);
    expect(countTaggedVfx(scene, TEST_TAG)).toBe(1);

    const cleared = tickActiveVfx(scene, afterTick, now + 300);
    expect(cleared).toHaveLength(0);
    expect(countTaggedVfx(scene, TEST_TAG)).toBe(0);
  });
});
