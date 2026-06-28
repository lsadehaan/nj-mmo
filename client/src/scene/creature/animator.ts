import {
  EntityAction,
  ACTION_DURATION_MS,
  createAnimState,
  stepAnimation,
  type AnimationClip,
} from '@nj/game-core';
import type { Rig } from './rig-contract';
import { applyClip } from './clips';

export interface AnimatorInput {
  action: EntityAction;
  actionSeq: number;
  locomotion: 'idle' | 'move';
  phaseRate?: number;
}

const LOOP_MS = 1000;

export function createAnimator(rig: Rig): {
  update(input: AnimatorInput, nowMs?: number): AnimationClip;
} {
  let state = createAnimState();
  let loopStartMs = 0;
  let lastNowMs = 0;

  return {
    update(input: AnimatorInput, nowMs = performance.now()): AnimationClip {
      if (lastNowMs === 0) {
        loopStartMs = nowMs;
      }
      lastNowMs = nowMs;

      const stepped = stepAnimation(state, {
        action: input.action,
        actionSeq: input.actionSeq,
        locomotion: input.locomotion,
        nowMs,
      });
      state = stepped.state;

      let phase = stepped.phase;
      if (stepped.clip === 'idle' || stepped.clip === 'move') {
        const rate = input.phaseRate ?? 1;
        phase = (((nowMs - loopStartMs) * rate) % LOOP_MS) / LOOP_MS;
      }

      applyClip(rig, stepped.clip, phase);
      return stepped.clip;
    },
  };
}

export { ACTION_DURATION_MS };
