import { describe, it, expect, afterEach, vi } from 'vitest';
import * as THREE from 'three';
import {
  clearGltfStaticTemplateCache,
  cloneStaticProp,
  createInstancedScatter,
  loadGltfStaticTemplate,
  type StaticPropTemplate,
} from './static-prop';

function makeStaticTemplate(): StaticPropTemplate {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshLambertMaterial({ color: 0x8b4513, flatShading: true })
  );
  const scene = new THREE.Group();
  scene.add(mesh);
  return { scene };
}

describe('loadGltfStaticTemplate', () => {
  afterEach(() => {
    clearGltfStaticTemplateCache();
  });

  it('fetches and caches exactly one parsed template per URL', async () => {
    const load = vi.fn(
      (_url: string, onLoad: (gltf: { scene: THREE.Group }) => void) => {
        onLoad(makeStaticTemplate());
      }
    );
    const loader = { load } as unknown as import('three/examples/jsm/loaders/GLTFLoader.js').GLTFLoader;

    const [a, b] = await Promise.all([
      loadGltfStaticTemplate('/models/props/environment/Tree.glb', loader),
      loadGltfStaticTemplate('/models/props/environment/Tree.glb', loader),
    ]);

    expect(load).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
    expect(a.scene).toBeInstanceOf(THREE.Group);
  });
});

describe('cloneStaticProp', () => {
  afterEach(() => {
    clearGltfStaticTemplateCache();
  });

  it('returns distinct roots for N clones from one template', () => {
    const template = makeStaticTemplate();
    const a = cloneStaticProp(template);
    const b = cloneStaticProp(template);

    expect(a).not.toBe(b);
    expect(a.children[0]).not.toBe(b.children[0]);
  });

  it('returns a plain Object3D without animation mixer state', () => {
    const root = cloneStaticProp(makeStaticTemplate());
    expect(root).toBeInstanceOf(THREE.Group);
    expect((root as { update?: unknown }).update).toBeUndefined();
    let mixerInUserData = false;
    root.traverse((node) => {
      if (node.userData && 'mixer' in node.userData) mixerInUserData = true;
    });
    expect(mixerInUserData).toBe(false);
  });

  it('VFU-02: sets castShadow and receiveShadow on every cloned mesh', () => {
    const root = cloneStaticProp(makeStaticTemplate());
    let meshCount = 0;
    root.traverse((node) => {
      if (node instanceof THREE.Mesh) {
        meshCount++;
        expect(node.castShadow).toBe(true);
        expect(node.receiveShadow).toBe(true);
      }
    });
    expect(meshCount).toBeGreaterThan(0);
  });
});

describe('loadGltfStaticTemplate shadow flags', () => {
  afterEach(() => {
    clearGltfStaticTemplateCache();
  });

  it('VFU-02: sets castShadow and receiveShadow on every loaded template mesh', async () => {
    const load = vi.fn(
      (_url: string, onLoad: (gltf: { scene: THREE.Group }) => void) => {
        onLoad(makeStaticTemplate());
      }
    );
    const loader = { load } as unknown as import('three/examples/jsm/loaders/GLTFLoader.js').GLTFLoader;

    const template = await loadGltfStaticTemplate('/models/props/environment/shadow-flags.glb', loader);

    let meshCount = 0;
    template.scene.traverse((node) => {
      if (node instanceof THREE.Mesh) {
        meshCount++;
        expect(node.castShadow).toBe(true);
        expect(node.receiveShadow).toBe(true);
      }
    });
    expect(meshCount).toBeGreaterThan(0);
  });
});

describe('createInstancedScatter shadow flags', () => {
  it('VFU-02: sets castShadow and receiveShadow on every returned InstancedMesh', () => {
    const template = makeStaticTemplate();
    const placements = [
      { x: 0, y: 0, z: 0, scale: 1 },
      { x: 5, y: 0, z: 5, scale: 1 },
    ];

    const instanced = createInstancedScatter(template, placements, 'tree');

    expect(instanced.length).toBeGreaterThan(0);
    for (const mesh of instanced) {
      expect(mesh.castShadow).toBe(true);
      expect(mesh.receiveShadow).toBe(true);
    }
  });
});
