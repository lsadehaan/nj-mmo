import { describe, it, expect, beforeEach } from 'vitest';
import { EntityAction } from '@nj/game-core';
import {
  computeFacingYaw,
  createPlayerAvatar,
  MOVE_THRESHOLD,
} from './player-avatar';
import { initGameState, setMobs, setTargetMobId } from '../test-hook';

describe('createPlayerAvatar', () => {
  beforeEach(() => {
    initGameState();
    setMobs([]);
    setTargetMobId(null);
  });

  it('selects move when position delta exceeds threshold and idle otherwise', () => {
    const avatar = createPlayerAvatar();
    avatar.sync({ x: 0, y: 0, z: 0 });
    expect(avatar.update(0.016, 0)).toBe('idle');

    avatar.sync({ x: MOVE_THRESHOLD + 0.01, y: 0, z: 0 });
    expect(avatar.update(0.016, 16)).toBe('move');

    avatar.sync({ x: MOVE_THRESHOLD + 0.01, y: 0, z: 0 });
    expect(avatar.update(0.016, 32)).toBe('idle');
  });

  it('faces movement direction within ±5°', () => {
    const avatar = createPlayerAvatar();
    avatar.sync({ x: 0, y: 0, z: 0 });
    avatar.sync({ x: 0, y: 0, z: 1 });
    avatar.update(0.016, 0);
    const expected = Math.atan2(0, 1);
    expect(avatar.group.rotation.y).toBeCloseTo(expected, 1);
    expect(
      Math.abs(avatar.group.rotation.y - expected) * (180 / Math.PI)
    ).toBeLessThanOrEqual(5);
  });

  it('faces combat target during attack/cast when target exists', () => {
    setMobs([{ id: 'mob-1', npcId: 1, x: 10, y: 0, z: 0, hp: 10, maxHp: 10 }]);
    setTargetMobId('mob-1');

    const avatar = createPlayerAvatar();
    avatar.sync({
      x: 0,
      y: 0,
      z: 0,
      action: EntityAction.Attack,
      actionSeq: 1,
    });
    avatar.update(0.016, 0);

    const expected = Math.atan2(10, 0);
    expect(avatar.group.rotation.y).toBeCloseTo(expected, 1);
  });
});

describe('computeFacingYaw', () => {
  it('prefers target facing when requested', () => {
    const velocityYaw = computeFacingYaw(1, 0);
    const targetYaw = computeFacingYaw(0, 0, 5, 5, true);
    expect(targetYaw).toBeCloseTo(Math.atan2(5, 5), 5);
    expect(targetYaw).not.toBeCloseTo(velocityYaw, 1);
  });
});
