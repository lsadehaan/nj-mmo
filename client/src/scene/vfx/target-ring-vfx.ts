import * as THREE from 'three';

export const TARGET_RING_TAG = 'targetRing';
const RING_COLOR = 0xffcc44;
const RING_OPACITY = 0.85;

export interface TargetRing {
  group: THREE.Group;
  showAt: (pos: { x: number; y: number; z: number }) => void;
  hide: () => void;
  follow: (pos: { x: number; y: number; z: number }) => void;
  isVisible: () => boolean;
}

export function createTargetRing(scene: THREE.Scene): TargetRing {
  const geometry = new THREE.RingGeometry(0.55, 0.75, 32);
  const material = new THREE.MeshBasicMaterial({
    color: RING_COLOR,
    transparent: true,
    opacity: RING_OPACITY,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.userData.vfxTag = TARGET_RING_TAG;

  const group = new THREE.Group();
  group.userData.vfxTag = TARGET_RING_TAG;
  group.visible = false;
  group.add(mesh);
  scene.add(group);

  return {
    group,
    showAt(pos) {
      group.position.set(pos.x, pos.y + 0.05, pos.z);
      group.visible = true;
    },
    hide() {
      group.visible = false;
    },
    follow(pos) {
      if (!group.visible) return;
      group.position.set(pos.x, pos.y + 0.05, pos.z);
    },
    isVisible() {
      return group.visible;
    },
  };
}
