import { describe, it, expect, beforeEach } from 'vitest';
import { initGameState, setQuests, setPlayerActiveEffects, getGameState } from '../test-hook';
import { renderQuestTracker } from '../ui/quest-tracker';

describe('room-ui-shell hooks', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    initGameState();
  });

  it('UI28-34: quest tracker refreshes from game state', () => {
    setQuests([{ questId: 255, status: 'in_progress', step: 1 }]);
    const { quests } = getGameState();
    const first = quests.active[0];
    renderQuestTracker(
      first ? { title: first.title, objectiveText: first.objectiveText } : null
    );
    expect(document.getElementById('quest-tracker')?.hidden).toBe(false);
  });

  it('UI28-51: activeEffects mirrored on player', () => {
    setPlayerActiveEffects([{ skillId: 1068, kind: 'buff_self', expiresAtMs: Date.now() + 5000 }]);
    expect(getGameState().player.activeEffects[0]?.skillId).toBe(1068);
  });

  it('UI28-58: ui flags on game state', () => {
    getGameState().ui.inventoryOpen = true;
    expect(getGameState().ui.inventoryOpen).toBe(true);
  });
});
