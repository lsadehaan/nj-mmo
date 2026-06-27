export interface TerrainOptions {
  size: number;
  segments: number;
  heightScale: number;
  seed: number;
}

export interface TerrainData {
  seed: number;
  size: number;
  segments: number;
  vertices: Float32Array;
  indices: Uint32Array;
  heights: Float32Array;
  sampleHeight: (x: number, z: number) => number;
}

function hashSeed(seed: number, x: number, z: number): number {
  let h = seed ^ (x * 374761393) ^ (z * 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

function noise2D(seed: number, x: number, z: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;

  const a = hashSeed(seed, ix, iz) / 0xffffffff;
  const b = hashSeed(seed, ix + 1, iz) / 0xffffffff;
  const c = hashSeed(seed, ix, iz + 1) / 0xffffffff;
  const d = hashSeed(seed, ix + 1, iz + 1) / 0xffffffff;

  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);

  return a * (1 - ux) * (1 - uz) + b * ux * (1 - uz) + c * (1 - ux) * uz + d * ux * uz;
}

export function generateTerrain(seed: number, opts: TerrainOptions): TerrainData {
  const { size, segments, heightScale } = opts;
  const vertCount = (segments + 1) * (segments + 1);
  const vertices = new Float32Array(vertCount * 3);
  const heights = new Float32Array(vertCount);
  const half = size / 2;

  let vi = 0;
  for (let row = 0; row <= segments; row++) {
    for (let col = 0; col <= segments; col++) {
      const x = (col / segments) * size - half;
      const z = (row / segments) * size - half;
      const nx = col / segments;
      const nz = row / segments;
      const h =
        (noise2D(seed, nx * 8, nz * 8) * 0.6 +
          noise2D(seed + 1, nx * 16, nz * 16) * 0.3 +
          noise2D(seed + 2, nx * 32, nz * 32) * 0.1) *
        heightScale;

      heights[vi / 3] = h;
      vertices[vi] = x;
      vertices[vi + 1] = h;
      vertices[vi + 2] = z;
      vi += 3;
    }
  }

  const indices: number[] = [];
  for (let row = 0; row < segments; row++) {
    for (let col = 0; col < segments; col++) {
      const a = row * (segments + 1) + col;
      const b = a + 1;
      const c = a + segments + 1;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const sampleHeight = (x: number, z: number): number => {
    const col = ((x + half) / size) * segments;
    const row = ((z + half) / size) * segments;
    const nx = col / segments;
    const nz = row / segments;
    return (
      (noise2D(seed, nx * 8, nz * 8) * 0.6 +
        noise2D(seed + 1, nx * 16, nz * 16) * 0.3 +
        noise2D(seed + 2, nx * 32, nz * 32) * 0.1) *
      heightScale
    );
  };

  return {
    seed,
    size,
    segments,
    vertices,
    indices: new Uint32Array(indices),
    heights,
    sampleHeight,
  };
}

export function createTerrainMesh(
  THREE: typeof import('three'),
  terrain: TerrainData
): import('three').Mesh {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(terrain.vertices, 3));
  geometry.setIndex(Array.from(terrain.indices));
  geometry.computeVertexNormals();

  const material = new THREE.MeshLambertMaterial({
    color: 0x4a7c3f,
    flatShading: true,
  });

  return new THREE.Mesh(geometry, material);
}
