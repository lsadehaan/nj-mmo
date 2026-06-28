import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { attachToBone, detachProp, findBoneByName } from './attachment';
import { KAYKIT_RIGHT_HAND_BONE } from './weapon-manifest';

function buildFixtureSkeleton(): {
  root: THREE.Group;
  handBone: THREE.Bone;
} {
  const root = new THREE.Group();
  const rootBone = new THREE.Bone();
  rootBone.name = 'root';

  const upperArm = new THREE.Bone();
  upperArm.name = 'upperarm.r';
  rootBone.add(upperArm);

  const handBone = new THREE.Bone();
  handBone.name = KAYKIT_RIGHT_HAND_BONE;
  upperArm.add(handBone);

  const skinned = new THREE.SkinnedMesh(
    new THREE.BoxGeometry(0.2, 0.5, 0.2),
    new THREE.MeshBasicMaterial()
  );
  const skeleton = new THREE.Skeleton([rootBone, upperArm, handBone]);
  skinned.bind(skeleton);
  root.add(rootBone);
  root.add(skinned);

  return { root, handBone };
}

describe('attachment', () => {
  it('findBoneByName returns the bone with an exact name match', () => {
    const { root, handBone } = buildFixtureSkeleton();
    expect(findBoneByName(root, KAYKIT_RIGHT_HAND_BONE)).toBe(handBone);
    expect(findBoneByName(root, 'missing')).toBeNull();
  });

  it('attachToBone parents the prop to the bone with local transform', () => {
    const { root, handBone } = buildFixtureSkeleton();
    const prop = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1));

    const ok = attachToBone(root, prop, KAYKIT_RIGHT_HAND_BONE, {
      position: [0.1, 0.2, 0.3],
      rotation: [0, Math.PI / 4, 0],
      scale: 1.5,
    });

    expect(ok).toBe(true);
    expect(prop.parent).toBe(handBone);
    expect(prop.position.toArray()).toEqual([0.1, 0.2, 0.3]);
    expect(prop.scale.x).toBe(1.5);
  });

  it('detachProp removes the prop without disposing the character', () => {
    const { root, handBone } = buildFixtureSkeleton();
    const prop = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1));
    attachToBone(root, prop, KAYKIT_RIGHT_HAND_BONE, {
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: 1,
    });

    detachProp(prop);
    expect(prop.parent).toBeNull();
    expect(handBone.children).not.toContain(prop);
    expect(root.children.length).toBeGreaterThan(0);
  });

  it('attached prop world matrix changes when the bone rotates (attack motion)', () => {
    const { root, handBone } = buildFixtureSkeleton();
    const prop = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1));
    attachToBone(root, prop, KAYKIT_RIGHT_HAND_BONE, {
      position: [0.2, 0, 0],
      rotation: [0, 0, 0],
      scale: 1,
    });

    root.updateMatrixWorld(true);
    const idlePos = prop.getWorldPosition(new THREE.Vector3()).clone();

    handBone.rotation.z = Math.PI / 2;
    root.updateMatrixWorld(true);
    const attackPos = prop.getWorldPosition(new THREE.Vector3());

    expect(idlePos.distanceTo(attackPos)).toBeGreaterThan(0.01);
  });
});
