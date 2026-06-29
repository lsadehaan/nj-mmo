import { describe, it, expect, beforeEach } from 'vitest';
import { initGameState, getGameState, setQuests } from '../test-hook';

describe('wireRoom quest sync (unit)', () => {
  beforeEach(() => {
    initGameState();
  });

  // QUEST21-43 — hook updates when entries applied (mirrors wireRoom callback)
  it('updates __GAME_STATE__.quests when entries change', () => {
    setQuests([{ questId: 255, status: 'in_progress', step: 1 }]);
    expect(getGameState().quests.active).toHaveLength(1);
    expect(getGameState().quests.active[0]?.objectiveText).toContain('Gremlin');

    setQuests([{ questId: 255, status: 'in_progress', step: 2 }]);
    expect(getGameState().quests.active[0]?.step).toBe(2);
  });
});
