import { describe, it, expect, afterEach, vi } from 'vitest';
import * as THREE from 'three';
import { generateTerrain } from './terrain';
import { buildVillage } from './village';
import { scatterProps } from './scatter';
import {
  buildEnvironmentScene,
  placeScatterEnvironment,
  placeVillageEnvironment,
  addBoxPrimitiveForTests,
  addTreePrimitiveForTests,
  addRockPrimitiveForTests,
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
      // GLB buildings are placed by their base, i.e. box-center minus height/2.
      const root = meshRoots.find(
        (c) =>
          Math.abs(c.position.x - spec.x) < 0.001 &&
          Math.abs(c.position.y - (spec.y - spec.height / 2)) < 0.001 &&
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

  it('places 220 scatter props at scatterProps coordinates', async () => {
    const scene = new THREE.Scene();
    const loader = mockLoader(true);
    const result = await placeScatterEnvironment({ scene, terrainData: terrain, loader });

    const expected = scatterProps(42, terrain, {
      count: 220,
      fieldMin: -300,
      fieldMax: 300,
      villageRadius: 45,
    });

    expect(result.count).toBe(220);
    expect(expected).toHaveLength(220);

    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const instancedMeshes = scene.children.filter(
      (c): c is THREE.InstancedMesh => c instanceof THREE.InstancedMesh
    );

    for (let i = 0; i < 3; i++) {
      const spec = expected[i];
      const kindIndex = expected.slice(0, i).filter((p) => p.kind === spec.kind).length;
      const mesh = instancedMeshes.find((m) => m.userData.scatterKind === spec.kind);
      expect(mesh).toBeDefined();
      mesh!.getMatrixAt(kindIndex, matrix);
      position.setFromMatrixPosition(matrix);
      expect(Math.abs(position.x - spec.x)).toBeLessThan(0.01);
      expect(Math.abs(position.z - spec.z)).toBeLessThan(0.01);
    }
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

    expect(result.count).toBe(220);
    expect(result.renderKind).toBe('primitive');
    expect(scene.children.length).toBe(220);
  });
});

describe('VFU-02: primitive-fallback shadow flags', () => {
  it('addBoxPrimitive sets castShadow and receiveShadow', () => {
    const mesh = addBoxPrimitiveForTests({
      kind: 'building',
      x: 0,
      y: 1,
      z: 0,
      width: 2,
      depth: 2,
      height: 2,
      color: 0x8b4513,
    });
    expect(mesh.castShadow).toBe(true);
    expect(mesh.receiveShadow).toBe(true);
  });

  it('addTreePrimitive sets castShadow and receiveShadow on both trunk and foliage', () => {
    const group = addTreePrimitiveForTests(0, 0, 0, 1);
    expect(group.children).toHaveLength(2);
    for (const child of group.children) {
      expect((child as THREE.Mesh).castShadow).toBe(true);
      expect((child as THREE.Mesh).receiveShadow).toBe(true);
    }
  });

  it('addRockPrimitive sets castShadow and receiveShadow', () => {
    const mesh = addRockPrimitiveForTests(0, 0, 0, 1);
    expect(mesh.castShadow).toBe(true);
    expect(mesh.receiveShadow).toBe(true);
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
    expect(result.scatter).toEqual({ count: 220, renderKind: 'mesh' });
    expect(result.peaceZone).toEqual({ count: 1, renderKind: 'mesh' });
    expect(result.landmarks).toEqual({ count: 6, renderKind: 'mesh' });
  });
});
