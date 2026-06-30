import { describe, it, expect, beforeAll } from 'vitest';
import { findPath, pathAvoidsBuildingCentre } from './pathfinding';
import { isPointInAabb, BUILDING_AABBS, LANDMARK_AABBS } from './world-blockers';
import { getWalkabilityGrid, resetWalkabilityGridCache } from './walkability-grid';

const BUILDING_CENTRE = BUILDING_AABBS[4];

function outsideBuildingAabb(x: number, z: number): boolean {
  return (
    !isPointInAabb(x, z, BUILDING_CENTRE) ||
    Math.abs(x) > 4 ||
    Math.abs(z + 14) > 3
  );
}

describe('findPath', () => {
  beforeAll(() => {
    resetWalkabilityGridCache();
    getWalkabilityGrid();
  });

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

  it('returns village → obelisk path on expanded map (TIW23-42)', () => {
    const path = findPath({ x: 0, z: 0 }, { x: -150, z: 55 });
    expect(path.length).toBeGreaterThan(0);
  });

  it('is deterministic for identical endpoints', () => {
    const a = findPath(from, to);
    const b = findPath(from, to);
    expect(a).toEqual(b);
  });
});

describe('landmark blockers', () => {
  it('each landmark AABB contains its anchor centre (TIW23-43)', () => {
    const anchors = [
      { cx: -155, cz: 58 },
      { cx: -281, cz: 87 },
      { cx: -270, cz: 90 },
      { cx: -224, cz: 287 },
      { cx: -242, cz: 254 },
      { cx: -110, cz: 29 },
    ];
    expect(LANDMARK_AABBS).toHaveLength(anchors.length);
    for (let i = 0; i < anchors.length; i++) {
      expect(isPointInAabb(anchors[i].cx, anchors[i].cz, LANDMARK_AABBS[i])).toBe(
        true
      );
    }
  });
});
