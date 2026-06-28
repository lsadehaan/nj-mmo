/** Render-only entity action ids replicated from server (AD-015). */
export enum EntityAction {
  None = 0,
  Attack = 1,
  Cast = 2,
  Die = 3,
}

export type AnimationClip = 'idle' | 'move' | 'attack' | 'cast' | 'die';

/** Client-side transient clip durations (ms). */
export const ACTION_DURATION_MS: Record<EntityAction, number> = {
  [EntityAction.None]: 0,
  [EntityAction.Attack]: 600,
  [EntityAction.Cast]: 800,
  [EntityAction.Die]: 1200,
};
