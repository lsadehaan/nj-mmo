import { WORLD_MIN, WORLD_MAX } from './world-constants';
import { sampleHeight } from './terrain';
import { isBlocked, BUILDING_AABBS, LANDMARK_AABBS, isPointInAabb } from './world-blockers';
import { MAX_SLOPE_TANGENT } from './walkability';
import { isWaterZone } from './ti-zones';

export const GRID_CELL_SIZE = 1;
export const GRID_SIZE = WORLD_MAX - WORLD_MIN;

function worldToCell(world: number): number {
  return Math.floor((world - WORLD_MIN) / GRID_CELL_SIZE);
}

function cellToWorld(cell: number): number {
  return WORLD_MIN + cell * GRID_CELL_SIZE + GRID_CELL_SIZE / 2;
}

export function cellIndex(cx: number, cz: number): number {
  return cz * GRID_SIZE + cx;
}

function isStaticBlocked(x: number, z: number): boolean {
  for (const aabb of BUILDING_AABBS) {
    if (isPointInAabb(x, z, aabb)) return true;
  }
  for (const aabb of LANDMARK_AABBS) {
    if (isPointInAabb(x, z, aabb)) return true;
  }
  return false;
}

function isCellCentreWalkable(cx: number, cz: number): boolean {
  const x = cellToWorld(cx);
  const z = cellToWorld(cz);

  if (x < WORLD_MIN || x > WORLD_MAX || z < WORLD_MIN || z > WORLD_MAX) {
    return false;
  }
  if (isStaticBlocked(x, z)) return false;
  if (isWaterZone(x, z)) return false;

  const h = sampleHeight(x, z);
  const cardinals = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const;

  for (const [dx, dz] of cardinals) {
    const nx = x + dx * GRID_CELL_SIZE;
    const nz = z + dz * GRID_CELL_SIZE;
    if (nx < WORLD_MIN || nx > WORLD_MAX || nz < WORLD_MIN || nz > WORLD_MAX) {
      return false;
    }
    const nh = sampleHeight(nx, nz);
    const dh = Math.abs(nh - h);
    if (dh / GRID_CELL_SIZE > MAX_SLOPE_TANGENT) return false;
  }

  return true;
}

let cachedGrid: Uint8Array | null = null;
let cachedGridRevision = 0;
const GRID_REVISION = 3;

export function getWalkabilityGrid(): Uint8Array {
  if (cachedGrid && cachedGridRevision === GRID_REVISION) return cachedGrid;

  const grid = new Uint8Array(GRID_SIZE * GRID_SIZE);
  for (let cz = 0; cz < GRID_SIZE; cz++) {
    for (let cx = 0; cx < GRID_SIZE; cx++) {
      grid[cellIndex(cx, cz)] = isCellCentreWalkable(cx, cz) ? 1 : 0;
    }
  }
  cachedGrid = grid;
  cachedGridRevision = GRID_REVISION;
  return grid;
}

export function isCellWalkable(cx: number, cz: number): boolean {
  if (cx < 0 || cz < 0 || cx >= GRID_SIZE || cz >= GRID_SIZE) return false;
  return getWalkabilityGrid()[cellIndex(cx, cz)] === 1;
}

export function worldToCellCoords(x: number, z: number): { cx: number; cz: number } {
  return {
    cx: Math.max(0, Math.min(GRID_SIZE - 1, worldToCell(x))),
    cz: Math.max(0, Math.min(GRID_SIZE - 1, worldToCell(z))),
  };
}

export function cellToWorldCoords(cx: number, cz: number): { x: number; z: number } {
  return { x: cellToWorld(cx), z: cellToWorld(cz) };
}

/** Reset cached grid (tests only). */
export function resetWalkabilityGridCache(): void {
  cachedGrid = null;
  cachedGridRevision = 0;
}
