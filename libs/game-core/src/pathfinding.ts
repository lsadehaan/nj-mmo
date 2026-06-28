import { isPointInAabb, BUILDING_AABBS } from './world-blockers';
import {
  getWalkabilityGrid,
  isCellWalkable,
  worldToCellCoords,
  cellToWorldCoords,
  GRID_SIZE,
  cellIndex,
} from './walkability-grid';
import type { Vec2 } from './walkability';

export type { Vec2 };

const DIRS_8 = [
  { dx: 1, dz: 0, cost: 1 },
  { dx: -1, dz: 0, cost: 1 },
  { dx: 0, dz: 1, cost: 1 },
  { dx: 0, dz: -1, cost: 1 },
  { dx: 1, dz: 1, cost: Math.SQRT2 },
  { dx: 1, dz: -1, cost: Math.SQRT2 },
  { dx: -1, dz: 1, cost: Math.SQRT2 },
  { dx: -1, dz: -1, cost: Math.SQRT2 },
] as const;

function octileHeuristic(ax: number, az: number, bx: number, bz: number): number {
  const dx = Math.abs(ax - bx);
  const dz = Math.abs(az - bz);
  return Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz);
}

function canStepDiagonal(cx: number, cz: number, dx: number, dz: number): boolean {
  if (dx === 0 || dz === 0) return true;
  return (
    isCellWalkable(cx + dx, cz) &&
    isCellWalkable(cx, cz + dz)
  );
}

export function snapToNearestWalkable(
  x: number,
  z: number,
  maxRadius = 10
): Vec2 | null {
  const { cx: startCx, cz: startCz } = worldToCellCoords(x, z);
  if (isCellWalkable(startCx, startCz)) {
    return cellToWorldCoords(startCx, startCz);
  }

  for (let r = 1; r <= maxRadius; r++) {
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue;
        const cx = startCx + dx;
        const cz = startCz + dz;
        if (isCellWalkable(cx, cz)) {
          return cellToWorldCoords(cx, cz);
        }
      }
    }
  }
  return null;
}

export function findPath(from: Vec2, to: Vec2): Vec2[] {
  getWalkabilityGrid();

  const start = worldToCellCoords(from.x, from.z);
  const goal = worldToCellCoords(to.x, to.z);

  if (!isCellWalkable(start.cx, start.cz) || !isCellWalkable(goal.cx, goal.cz)) {
    return [];
  }

  if (start.cx === goal.cx && start.cz === goal.cz) {
    return [];
  }

  const total = GRID_SIZE * GRID_SIZE;
  const gScore = new Float64Array(total);
  gScore.fill(Infinity);
  const fScore = new Float64Array(total);
  fScore.fill(Infinity);
  const cameFrom = new Int32Array(total);
  cameFrom.fill(-1);
  const open = new Set<number>();

  const startIdx = cellIndex(start.cx, start.cz);
  const goalIdx = cellIndex(goal.cx, goal.cz);

  gScore[startIdx] = 0;
  fScore[startIdx] = octileHeuristic(start.cx, start.cz, goal.cx, goal.cz);
  open.add(startIdx);

  while (open.size > 0) {
    let current = -1;
    let bestF = Infinity;
    for (const idx of open) {
      if (fScore[idx] < bestF) {
        bestF = fScore[idx];
        current = idx;
      }
    }

    if (current === goalIdx) {
      const path: Vec2[] = [];
      let cur = current;
      while (cur !== startIdx) {
        const cz = Math.floor(cur / GRID_SIZE);
        const cx = cur % GRID_SIZE;
        path.unshift(cellToWorldCoords(cx, cz));
        cur = cameFrom[cur];
      }
      path.push(cellToWorldCoords(goal.cx, goal.cz));
      return path;
    }

    open.delete(current);
    const cz = Math.floor(current / GRID_SIZE);
    const cx = current % GRID_SIZE;

    for (const dir of DIRS_8) {
      const nx = cx + dir.dx;
      const nz = cz + dir.dz;
      if (!isCellWalkable(nx, nz)) continue;
      if (!canStepDiagonal(cx, cz, dir.dx, dir.dz)) continue;

      const neighbor = cellIndex(nx, nz);
      const tentative = gScore[current] + dir.cost;
      if (tentative >= gScore[neighbor]) continue;

      cameFrom[neighbor] = current;
      gScore[neighbor] = tentative;
      fScore[neighbor] = tentative + octileHeuristic(nx, nz, goal.cx, goal.cz);
      open.add(neighbor);
    }
  }

  return [];
}

/** True when every waypoint lies outside the building AABB at (0, -14). */
export function pathAvoidsBuildingCentre(path: readonly Vec2[]): boolean {
  const centre = BUILDING_AABBS[4];
  for (const pt of path) {
    if (isPointInAabb(pt.x, pt.z, centre)) return false;
  }
  return true;
}
