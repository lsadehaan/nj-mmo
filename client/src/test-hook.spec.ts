import { describe, it, expect, beforeEach } from 'vitest';
import { initGameState, setQuests, getGameState } from './test-hook';

describe('test-hook quests', () => {
  beforeEach(() => {
    initGameState();
  });

  // QUEST21-38
  it('setQuests lists tutorial in active on join shape', () => {
    setQuests([{ questId: 255, status: 'in_progress', step: 0 }]);
    expect(getGameState().quests.active[0]?.title).toBe('Tutorial');
    expect(getGameState().quests.active[0]?.questId).toBe(255);
  });

  // QUEST21-40
  it('moves completed quest to completed list', () => {
    setQuests([
      { questId: 255, status: 'completed', step: 3 },
      { questId: 105, status: 'in_progress', step: 0 },
    ]);
    expect(getGameState().quests.completed.map((q) => q.questId)).toContain(255);
    expect(getGameState().quests.active.map((q) => q.questId)).toContain(105);
  });

  it('exposes quest defs catalog', () => {
    setQuests([]);
    expect(getGameState().quests.defs[255]?.name).toBe('Tutorial');
  });
});
