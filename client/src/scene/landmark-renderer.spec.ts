import { describe, it, expect, afterEach, vi } from 'vitest';
import * as THREE from 'three';
import { buildLandmarkScene } from './landmark-renderer';
import { clearGltfStaticTemplateCache } from './static-prop';
import { listLandmarkEntries } from './landmark-manifest';

function mockLoader(success: boolean) {
  const load = vi.fn(
    (url: string, onLoad: (gltf: { scene: THREE.Group }) => void, _prog: unknown, onError: (e: Error) => void) => {
      if (success) {
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(1, 1, 1),
          new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true })
        );
        const scene = new THREE.Group();
        scene.add(mesh);
        onLoad({ scene });
      } else {
        onError(new Error(`failed ${url}`));
      }
    }
  );
  return { load } as unknown as import('three/examples/jsm/loaders/GLTFLoader.js').GLTFLoader;
}

describe('buildLandmarkScene', () => {
  afterEach(() => {
    clearGltfStaticTemplateCache();
  });

  it('VFU-02: sets castShadow and receiveShadow on the primitive-fallback mesh when GLBs fail to load', async () => {
    const scene = new THREE.Scene();
    const loader = mockLoader(false);

    await buildLandmarkScene({ scene, sampleHeight: () => 0, loader });

    const primitives = scene.children.filter((c) => c instanceof THREE.Group);
    expect(primitives).toHaveLength(listLandmarkEntries().length);
    for (const group of primitives) {
      const mesh = group.children.find((c): c is THREE.Mesh => c instanceof THREE.Mesh);
      expect(mesh).toBeDefined();
      expect(mesh!.castShadow).toBe(true);
      expect(mesh!.receiveShadow).toBe(true);
    }
  });

  it('reports primitive renderKind when GLBs fail to load', async () => {
    const scene = new THREE.Scene();
    const loader = mockLoader(false);

    const result = await buildLandmarkScene({ scene, sampleHeight: () => 0, loader });

    expect(result.count).toBe(listLandmarkEntries().length);
    expect(result.renderKind).toBe('primitive');
  });
});
