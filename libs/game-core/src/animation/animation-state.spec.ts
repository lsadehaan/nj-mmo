import { describe, it, expect } from 'vitest';
import {
  createAnimState,
  stepAnimation,
} from './animation-state';
import { EntityAction } from './entity-action';

describe('animation state machine', () => {
  it('returns idle when no transient action is active', () => {
    const state = createAnimState();
    const result = stepAnimation(state, {
      action: EntityAction.None,
      actionSeq: 0,
      locomotion: 'idle',
      nowMs: 0,
    });
    expect(result.clip).toBe('idle');
    expect(result.phase).toBeGreaterThanOrEqual(0);
    expect(result.phase).toBeLessThanOrEqual(1);
  });

  it('returns move when locomotion is move and no transient is active', () => {
    const state = createAnimState();
    const result = stepAnimation(state, {
      action: EntityAction.None,
      actionSeq: 0,
      locomotion: 'move',
      nowMs: 100,
    });
    expect(result.clip).toBe('move');
  });

  it('starts attack clip at phase 0 when actionSeq increases (CHAR-09.2)', () => {
    let state = createAnimState();
    const first = stepAnimation(state, {
      action: EntityAction.Attack,
      actionSeq: 1,
      locomotion: 'move',
      nowMs: 1000,
    });
    expect(first.clip).toBe('attack');
    expect(first.phase).toBe(0);
    state = first.state;

    const mid = stepAnimation(state, {
      action: EntityAction.Attack,
      actionSeq: 1,
      locomotion: 'move',
      nowMs: 1300,
    });
    expect(mid.clip).toBe('attack');
    expect(mid.phase).toBeCloseTo(0.5, 5);
  });

  it('attack takes precedence over move then reverts after duration (CHAR-10)', () => {
    let state = createAnimState();
    const start = stepAnimation(state, {
      action: EntityAction.Attack,
      actionSeq: 1,
      locomotion: 'move',
      nowMs: 0,
    });
    expect(start.clip).toBe('attack');
    state = start.state;

    const after = stepAnimation(state, {
      action: EntityAction.Attack,
      actionSeq: 1,
      locomotion: 'move',
      nowMs: 700,
    });
    expect(after.clip).toBe('move');
  });

  it('die stays latched until next actionSeq change', () => {
    let state = createAnimState();
    const dieStart = stepAnimation(state, {
      action: EntityAction.Die,
      actionSeq: 1,
      locomotion: 'move',
      nowMs: 0,
    });
    expect(dieStart.clip).toBe('die');
    state = dieStart.state;

    const afterDuration = stepAnimation(state, {
      action: EntityAction.Die,
      actionSeq: 1,
      locomotion: 'idle',
      nowMs: 5000,
    });
    expect(afterDuration.clip).toBe('die');

    const afterSeq = stepAnimation(afterDuration.state, {
      action: EntityAction.None,
      actionSeq: 2,
      locomotion: 'idle',
      nowMs: 5001,
    });
    expect(afterSeq.clip).toBe('idle');
  });

  it('does not retrigger a finished clip when actionSeq is unchanged (CHAR-09.5)', () => {
    let state = createAnimState();
    const start = stepAnimation(state, {
      action: EntityAction.Attack,
      actionSeq: 1,
      locomotion: 'idle',
      nowMs: 0,
    });
    state = start.state;

    const expired = stepAnimation(state, {
      action: EntityAction.Attack,
      actionSeq: 1,
      locomotion: 'idle',
      nowMs: 700,
    });
    expect(expired.clip).toBe('idle');

    const stale = stepAnimation(expired.state, {
      action: EntityAction.Attack,
      actionSeq: 1,
      locomotion: 'idle',
      nowMs: 800,
    });
    expect(stale.clip).toBe('idle');
  });

  it('treats uint16 seq wrap as a new firing (change, not greater-than)', () => {
    let state = createAnimState();
    const first = stepAnimation(state, {
      action: EntityAction.Attack,
      actionSeq: 65535,
      locomotion: 'idle',
      nowMs: 0,
    });
    state = first.state;

    const wrapped = stepAnimation(state, {
      action: EntityAction.Cast,
      actionSeq: 0,
      locomotion: 'idle',
      nowMs: 10,
    });
    expect(wrapped.clip).toBe('cast');
    expect(wrapped.phase).toBe(0);
  });

  it('unknown action enum falls back to locomotion', () => {
    const state = createAnimState();
    const result = stepAnimation(state, {
      action: 99 as EntityAction,
      actionSeq: 1,
      locomotion: 'move',
      nowMs: 0,
    });
    expect(result.clip).toBe('move');
  });

  it('precedence: die > cast > attack during overlapping windows', () => {
    let state = createAnimState();
    const attack = stepAnimation(state, {
      action: EntityAction.Attack,
      actionSeq: 1,
      locomotion: 'move',
      nowMs: 0,
    });
    state = attack.state;

    const cast = stepAnimation(state, {
      action: EntityAction.Cast,
      actionSeq: 2,
      locomotion: 'move',
      nowMs: 100,
    });
    expect(cast.clip).toBe('cast');

    const die = stepAnimation(cast.state, {
      action: EntityAction.Die,
      actionSeq: 3,
      locomotion: 'move',
      nowMs: 200,
    });
    expect(die.clip).toBe('die');
  });

  it('two successive attacks have different seq and retrigger clip', () => {
    let state = createAnimState();
    const first = stepAnimation(state, {
      action: EntityAction.Attack,
      actionSeq: 1,
      locomotion: 'idle',
      nowMs: 0,
    });
    state = first.state;

    const mid = stepAnimation(state, {
      action: EntityAction.Attack,
      actionSeq: 1,
      locomotion: 'idle',
      nowMs: 700,
    });
    state = mid.state;

    const second = stepAnimation(state, {
      action: EntityAction.Attack,
      actionSeq: 2,
      locomotion: 'idle',
      nowMs: 800,
    });
    expect(second.clip).toBe('attack');
    expect(second.phase).toBe(0);
  });
});
