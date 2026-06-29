import { describe, it, expect, beforeEach } from 'vitest';
import {
  entriesFromQuestState,
  isQuestLogVisible,
  mountQuestLog,
  QUEST_LOG_EMPTY_TEXT,
  renderQuestLog,
  setQuestLogVisible,
} from './quest-log';

describe('quest-log', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  // QUEST21-41
  it('toggles visibility on setQuestLogVisible', () => {
    mountQuestLog();
    setQuestLogVisible(true);
    expect(isQuestLogVisible()).toBe(true);
    setQuestLogVisible(false);
    expect(isQuestLogVisible()).toBe(false);
  });

  // QUEST21-42
  it('shows empty state when no quests', () => {
    renderQuestLog({ active: [], completed: [], visible: true });
    const empty = document.querySelector('[data-role="empty"]');
    expect(empty?.textContent).toBe(QUEST_LOG_EMPTY_TEXT);
  });

  // QUEST21-39
  it('renders objective text for active quest', () => {
    const { active } = entriesFromQuestState([
      { questId: 255, status: 'in_progress', step: 1 },
    ]);
    renderQuestLog({ active, completed: [], visible: true });
    const objective = document.querySelector('[data-role="objective"]');
    expect(objective?.textContent).toContain('Gremlin');
  });

  // QUEST21-38
  it('lists tutorial title for quest 255', () => {
    const { active } = entriesFromQuestState([
      { questId: 255, status: 'in_progress', step: 0 },
    ]);
    expect(active[0]?.title).toBe('Tutorial');
  });

  // QUEST21-40
  it('moves completed quests to completed list', () => {
    const { active, completed } = entriesFromQuestState([
      { questId: 255, status: 'completed', step: 3 },
      { questId: 105, status: 'in_progress', step: 0 },
    ]);
    expect(completed.map((q) => q.questId)).toContain(255);
    expect(active.map((q) => q.questId)).toContain(105);
  });
});
