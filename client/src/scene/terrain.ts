import {
  generateTerrainData,
  type TerrainData,
  type TerrainConfig,
  TERRAIN_CONFIG,
  sampleHeight,
  createSeededRng,
} from '@nj/game-core';
import * as THREE from 'three';

export type TerrainOptions = TerrainConfig;
export type { TerrainData };

export { TERRAIN_CONFIG, sampleHeight };

/** Grass texture pixel dimensions (square, zero-asset, generated at runtime). */
export const GRASS_TEXTURE_SIZE_PX = 64;
/** World-space size (m) of one tile of the repeating grass texture. */
export const GRASS_TILE_SIZE_M = 8;

/** Three base green shades speckle-blended per pixel; center shade matches the old flat terrain color (0x4a7c3f). */
const GRASS_SHADES: ReadonlyArray<readonly [number, number, number]> = [
  [58, 92, 47],
  [74, 124, 63],
  [90, 143, 74],
];

export function generateGrassTextureData(seed: number, size: number): Uint8ClampedArray {
  const rng = createSeededRng(seed);
  const data = new Uint8ClampedArray(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    const shade = GRASS_SHADES[rng.nextInt(0, GRASS_SHADES.length - 1)];
    const jitter = rng.nextInt(-8, 8);
    const idx = i * 4;
    data[idx] = shade[0] + jitter;
    data[idx + 1] = shade[1] + jitter;
    data[idx + 2] = shade[2] + jitter;
    data[idx + 3] = 255;
  }
  return data;
}

export function generateTerrain(seed: number, opts: TerrainOptions): TerrainData {
  return generateTerrainData({ ...opts, seed });
}

function buildGrassTexture(THREE_NS: typeof THREE, seed: number): THREE.DataTexture {
  const data = generateGrassTextureData(seed, GRASS_TEXTURE_SIZE_PX);
  const texture = new THREE_NS.DataTexture(
    data,
    GRASS_TEXTURE_SIZE_PX,
    GRASS_TEXTURE_SIZE_PX,
    THREE_NS.RGBAFormat
  );
  texture.wrapS = THREE_NS.RepeatWrapping;
  texture.wrapT = THREE_NS.RepeatWrapping;
  texture.needsUpdate = true;
  return texture;
}

export function createTerrainMesh(
  THREE_NS: typeof THREE,
  terrain: TerrainData
): THREE.Mesh {
  const geometry = new THREE_NS.BufferGeometry();
  geometry.setAttribute('position', new THREE_NS.BufferAttribute(terrain.vertices, 3));
  geometry.setIndex(Array.from(terrain.indices));

  const vertexCount = terrain.vertices.length / 3;
  const uvs = new Float32Array(vertexCount * 2);
  for (let i = 0; i < vertexCount; i++) {
    const x = terrain.vertices[i * 3];
    const z = terrain.vertices[i * 3 + 2];
    uvs[i * 2] = x / GRASS_TILE_SIZE_M;
    uvs[i * 2 + 1] = z / GRASS_TILE_SIZE_M;
  }
  geometry.setAttribute('uv', new THREE_NS.BufferAttribute(uvs, 2));

  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  const material = new THREE_NS.MeshLambertMaterial({
    color: 0x4a7c3f,
    flatShading: true,
    side: THREE_NS.DoubleSide,
    map: buildGrassTexture(THREE_NS, terrain.seed),
  });

  const mesh = new THREE_NS.Mesh(geometry, material);
  mesh.receiveShadow = true;
  return mesh;
}
