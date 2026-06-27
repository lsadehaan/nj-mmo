import { describe, it, expect, vi } from 'vitest';
import { raycastGround, toMovementIntent } from './click-to-move';

describe('click-to-move', () => {
  it('maps a ground hit to a movement intent', () => {
    const deps = {
      raycaster: { setFromCamera: vi.fn() },
      camera: {},
      ndcFromEvent: () => ({ x: 0, y: 0 }),
    };
    const hit = raycastGround(
      { clientX: 100, clientY: 100 },
      deps,
      { mesh: {} },
      800,
      600,
      () => [{ point: { x: 12, y: 1, z: -4 } }]
    );
    expect(toMovementIntent(hit)).toEqual({ targetX: 12, targetZ: -4 });
  });

  it('returns null intent on ray miss', () => {
    const deps = {
      raycaster: { setFromCamera: vi.fn() },
      camera: {},
      ndcFromEvent: () => ({ x: 0, y: 0 }),
    };
    const hit = raycastGround(
      { clientX: 0, clientY: 0 },
      deps,
      { mesh: {} },
      800,
      600,
      () => []
    );
    expect(hit).toBeNull();
    expect(toMovementIntent(hit)).toBeNull();
  });
});
