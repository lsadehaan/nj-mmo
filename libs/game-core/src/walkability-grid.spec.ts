import { describe, it, expect } from 'vitest';
import {
  getWalkabilityGrid,
  GRID_SIZE,
  worldToCellCoords,
  isCellWalkable,
} from './walkability-grid';
import { isPointInAabb, BUILDING_AABBS } from './world-blockers';

describe('walkability grid', () => {
  it('bakes a 630×630 grid covering expanded bounds (TIW23-41)', () => {
    const grid = getWalkabilityGrid();
    expect(grid.length).toBe(GRID_SIZE * GRID_SIZE);
    expect(GRID_SIZE).toBe(630);
  });

  it('marks cell at building centre (0,-14) unwalkable', () => {
    const { cx, cz } = worldToCellCoords(0, -14);
    expect(isCellWalkable(cx, cz)).toBe(false);
  });

  it('marks open field cell (-100,20) walkable', () => {
    const { cx, cz } = worldToCellCoords(-100, 20);
    expect(isCellWalkable(cx, cz)).toBe(true);
  });

  it('walkable cells avoid building AABB interior', () => {
    const centre = BUILDING_AABBS[4];
    const { cx, cz } = worldToCellCoords(centre.cx, centre.cz);
    expect(isCellWalkable(cx, cz)).toBe(false);
    expect(isPointInAabb(centre.cx, centre.cz, centre)).toBe(true);
  });
});
