import { describe, it, expect } from 'vitest';
import { buildHumanoid } from './humanoid';
import { applyClip, captureSocketRotations } from './clips';

describe('applyClip', () => {
  it('produces identical transforms for the same clip and phase', () => {
    const rigA = buildHumanoid();
    const rigB = buildHumanoid();
    applyClip(rigA, 'move', 0.35);
    applyClip(rigB, 'move', 0.35);
    expect(captureSocketRotations(rigA)).toEqual(captureSocketRotations(rigB));
  });

  it('poses each clip differently from idle', () => {
    const idleRig = buildHumanoid();
    applyClip(idleRig, 'idle', 0.25);
    const idlePose = captureSocketRotations(idleRig);

    for (const clip of ['move', 'attack', 'cast', 'die'] as const) {
      const rig = buildHumanoid();
      applyClip(rig, clip, 0.5);
      expect(captureSocketRotations(rig)).not.toEqual(idlePose);
    }
  });

  it('keeps joint rotations within a sane envelope', () => {
    const rig = buildHumanoid();
    for (const clip of ['idle', 'move', 'attack', 'cast', 'die'] as const) {
      applyClip(rig, clip, 0.75);
      for (const socket of Object.values(rig.sockets)) {
        expect(Math.abs(socket.rotation.x)).toBeLessThanOrEqual(2);
        expect(Math.abs(socket.rotation.y)).toBeLessThanOrEqual(2);
        expect(Math.abs(socket.rotation.z)).toBeLessThanOrEqual(2);
      }
    }
  });
});
