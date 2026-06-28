import { describe, it, expect } from 'vitest';
import {
  step,
  stepAlongPath,
  createPathMoveState,
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

describe('stepAlongPath', () => {
  it('follows a 3-waypoint path to the goal in bounded ticks', () => {
    const waypoints = [
      { x: 5, z: 0 },
      { x: 5, z: 5 },
      { x: 0, z: 5 },
    ];
    let state = createPathMoveState(0, 0, 0);
    state = { ...state, waypoints, waypointIndex: 0, targetX: 5, targetZ: 0 };

    for (let i = 0; i < 600; i++) {
      state = stepAlongPath(state, null, 0.05);
    }

    expect(state.x).toBeCloseTo(0, 0);
    expect(state.z).toBeCloseTo(5, 0);
  });

  it('new intent clears waypoints via caller contract', () => {
    const state = {
      ...createPathMoveState(0, 0, 0),
      waypoints: [{ x: 10, z: 0 }],
      waypointIndex: 0,
      targetX: 10,
      targetZ: 0,
    };
    const next = stepAlongPath(state, { targetX: 3, targetZ: 4 }, 0.05);
    expect(next.waypoints).toEqual([]);
    expect(next.waypointIndex).toBe(0);
    expect(next.targetX).toBe(3);
    expect(next.targetZ).toBe(4);
  });
});
