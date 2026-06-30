import { describe, it, expect, beforeAll } from 'vitest';
import {
  BUILDING_AABBS,
  isBlocked,
  isPointInAabb,
  getPropBlockers,
  resetPropBlockerCache,
} from './world-blockers';

describe('world blockers', () => {
  beforeAll(() => {
    resetPropBlockerCache();
  });

  it('exports five building AABBs with centre (0,-14) half 4×3', () => {
    expect(BUILDING_AABBS).toHaveLength(5);
    const centre = BUILDING_AABBS[4];
    expect(centre.cx).toBe(0);
    expect(centre.cz).toBe(-14);
    expect(centre.halfW).toBe(4);
    expect(centre.halfD).toBe(3);
  });

  it('scatter prop blockers count 220 ±5 (TIW23-44)', () => {
    expect(getPropBlockers().length).toBeGreaterThanOrEqual(215);
    expect(getPropBlockers().length).toBeLessThanOrEqual(225);
  });

  it('isBlocked is true inside building at (0,-14)', () => {
    expect(isBlocked(0, -14)).toBe(true);
    expect(isBlocked(3.9, -14)).toBe(true);
    expect(isBlocked(0, -16.9)).toBe(true);
  });

  it('isBlocked is false outside building footprint', () => {
    expect(isBlocked(5, -14)).toBe(false);
    expect(isBlocked(0, -8)).toBe(false);
  });

  it('isPointInAabb matches building bounds', () => {
    const aabb = BUILDING_AABBS[4];
    expect(isPointInAabb(0, -14, aabb)).toBe(true);
    expect(isPointInAabb(4.1, -14, aabb)).toBe(false);
  });
});
