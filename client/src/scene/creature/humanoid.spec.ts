import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { REQUIRED_SOCKETS, validateRig } from './rig-contract';
import { buildHumanoid } from './humanoid';

describe('buildHumanoid', () => {
  it('builds distinct torso, head, arm, and leg segments', () => {
    const rig = buildHumanoid();
    const names = new Set<string>();
    rig.root.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        names.add(child.name);
      }
    });
    expect(names.has('torso')).toBe(true);
    expect(names.has('head')).toBe(true);
    expect(names.has('armL')).toBe(true);
    expect(names.has('armR')).toBe(true);
    expect(names.has('legL')).toBe(true);
    expect(names.has('legR')).toBe(true);
  });

  it('exposes all required sockets', () => {
    const rig = buildHumanoid();
    expect(validateRig(rig).ok).toBe(true);
    for (const socket of REQUIRED_SOCKETS) {
      expect(rig.sockets[socket]).toBeInstanceOf(THREE.Object3D);
    }
  });

  it('stands 1.6–2.0 m tall with feet at y≈0', () => {
    const rig = buildHumanoid();
    rig.root.updateMatrixWorld(true);
    const bbox = new THREE.Box3().setFromObject(rig.root);
    const height = bbox.max.y - bbox.min.y;
    expect(height).toBeGreaterThanOrEqual(1.6);
    expect(height).toBeLessThanOrEqual(2.0);
    expect(Math.abs(bbox.min.y)).toBeLessThanOrEqual(0.05);
  });

  it('mirrors left/right socket pairs across x-axis', () => {
    const rig = buildHumanoid();
    rig.root.updateMatrixWorld(true);
    const left = new THREE.Vector3();
    const right = new THREE.Vector3();
    rig.sockets.handL.getWorldPosition(left);
    rig.sockets.handR.getWorldPosition(right);
    expect(Math.abs(left.x + right.x)).toBeLessThanOrEqual(0.01);

    rig.sockets.footL.getWorldPosition(left);
    rig.sockets.footR.getWorldPosition(right);
    expect(Math.abs(left.x + right.x)).toBeLessThanOrEqual(0.01);
  });
});
