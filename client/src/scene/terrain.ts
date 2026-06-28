import {
  generateTerrainData,
  type TerrainData,
  type TerrainConfig,
  TERRAIN_CONFIG,
  sampleHeight,
} from '@nj/game-core';
import * as THREE from 'three';

export type TerrainOptions = TerrainConfig;
export type { TerrainData };

export { TERRAIN_CONFIG, sampleHeight };

export function generateTerrain(seed: number, opts: TerrainOptions): TerrainData {
  return generateTerrainData({ ...opts, seed });
}

export function createTerrainMesh(
  THREE_NS: typeof THREE,
  terrain: TerrainData
): THREE.Mesh {
  const geometry = new THREE_NS.BufferGeometry();
  geometry.setAttribute('position', new THREE_NS.BufferAttribute(terrain.vertices, 3));
  geometry.setIndex(Array.from(terrain.indices));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  const material = new THREE_NS.MeshLambertMaterial({
    color: 0x4a7c3f,
    flatShading: true,
    side: THREE_NS.DoubleSide,
  });

  return new THREE_NS.Mesh(geometry, material);
}
