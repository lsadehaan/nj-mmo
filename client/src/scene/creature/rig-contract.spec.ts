import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { REQUIRED_SOCKETS, validateRig, type Rig } from './rig-contract';

function makeRig(sockets: Partial<Record<string, THREE.Object3D>>): Rig {
  const root = new THREE.Group();
  const fullSockets = {} as Rig['sockets'];
  for (const name of REQUIRED_SOCKETS) {
    fullSockets[name] = sockets[name] ?? new THREE.Object3D();
    root.add(fullSockets[name]);
  }
  const bbox = new THREE.Box3().setFromObject(root);
  return { root, sockets: fullSockets, bbox };
}

describe('rig-contract', () => {
  it('validates a rig with all required sockets', () => {
    const rig = makeRig({});
    expect(validateRig(rig)).toEqual({ ok: true, missing: [] });
  });

  it('flags missing sockets', () => {
    const root = new THREE.Group();
    const sockets = {
      root: new THREE.Object3D(),
      spine: new THREE.Object3D(),
    } as Rig['sockets'];
    root.add(sockets.root, sockets.spine);
    const rig: Rig = {
      root,
      sockets,
      bbox: new THREE.Box3(),
    };
    const result = validateRig(rig);
    expect(result.ok).toBe(false);
    expect(result.missing).toEqual(['head', 'handL', 'handR', 'footL', 'footR']);
  });
});
