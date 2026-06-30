import { describe, it, expect, vi } from 'vitest';
import { computeCameraPosition, applyTo, DEFAULT_CAMERA_OFFSET } from './follow-camera';

describe('follow camera', () => {
  it('returns player position plus offset', () => {
    expect(computeCameraPosition({ x: 1, y: 2, z: 3 })).toEqual({
      x: 1 + DEFAULT_CAMERA_OFFSET.x,
      y: 2 + DEFAULT_CAMERA_OFFSET.y,
      z: 3 + DEFAULT_CAMERA_OFFSET.z,
    });
  });

  it('keeps fixed offset as player moves', () => {
    const camera = {
      position: { x: 0, y: 0, z: 0 },
      lookAt: vi.fn(),
    };
    applyTo(camera, { x: 5, y: 1, z: -2 });
    expect(camera.position).toEqual(computeCameraPosition({ x: 5, y: 1, z: -2 }));
    applyTo(camera, { x: 10, y: 1, z: 4 });
    expect(camera.position.x - 10).toBe(DEFAULT_CAMERA_OFFSET.x);
    expect(camera.position.z - 4).toBe(DEFAULT_CAMERA_OFFSET.z);
  });

  it('orbits the camera around the player when yaw is applied (so side mobs become clickable)', () => {
    const player = { x: 0, y: 0, z: 0 };
    // Quarter turn: the camera swings from due-south onto the player's flank,
    // keeping the same orbit radius so a mob to the side comes into view.
    const quarter = computeCameraPosition(player, DEFAULT_CAMERA_OFFSET, Math.PI / 2);
    expect(quarter.x).toBeCloseTo(-DEFAULT_CAMERA_OFFSET.z, 6);
    expect(quarter.z).toBeCloseTo(0, 6);
    expect(quarter.y).toBe(DEFAULT_CAMERA_OFFSET.y);

    // Half turn flips the camera to the far side at the same radius.
    const half = computeCameraPosition(player, DEFAULT_CAMERA_OFFSET, Math.PI);
    expect(half.z).toBeCloseTo(-DEFAULT_CAMERA_OFFSET.z, 6);
    expect(half.x).toBeCloseTo(0, 6);
  });

  it('preserves orbit radius for any yaw', () => {
    const offset = DEFAULT_CAMERA_OFFSET;
    const radius = Math.hypot(offset.x, offset.z);
    for (const yaw of [0, 0.3, 1.1, Math.PI, 4.7, 6.2]) {
      const pos = computeCameraPosition({ x: 3, y: 1, z: -4 }, offset, yaw);
      expect(Math.hypot(pos.x - 3, pos.z - -4)).toBeCloseTo(radius, 6);
    }
  });
});
