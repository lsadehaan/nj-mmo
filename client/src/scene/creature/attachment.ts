import * as THREE from 'three';

export interface GripTransform {
  position: THREE.Vector3Tuple;
  rotation: THREE.EulerTuple;
  scale: number;
}

export function findBoneByName(root: THREE.Object3D, boneName: string): THREE.Bone | null {
  let found: THREE.Bone | null = null;
  root.traverse((node) => {
    if (found) return;
    const skinned = node as THREE.SkinnedMesh;
    if (!skinned.isSkinnedMesh || !skinned.skeleton) return;
    for (const bone of skinned.skeleton.bones) {
      if (bone.name === boneName) {
        found = bone;
        return;
      }
    }
  });
  return found;
}

export function attachToBone(
  root: THREE.Object3D,
  prop: THREE.Object3D,
  boneName: string,
  transform: GripTransform
): boolean {
  const bone = findBoneByName(root, boneName);
  if (!bone) {
    console.warn(`attachToBone: bone "${boneName}" not found`);
    return false;
  }
  prop.position.set(...transform.position);
  prop.rotation.set(...transform.rotation);
  prop.scale.setScalar(transform.scale);
  bone.add(prop);
  return true;
}

export function detachProp(prop: THREE.Object3D): void {
  prop.removeFromParent();
}
