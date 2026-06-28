import { describe, it, expect, afterEach, vi } from 'vitest';
import * as THREE from 'three';
import { generateTerrain } from './terrain';
import { buildVillage } from './village';
import { scatterProps } from './scatter';
import {
  buildEnvironmentScene,
  placeScatterEnvironment,
  placeVillageEnvironment,
} from './environment-renderer';
import { clearGltfStaticTemplateCache } from './static-prop';
import { getScatterPropEntry } from './environment-manifest';

function makeTemplate(): { scene: THREE.Group } {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true })
  );
  const scene = new THREE.Group();
  scene.add(mesh);
  return { scene };
}

function mockLoader(success: boolean) {
  const load = vi.fn(
    (url: string, onLoad: (gltf: { scene: THREE.Group }) => void, _prog: unknown, onError: (e: Error) => void) => {
      if (success) {
        onLoad(makeTemplate());
      } else {
        onError(new Error(`failed ${url}`));
      }
    }
  );
  return { load } as unknown as import('three/examples/jsm/loaders/GLTFLoader.js').GLTFLoader;
}

describe('placeVillageEnvironment', () => {
  const terrain = generateTerrain(42, {
    size: 200,
    segments: 32,
    heightScale: 8,
    seed: 42,
  });

  afterEach(() => {
    clearGltfStaticTemplateCache();
  });

  it('places five GLB buildings at buildVillage coordinates when assets load', async () => {
    const scene = new THREE.Scene();
    const loader = mockLoader(true);
    const result = await placeVillageEnvironment({ scene, terrainData: terrain, loader });

    expect(result.buildings.count).toBe(5);
    expect(result.buildings.renderKind).toBe('mesh');
    expect(result.peaceZone.count).toBe(1);
    expect(result.peaceZone.renderKind).toBe('mesh');

    const buildingSpecs = buildVillage({ seed: 42, sampleHeight: terrain.sampleHeight }).filter(
      (s) => s.kind === 'building'
    );
    const meshRoots = scene.children.filter((c) => c.userData.renderKind === 'mesh');
    expect(meshRoots.length).toBeGreaterThanOrEqual(6);

    for (let i = 0; i < buildingSpecs.length; i++) {
      const spec = buildingSpecs[i];
      const root = meshRoots.find(
        (c) =>
          Math.abs(c.position.x - spec.x) < 0.001 &&
          Math.abs(c.position.y - spec.y) < 0.001 &&
          Math.abs(c.position.z - spec.z) < 0.001
      );
      expect(root).toBeDefined();
    }
  });

  it('falls back to box primitive for a failed building without aborting others', async () => {
    let call = 0;
    const load = vi.fn(
      (url: string, onLoad: (gltf: { scene: THREE.Group }) => void, _prog: unknown, onError: (e: Error) => void) => {
        call++;
        if (call === 2) {
          onError(new Error('missing'));
          return;
        }
        onLoad(makeTemplate());
      }
    );
    const loader = { load } as unknown as import('three/examples/jsm/loaders/GLTFLoader.js').GLTFLoader;

    const scene = new THREE.Scene();
    const result = await placeVillageEnvironment({ scene, terrainData: terrain, loader });

    expect(result.buildings.count).toBe(5);
    expect(result.buildings.renderKind).toBe('primitive');
    const primitives = scene.children.filter((c) => c.userData.renderKind === 'primitive');
    expect(primitives.length).toBe(1);
  });

  it('uses peace-marker GLB instead of green box when asset loads', async () => {
    const scene = new THREE.Scene();
    const loader = mockLoader(true);
    await placeVillageEnvironment({ scene, terrainData: terrain, loader });

    const peaceSpec = buildVillage({ seed: 42, sampleHeight: terrain.sampleHeight }).find(
      (s) => s.kind === 'peace-zone'
    )!;
    const peaceMesh = scene.children.find(
      (c) =>
        c.userData.renderKind === 'mesh' &&
        Math.abs(c.position.x - peaceSpec.x) < 0.001 &&
        Math.abs(c.position.z - peaceSpec.z) < 0.001
    );
    expect(peaceMesh?.userData.renderKind).toBe('mesh');
  });
});

describe('placeScatterEnvironment', () => {
  const terrain = generateTerrain(42, {
    size: 200,
    segments: 32,
    heightScale: 8,
    seed: 42,
  });

  afterEach(() => {
    clearGltfStaticTemplateCache();
  });

  it('places 80 scatter props at scatterProps coordinates', async () => {
    const scene = new THREE.Scene();
    const loader = mockLoader(true);
    const result = await placeScatterEnvironment({ scene, terrainData: terrain, loader });

    const expected = scatterProps(42, terrain, {
      count: 80,
      fieldMin: -90,
      fieldMax: 90,
      villageRadius: 25,
    });

    expect(result.count).toBe(80);
    expect(expected).toHaveLength(80);
  });

  it('loads tree and rock templates at most once each', async () => {
    const load = vi.fn(
      (_url: string, onLoad: (gltf: { scene: THREE.Group }) => void) => {
        onLoad(makeTemplate());
      }
    );
    const loader = { load } as unknown as import('three/examples/jsm/loaders/GLTFLoader.js').GLTFLoader;
    const scene = new THREE.Scene();

    await placeScatterEnvironment({ scene, terrainData: terrain, loader });

    const treeUrl = getScatterPropEntry('tree').model;
    const rockUrl = getScatterPropEntry('rock').model;
    expect(load).toHaveBeenCalledTimes(2);
    expect(load.mock.calls.map((c) => c[0])).toEqual(expect.arrayContaining([treeUrl, rockUrl]));
  });

  it('uses InstancedMesh when scatter count is at least 20 per kind', async () => {
    const scene = new THREE.Scene();
    const loader = mockLoader(true);
    await placeScatterEnvironment({ scene, terrainData: terrain, loader });

    const instanced = scene.children.filter((c) => c instanceof THREE.InstancedMesh);
    expect(instanced.length).toBeGreaterThanOrEqual(1);
    const treeInst = instanced.find((m) => m.userData.scatterKind === 'tree');
    expect(treeInst).toBeDefined();
    expect((treeInst as THREE.InstancedMesh).count).toBeGreaterThanOrEqual(20);
  });

  it('falls back to addTree/addRock primitives when GLBs fail', async () => {
    const scene = new THREE.Scene();
    const loader = mockLoader(false);
    const result = await placeScatterEnvironment({ scene, terrainData: terrain, loader });

    expect(result.count).toBe(80);
    expect(result.renderKind).toBe('primitive');
    expect(scene.children.length).toBe(80);
  });
});

describe('buildEnvironmentScene', () => {
  const terrain = generateTerrain(42, {
    size: 200,
    segments: 32,
    heightScale: 8,
    seed: 42,
  });

  afterEach(() => {
    clearGltfStaticTemplateCache();
  });

  it('combines village and scatter environment stats', async () => {
    const scene = new THREE.Scene();
    const result = await buildEnvironmentScene({
      scene,
      terrainData: terrain,
      loader: mockLoader(true),
    });

    expect(result.buildings).toEqual({ count: 5, renderKind: 'mesh' });
    expect(result.scatter).toEqual({ count: 80, renderKind: 'mesh' });
    expect(result.peaceZone).toEqual({ count: 1, renderKind: 'mesh' });
  });
});
