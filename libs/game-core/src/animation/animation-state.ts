import { EntityAction, ACTION_DURATION_MS, type AnimationClip } from './entity-action';

export interface AnimState {
  activeAction: EntityAction;
  actionStartMs: number;
  lastSeq: number;
}

export interface AnimationInput {
  action: EntityAction;
  actionSeq: number;
  locomotion: 'idle' | 'move';
  nowMs: number;
}

export interface AnimationStepResult {
  state: AnimState;
  clip: AnimationClip;
  phase: number;
}

const TRANSIENT_PRECEDENCE: EntityAction[] = [
  EntityAction.Die,
  EntityAction.Cast,
  EntityAction.Attack,
];

function isKnownAction(action: number): action is EntityAction {
  return (
    action === EntityAction.None ||
    action === EntityAction.Attack ||
    action === EntityAction.Cast ||
    action === EntityAction.Die
  );
}

function actionToClip(action: EntityAction): AnimationClip | null {
  switch (action) {
    case EntityAction.Attack:
      return 'attack';
    case EntityAction.Cast:
      return 'cast';
    case EntityAction.Die:
      return 'die';
    default:
      return null;
  }
}

function locomotionClip(locomotion: 'idle' | 'move'): AnimationClip {
  return locomotion === 'move' ? 'move' : 'idle';
}

function transientPhase(action: EntityAction, elapsedMs: number): number {
  const duration = ACTION_DURATION_MS[action];
  if (duration <= 0) {
    return 1;
  }
  return Math.min(elapsedMs / duration, 1);
}

function pickActiveTransient(
  activeAction: EntityAction,
  actionStartMs: number,
  nowMs: number,
): { action: EntityAction; clip: AnimationClip } | null {
  for (const candidate of TRANSIENT_PRECEDENCE) {
    if (activeAction !== candidate) {
      continue;
    }
    const clip = actionToClip(candidate);
    if (!clip) {
      continue;
    }
    const elapsed = nowMs - actionStartMs;
    const duration = ACTION_DURATION_MS[candidate];

    if (candidate === EntityAction.Die) {
      return { action: candidate, clip };
    }

    if (elapsed < duration) {
      return { action: candidate, clip };
    }
  }
  return null;
}

export function createAnimState(): AnimState {
  return {
    activeAction: EntityAction.None,
    actionStartMs: 0,
    lastSeq: 0,
  };
}

export function stepAnimation(
  state: AnimState,
  input: AnimationInput,
): AnimationStepResult {
  const normalizedAction = isKnownAction(input.action)
    ? input.action
    : EntityAction.None;

  let { activeAction, actionStartMs, lastSeq } = state;

  if (input.actionSeq !== lastSeq) {
    lastSeq = input.actionSeq;
    if (normalizedAction !== EntityAction.None) {
      activeAction = normalizedAction;
      actionStartMs = input.nowMs;
    } else {
      activeAction = EntityAction.None;
    }
  }

  const nextState: AnimState = { activeAction, actionStartMs, lastSeq };
  const transient = pickActiveTransient(activeAction, actionStartMs, input.nowMs);

  if (transient) {
    const elapsed = input.nowMs - actionStartMs;
    return {
      state: nextState,
      clip: transient.clip,
      phase: transientPhase(transient.action, elapsed),
    };
  }

  if (
    activeAction !== EntityAction.None &&
    activeAction !== EntityAction.Die &&
    input.nowMs - actionStartMs >= ACTION_DURATION_MS[activeAction]
  ) {
    nextState.activeAction = EntityAction.None;
  }

  const clip = locomotionClip(input.locomotion);
  const loopMs = 1000;
  const phase = (input.nowMs % loopMs) / loopMs;

  return {
    state: nextState,
    clip,
    phase,
  };
}
