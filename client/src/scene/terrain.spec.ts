import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  generateTerrain,
  generateGrassTextureData,
  createTerrainMesh,
  GRASS_TEXTURE_SIZE_PX,
  GRASS_TILE_SIZE_M,
} from './terrain';

const opts = { size: 200, segments: 32, heightScale: 8, seed: 42 };

describe('generateTerrain', () => {
  it('is deterministic for the same seed', () => {
    const a = generateTerrain(42, opts);
    const b = generateTerrain(42, opts);
    expect(Array.from(a.vertices)).toEqual(Array.from(b.vertices));
    expect(Array.from(a.indices)).toEqual(Array.from(b.indices));
  });

  it('sampleHeight matches vertex height at the same point', () => {
    const terrain = generateTerrain(42, opts);
    const x = terrain.vertices[0];
    const z = terrain.vertices[2];
    expect(terrain.sampleHeight(x, z)).toBeCloseTo(terrain.heights[0], 5);
  });

  it('produces different geometry for different seeds', () => {
    const a = generateTerrain(1, opts);
    const b = generateTerrain(2, opts);
    expect(Array.from(a.vertices)).not.toEqual(Array.from(b.vertices));
  });
});

describe('VFU-11/12: generateGrassTextureData', () => {
  it('is byte-identical for the same seed', () => {
    const a = generateGrassTextureData(42, GRASS_TEXTURE_SIZE_PX);
    const b = generateGrassTextureData(42, GRASS_TEXTURE_SIZE_PX);
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  it('differs for a different seed', () => {
    const a = generateGrassTextureData(1, GRASS_TEXTURE_SIZE_PX);
    const b = generateGrassTextureData(2, GRASS_TEXTURE_SIZE_PX);
    expect(Array.from(a)).not.toEqual(Array.from(b));
  });

  it('returns an RGBA buffer sized for the requested pixel dimensions', () => {
    const data = generateGrassTextureData(42, GRASS_TEXTURE_SIZE_PX);
    expect(data.length).toBe(GRASS_TEXTURE_SIZE_PX * GRASS_TEXTURE_SIZE_PX * 4);
  });
});

describe('VFU-02/11/13/14: createTerrainMesh visual fidelity', () => {
  it('VFU-11: builds a procedural DataTexture (no external file, no TextureLoader)', () => {
    const terrain = generateTerrain(42, opts);
    const mesh = createTerrainMesh(THREE, terrain);
    const material = mesh.material as THREE.MeshLambertMaterial;

    expect(material.map).toBeInstanceOf(THREE.DataTexture);
  });

  it('VFU-13: tiles the texture via RepeatWrapping', () => {
    const terrain = generateTerrain(42, opts);
    const mesh = createTerrainMesh(THREE, terrain);
    const map = (mesh.material as THREE.MeshLambertMaterial).map!;

    expect(map.wrapS).toBe(THREE.RepeatWrapping);
    expect(map.wrapT).toBe(THREE.RepeatWrapping);
  });

  it('VFU-13: adds a uv BufferAttribute sized to match the vertex count, derived from world (x, z)', () => {
    const terrain = generateTerrain(42, opts);
    const mesh = createTerrainMesh(THREE, terrain);
    const uv = mesh.geometry.attributes['uv'];
    const position = mesh.geometry.attributes['position'];

    expect(uv).toBeDefined();
    expect(uv.count).toBe(position.count);
    expect(uv.getX(0)).toBeCloseTo(terrain.vertices[0] / GRASS_TILE_SIZE_M, 5);
    expect(uv.getY(0)).toBeCloseTo(terrain.vertices[2] / GRASS_TILE_SIZE_M, 5);
  });

  it('VFU-14: sets receiveShadow to true on the terrain mesh', () => {
    const terrain = generateTerrain(42, opts);
    const mesh = createTerrainMesh(THREE, terrain);

    expect(mesh.receiveShadow).toBe(true);
  });
});
