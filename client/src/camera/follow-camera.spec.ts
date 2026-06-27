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
});
