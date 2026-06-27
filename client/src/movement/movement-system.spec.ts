import { describe, it, expect } from 'vitest';
import {
  step,
  createInitialMoveState,
  ARRIVAL_EPSILON,
  DEFAULT_MOVE_SPEED,
} from './movement-system';

describe('movement system', () => {
  it('advances toward target at fixed speed', () => {
    const start = createInitialMoveState(0, 0, 0);
    const next = step(start, { targetX: 10, targetZ: 0 }, 1, DEFAULT_MOVE_SPEED);
    expect(next.x).toBeCloseTo(DEFAULT_MOVE_SPEED, 5);
    expect(next.z).toBe(0);
  });

  it('stops within epsilon of the target', () => {
    const start = { ...createInitialMoveState(0, 0, 0), targetX: 0.02, targetZ: 0 };
    const next = step(start, null, 1, DEFAULT_MOVE_SPEED);
    expect(Math.hypot(next.x - 0.02, next.z)).toBeLessThanOrEqual(ARRIVAL_EPSILON + 0.001);
  });

  it('ignores null intent and leaves state unchanged', () => {
    const start = createInitialMoveState(1, 0, 2);
    expect(step(start, null, 1)).toEqual(start);
  });

  it('no-ops when already at target', () => {
    const start = { x: 5, y: 0, z: 5, targetX: 5, targetZ: 5 };
    expect(step(start, null, 1)).toEqual(start);
  });
});
