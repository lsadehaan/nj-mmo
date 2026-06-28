import { describe, it, expect, vi, afterEach } from 'vitest';
import { EntityAction, ACTION_DURATION_MS } from '@nj/game-core';
import { buildHumanoid } from './humanoid';
import { createAnimator } from './animator';
import { captureSocketRotations } from './clips';

describe('createAnimator', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns attack over move then reverts after duration', () => {
    const rig = buildHumanoid();
    const animator = createAnimator(rig);
    const now = 1000;

    const moving = animator.update(
      { action: EntityAction.None, actionSeq: 0, locomotion: 'move' },
      now
    );
    expect(moving).toBe('move');

    const attack = animator.update(
      { action: EntityAction.Attack, actionSeq: 1, locomotion: 'move' },
      now + 10
    );
    expect(attack).toBe('attack');

    const after = animator.update(
      { action: EntityAction.Attack, actionSeq: 1, locomotion: 'move' },
      now + 10 + ACTION_DURATION_MS[EntityAction.Attack] + 50
    );
    expect(after).toBe('move');
  });

  it('latches die until actionSeq changes', () => {
    const rig = buildHumanoid();
    const animator = createAnimator(rig);

    const die = animator.update(
      { action: EntityAction.Die, actionSeq: 1, locomotion: 'idle' },
      0
    );
    expect(die).toBe('die');

    const still = animator.update(
      { action: EntityAction.Die, actionSeq: 1, locomotion: 'idle' },
      5000
    );
    expect(still).toBe('die');

    const idle = animator.update(
      { action: EntityAction.None, actionSeq: 2, locomotion: 'idle' },
      5001
    );
    expect(idle).toBe('idle');
  });

  it('applies the clip pose returned by the state machine', () => {
    const rig = buildHumanoid();
    const animator = createAnimator(rig);
    animator.update(
      { action: EntityAction.Attack, actionSeq: 1, locomotion: 'idle' },
      0
    );
    const attackPose = captureSocketRotations(rig);

    const rig2 = buildHumanoid();
    const animator2 = createAnimator(rig2);
    animator2.update(
      { action: EntityAction.None, actionSeq: 0, locomotion: 'idle' },
      0
    );
    expect(captureSocketRotations(rig2)).not.toEqual(attackPose);
  });
});
