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
            node.receiveShadow = true;
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
      node.receiveShadow = true;
    }
  });
  root.add(cloned);
  return root;
}

export function createInstancedScatter(
  template: StaticPropTemplate,
  placements: ScatterPlacement[],
  kind: string
): THREE.InstancedMesh[] {
  if (placements.length === 0) return [];

  // Bake each mesh's transform relative to the template root so multi-mesh
  // props (e.g. a tree's separate trunk + foliage meshes) all render — not
  // just the first mesh.
  template.scene.updateMatrixWorld(true);
  const meshes: THREE.Mesh[] = [];
  template.scene.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      meshes.push(child);
    }
  });
  if (meshes.length === 0) return [];

  const placementMatrix = new THREE.Matrix4();
  const instanceMatrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scaleVec = new THREE.Vector3();

  const result: THREE.InstancedMesh[] = [];
  for (let m = 0; m < meshes.length; m++) {
    const sourceMesh = meshes[m];
    const instanced = new THREE.InstancedMesh(
      sourceMesh.geometry,
      sourceMesh.material,
      placements.length
    );
    instanced.name = `scatter-${kind}-${m}-instanced`;
    instanced.userData.scatterKind = kind;
    instanced.castShadow = true;
    instanced.receiveShadow = true;

    for (let i = 0; i < placements.length; i++) {
      const p = placements[i];
      position.set(p.x, p.y, p.z);
      quaternion.identity();
      scaleVec.set(p.scale, p.scale, p.scale);
      placementMatrix.compose(position, quaternion, scaleVec);
      instanceMatrix.multiplyMatrices(placementMatrix, sourceMesh.matrixWorld);
      instanced.setMatrixAt(i, instanceMatrix);
    }
    instanced.instanceMatrix.needsUpdate = true;
    result.push(instanced);
  }
  return result;
}
