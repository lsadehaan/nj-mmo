import * as THREE from 'three';

export const SKILL_FLASH_DURATION_MS = 300;

const FLASH_TAG = 'skillFlash';

export function countSkillFlashMeshes(scene: THREE.Scene): number {
  let count = 0;
  scene.traverse((obj) => {
    if (obj.userData[FLASH_TAG]) count += 1;
  });
  return count;
}

export function createSkillFlash(
  scene: THREE.Scene,
  from: { x: number; y: number; z: number },
  to: { x: number; y: number; z: number }
): void {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const len = Math.hypot(dx, dz) || 1;
  const midX = from.x + dx * 0.5;
  const midZ = from.z + dz * 0.5;
  const midY = (from.y + to.y) * 0.5 + 0.5;

  const group = new THREE.Group();
  group.userData[FLASH_TAG] = true;
  group.position.set(midX, midY, midZ);
  group.rotation.y = Math.atan2(dx, dz);

  const burst = new THREE.Mesh(
    new THREE.SphereGeometry(0.35, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xffee88, transparent: true, opacity: 0.9 })
  );
  burst.userData[FLASH_TAG] = true;
  group.add(burst);

  const slash = new THREE.Mesh(
    new THREE.PlaneGeometry(0.2, Math.min(len, 3)),
    new THREE.MeshBasicMaterial({
      color: 0xaaddff,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
    })
  );
  slash.userData[FLASH_TAG] = true;
  slash.rotation.x = -Math.PI / 2;
  group.add(slash);

  scene.add(group);

  window.setTimeout(() => {
    scene.remove(group);
    burst.geometry.dispose();
    (burst.material as THREE.Material).dispose();
    slash.geometry.dispose();
    (slash.material as THREE.Material).dispose();
  }, SKILL_FLASH_DURATION_MS);
}
