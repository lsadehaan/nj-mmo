import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { cloneStaticProp, loadGltfStaticTemplate } from './static-prop';
import { listLandmarkEntries, type LandmarkEntry } from './landmark-manifest';
import type { EnvironmentCategoryResult } from './environment-renderer';

export interface BuildLandmarksOptions {
  scene: THREE.Scene;
  sampleHeight: (x: number, z: number) => number;
  loader?: GLTFLoader;
}

function addLandmarkPrimitive(entry: LandmarkEntry, y: number): THREE.Group {
  const group = new THREE.Group();
  const color =
    entry.name === 'Obelisk'
      ? 0xb8b8c0
      : entry.name === 'HarborDock'
        ? 0x6b4a2f
        : entry.name === 'FieldShrine'
          ? 0x9a8f7a
          : 0x7a7a72;
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(2, 4, 2),
    new THREE.MeshStandardMaterial({ color, flatShading: true, side: THREE.DoubleSide })
  );
  mesh.position.y = 2;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  group.position.set(entry.x, y, entry.z);
  group.rotation.y = entry.yRotation;
  return group;
}

export async function buildLandmarkScene(
  opts: BuildLandmarksOptions
): Promise<EnvironmentCategoryResult> {
  const loader = opts.loader ?? new GLTFLoader();
  let meshCount = 0;

  for (const entry of listLandmarkEntries()) {
    const y = opts.sampleHeight(entry.x, entry.z);
    let template;
    try {
      template = await loadGltfStaticTemplate(entry.model, loader);
    } catch {
      template = null;
    }
    if (template) {
      const prop = cloneStaticProp(template, {
        scale: entry.scale,
        rotationY: entry.yRotation,
      });
      prop.position.set(entry.x, y, entry.z);
      opts.scene.add(prop);
      meshCount++;
    } else {
      opts.scene.add(addLandmarkPrimitive(entry, y));
    }
  }

  return {
    count: listLandmarkEntries().length,
    renderKind: meshCount === listLandmarkEntries().length ? 'mesh' : 'primitive',
  };
}
