import { describe, it, expect } from 'vitest';
import { EntityAction, ACTION_DURATION_MS } from './entity-action';

describe('EntityAction', () => {
  it('defines enum values None=0, Attack=1, Cast=2, Die=3', () => {
    expect(EntityAction.None).toBe(0);
    expect(EntityAction.Attack).toBe(1);
    expect(EntityAction.Cast).toBe(2);
    expect(EntityAction.Die).toBe(3);
  });

  it('maps per-action client durations', () => {
    expect(ACTION_DURATION_MS[EntityAction.None]).toBe(0);
    expect(ACTION_DURATION_MS[EntityAction.Attack]).toBe(600);
    expect(ACTION_DURATION_MS[EntityAction.Cast]).toBe(800);
    expect(ACTION_DURATION_MS[EntityAction.Die]).toBe(1200);
  });
});
