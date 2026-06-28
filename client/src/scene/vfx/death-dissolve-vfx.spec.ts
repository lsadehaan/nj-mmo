import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  DEATH_DISSOLVE_DURATION_MS,
  attachDeathDissolve,
  restoreOpacity,
  sampleDissolveOpacity,
  tickDissolve,
} from './death-dissolve-vfx';

describe('death-dissolve-vfx', () => {
  it('fades opacity to ~0.5 at 600ms', () => {
    const root = new THREE.Group();
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshLambertMaterial({ color: 0xffffff })
    );
    root.add(mesh);
    const handle = attachDeathDissolve(root, 0);
    const opacity = sampleDissolveOpacity(handle, 600);
    expect(opacity).toBeGreaterThanOrEqual(0.4);
    expect(opacity).toBeLessThanOrEqual(0.6);
  });

  it('completes dissolve and restores opacity for reuse', () => {
    const root = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    root.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat));
    const handle = attachDeathDissolve(root, 0);
    expect(tickDissolve(handle, DEATH_DISSOLVE_DURATION_MS)).toBe(true);
    restoreOpacity(handle);
    expect(mat.opacity).toBe(1);
  });
});
