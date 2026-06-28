import { EntityAction } from '@nj/game-core';
import type { AnimationClip } from '@nj/game-core';

export function detectHpHit(prevHp: number, nextHp: number): boolean {
  if (prevHp <= 0) return false;
  return nextHp < prevHp;
}

export function detectLevelUp(prevLevel: number, nextLevel: number): boolean {
  return nextLevel > prevLevel;
}

export function actionToClip(action: EntityAction): AnimationClip {
  switch (action) {
    case EntityAction.Attack:
      return 'attack';
    case EntityAction.Cast:
      return 'cast';
    case EntityAction.Die:
      return 'die';
    default:
      return 'idle';
  }
}

export function detectActionEdge(
  prevAction: EntityAction,
  prevSeq: number,
  nextAction: EntityAction,
  nextSeq: number,
  clip: AnimationClip
): boolean {
  if (nextSeq <= prevSeq) return false;
  return actionToClip(nextAction) === clip;
}

export function countLevelUps(prevLevel: number, nextLevel: number): number {
  if (nextLevel <= prevLevel) return 0;
  return nextLevel - prevLevel;
}
