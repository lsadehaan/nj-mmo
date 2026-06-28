import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export interface StaticPropTemplate {
  scene: THREE.Group;
}

export interface CloneStaticPropOptions {
  scale?: number;
  yOffset?: number;
  rotationY?: number;
}

export interface ScatterPlacement {
  x: number;
  y: number;
  z: number;
  scale: number;
}

const templateCache = new Map<string, Promise<StaticPropTemplate>>();

export function clearGltfStaticTemplateCache(): void {
  templateCache.clear();
}

export function loadGltfStaticTemplate(
  url: string,
  loader: GLTFLoader = new GLTFLoader()
): Promise<StaticPropTemplate> {
  const cached = templateCache.get(url);
  if (cached) return cached;

  const promise = new Promise<StaticPropTemplate>((resolve, reject) => {
    loader.load(
      url,
      (gltf) => {
        const scene = gltf.scene as THREE.Group;
        scene.traverse((node) => {
          if (node instanceof THREE.Mesh) {
            node.castShadow = true;
          }
        });
        resolve({ scene });
      },
      undefined,
      (err) => reject(err instanceof Error ? err : new Error(String(err)))
    );
  });
  templateCache.set(url, promise);
  return promise;
}

export function cloneStaticProp(
  template: StaticPropTemplate,
  opts: CloneStaticPropOptions = {}
): THREE.Object3D {
  const root = new THREE.Group();
  root.name = 'static-prop';

  const cloned = template.scene.clone(true);
  const scale = opts.scale ?? 1;
  cloned.scale.setScalar(scale);
  if (opts.rotationY !== undefined) {
    cloned.rotation.y = opts.rotationY;
  }
  if (opts.yOffset !== undefined) {
    cloned.position.y = opts.yOffset;
  }
  cloned.traverse((node) => {
    if (node instanceof THREE.Mesh) {
      node.castShadow = true;
    }
  });
  root.add(cloned);
  return root;
}

export function createInstancedScatter(
  template: StaticPropTemplate,
  placements: ScatterPlacement[],
  kind: string
): THREE.InstancedMesh | null {
  if (placements.length === 0) return null;

  const meshes: THREE.Mesh[] = [];
  template.scene.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      meshes.push(child);
    }
  });
  if (meshes.length === 0) return null;

  const sourceMesh = meshes[0];
  const instanced = new THREE.InstancedMesh(
    sourceMesh.geometry,
    sourceMesh.material,
    placements.length
  );
  instanced.name = `scatter-${kind}-instanced`;
  instanced.userData.scatterKind = kind;
  instanced.castShadow = true;

  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scaleVec = new THREE.Vector3();

  for (let i = 0; i < placements.length; i++) {
    const p = placements[i];
    position.set(p.x, p.y, p.z);
    quaternion.identity();
    scaleVec.set(p.scale, p.scale, p.scale);
    matrix.compose(position, quaternion, scaleVec);
    instanced.setMatrixAt(i, matrix);
  }
  instanced.instanceMatrix.needsUpdate = true;
  return instanced;
}
