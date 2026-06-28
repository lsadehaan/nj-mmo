import { describe, it, expect } from 'vitest';
import { findPath, pathAvoidsBuildingCentre } from './pathfinding';
import { isPointInAabb, BUILDING_AABBS } from './world-blockers';

const BUILDING_CENTRE = BUILDING_AABBS[4];

function outsideBuildingAabb(x: number, z: number): boolean {
  return !isPointInAabb(x, z, BUILDING_CENTRE) ||
    Math.abs(x) > 4 ||
    Math.abs(z + 14) > 3;
}

describe('findPath', () => {
  const from = { x: 0, z: 20 };
  const to = { x: 0, z: -25 };

  it('returns a non-empty path around the village centre building', () => {
    const path = findPath(from, to);
    expect(path.length).toBeGreaterThan(0);
    expect(pathAvoidsBuildingCentre(path)).toBe(true);
    for (const pt of path) {
      expect(outsideBuildingAabb(pt.x, pt.z)).toBe(true);
    }
  });

  it('is deterministic for identical endpoints', () => {
    const a = findPath(from, to);
    const b = findPath(from, to);
    expect(a).toEqual(b);
  });
});
