import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { TERRAIN_CONFIG } from '@nj/game-core';
import { buildVillage, type SceneObjectSpec } from './village';
import { scatterProps } from './scatter';
import {
  getBuildingPropEntry,
  getPeaceZoneMarkerEntry,
  getScatterPropEntry,
  type BuildingPropIndex,
} from './environment-manifest';
import { buildLandmarkScene } from './landmark-renderer';
import {
  cloneStaticProp,
  createInstancedScatter,
  loadGltfStaticTemplate,
  type ScatterPlacement,
  type StaticPropTemplate,
} from './static-prop';

const WORLD_SEED = TERRAIN_CONFIG.seed;

export interface EnvironmentCategoryResult {
  count: number;
  renderKind: 'mesh' | 'primitive';
}

export interface EnvironmentSceneResult {
  buildings: EnvironmentCategoryResult;
  scatter: EnvironmentCategoryResult;
  peaceZone: EnvironmentCategoryResult;
  landmarks: EnvironmentCategoryResult;
}

export interface BuildEnvironmentSceneOptions {
  scene: THREE.Scene;
  terrainData: { sampleHeight: (x: number, z: number) => number };
  loader?: GLTFLoader;
}

function addBoxPrimitive(spec: SceneObjectSpec): THREE.Mesh {
  const geometry = new THREE.BoxGeometry(spec.width, spec.height, spec.depth);
  const material = new THREE.MeshLambertMaterial({
    color: spec.color,
    flatShading: true,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(spec.x, spec.y, spec.z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function addTreePrimitive(x: number, y: number, z: number, scale: number): THREE.Group {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2 * scale, 0.3 * scale, 2 * scale, 6),
    new THREE.MeshLambertMaterial({ color: 0x5c4033, flatShading: true })
  );
  trunk.position.y = y + scale;
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  const foliage = new THREE.Mesh(
    new THREE.ConeGeometry(1 * scale, 2.5 * scale, 6),
    new THREE.MeshLambertMaterial({ color: 0x228b22, flatShading: true })
  );
  foliage.position.y = y + 2.2 * scale;
  foliage.castShadow = true;
  foliage.receiveShadow = true;
  group.add(trunk, foliage);
  group.position.set(x, 0, z);
  return group;
}

function addRockPrimitive(x: number, y: number, z: number, scale: number): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.DodecahedronGeometry(0.8 * scale, 0),
    new THREE.MeshLambertMaterial({ color: 0x808080, flatShading: true })
  );
  mesh.position.set(x, y + 0.4 * scale, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

async function loadTemplate(
  url: string,
  loader: GLTFLoader
): Promise<StaticPropTemplate | null> {
  try {
    return await loadGltfStaticTemplate(url, loader);
  } catch {
    return null;
  }
}

export async function placeVillageEnvironment(
  opts: BuildEnvironmentSceneOptions
): Promise<Pick<EnvironmentSceneResult, 'buildings' | 'peaceZone'>> {
  const { scene, terrainData } = opts;
  const loader = opts.loader ?? new GLTFLoader();
  const villageSpecs = buildVillage({ seed: WORLD_SEED, sampleHeight: terrainData.sampleHeight });

  const result = {
    buildings: { count: 0, renderKind: 'mesh' as 'mesh' | 'primitive' },
    peaceZone: { count: 0, renderKind: 'mesh' as 'mesh' | 'primitive' },
  };

  const buildingTemplates: (StaticPropTemplate | null)[] = [];
  for (let i = 0; i < 5; i++) {
    const entry = getBuildingPropEntry(i as BuildingPropIndex);
    buildingTemplates.push(await loadTemplate(entry.model, loader));
  }

  const peaceEntry = getPeaceZoneMarkerEntry();
  const peaceTemplate = await loadTemplate(peaceEntry.model, loader);

  let buildingSlot = 0;
  let buildingUsedPrimitive = false;
  for (const spec of villageSpecs) {
    if (spec.kind === 'ground') {
      scene.add(addBoxPrimitive(spec));
      continue;
    }

    if (spec.kind === 'building') {
      result.buildings.count++;
      const entry = getBuildingPropEntry(buildingSlot as BuildingPropIndex);
      const template = buildingTemplates[buildingSlot];
      buildingSlot++;

      if (template) {
        const prop = cloneStaticProp(template, {
          scale: entry.scale,
          yOffset: entry.yOffset,
          rotationY: entry.yRotation,
        });
        // GLB origin is the building base; spec.y is the box-center used by the
        // primitive fallback, so drop to ground (spec.y − height/2) for meshes.
        prop.position.set(spec.x, spec.y - spec.height / 2, spec.z);
        prop.userData.renderKind = 'mesh';
        scene.add(prop);
      } else {
        const mesh = addBoxPrimitive(spec);
        mesh.userData.renderKind = 'primitive';
        scene.add(mesh);
        buildingUsedPrimitive = true;
      }
      continue;
    }

    if (spec.kind === 'peace-zone') {
      result.peaceZone.count = 1;
      if (peaceTemplate) {
        const prop = cloneStaticProp(peaceTemplate, {
          scale: peaceEntry.scale,
          yOffset: peaceEntry.yOffset,
        });
        // GLB origin is the marker base; drop to ground like buildings.
        prop.position.set(spec.x, spec.y - spec.height / 2, spec.z);
        prop.userData.renderKind = 'mesh';
        scene.add(prop);
      } else {
        const mesh = addBoxPrimitive(spec);
        mesh.userData.renderKind = 'primitive';
        scene.add(mesh);
        result.peaceZone.renderKind = 'primitive';
      }
    }
  }

  if (buildingUsedPrimitive) {
    result.buildings.renderKind = 'primitive';
  }

  return result;
}

export async function placeScatterEnvironment(
  opts: BuildEnvironmentSceneOptions
): Promise<EnvironmentCategoryResult> {
  const { scene, terrainData } = opts;
  const loader = opts.loader ?? new GLTFLoader();
  const scatter = scatterProps(WORLD_SEED, terrainData, {
    count: 220,
    fieldMin: -300,
    fieldMax: 300,
    villageRadius: 45,
  });

  const result: EnvironmentCategoryResult = { count: scatter.length, renderKind: 'mesh' };

  const treeEntry = getScatterPropEntry('tree');
  const rockEntry = getScatterPropEntry('rock');
  const treeTemplate = await loadTemplate(treeEntry.model, loader);
  const rockTemplate = await loadTemplate(rockEntry.model, loader);

  const treePlacements: ScatterPlacement[] = [];
  const rockPlacements: ScatterPlacement[] = [];

  for (const prop of scatter) {
    const placement: ScatterPlacement = {
      x: prop.x,
      y: prop.y,
      z: prop.z,
      scale:
        prop.scale *
        (prop.kind === 'tree' ? treeEntry.scaleMultiplier : rockEntry.scaleMultiplier),
    };
    if (prop.kind === 'tree') treePlacements.push(placement);
    else rockPlacements.push(placement);
  }

  const placeKind = (
    kind: 'tree' | 'rock',
    template: StaticPropTemplate | null,
    placements: ScatterPlacement[]
  ): void => {
    if (placements.length === 0) return;

    if (!template) {
      for (const p of placements) {
        scene.add(
          kind === 'tree'
            ? addTreePrimitive(p.x, p.y, p.z, p.scale)
            : addRockPrimitive(p.x, p.y, p.z, p.scale)
        );
      }
      result.renderKind = 'primitive';
      return;
    }

    if (placements.length >= 20) {
      const instanced = createInstancedScatter(template, placements, kind);
      if (instanced.length > 0) {
        for (const mesh of instanced) {
          mesh.userData.renderKind = 'mesh';
          scene.add(mesh);
        }
        return;
      }
    }

    for (const p of placements) {
      const prop = cloneStaticProp(template, { scale: p.scale });
      prop.position.set(p.x, p.y, p.z);
      prop.userData.renderKind = 'mesh';
      scene.add(prop);
    }
  };

  placeKind('tree', treeTemplate, treePlacements);
  placeKind('rock', rockTemplate, rockPlacements);

  if (!treeTemplate || !rockTemplate) {
    result.renderKind = 'primitive';
  }

  return result;
}

export async function buildEnvironmentScene(
  opts: BuildEnvironmentSceneOptions
): Promise<EnvironmentSceneResult> {
  const village = await placeVillageEnvironment(opts);
  const scatter = await placeScatterEnvironment(opts);
  const landmarks = await buildLandmarkScene({
    scene: opts.scene,
    sampleHeight: opts.terrainData.sampleHeight,
    loader: opts.loader,
  });
  return { ...village, scatter, landmarks };
}

export {
  addBoxPrimitive as addBoxPrimitiveForTests,
  addTreePrimitive as addTreePrimitiveForTests,
  addRockPrimitive as addRockPrimitiveForTests,
};
