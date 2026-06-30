import { describe, it, expect, beforeEach } from 'vitest';
import { mountQuestLog, renderQuestLog, setQuestLogTab } from './quest-log';
import { renderQuestTracker } from './quest-tracker';

describe('quest log tabs and tracker', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('UI28-29: Active and Completed tabs exist', () => {
    mountQuestLog();
    expect(document.querySelector('[data-tab="active"]')).not.toBeNull();
    expect(document.querySelector('[data-tab="completed"]')).not.toBeNull();
  });

  it('UI28-30: active tab shows active quests only', () => {
    setQuestLogTab('active');
    renderQuestLog({
      active: [{ questId: 255, title: 'Tutorial', objectiveText: 'Kill gremlins', step: 1, status: 'in_progress' }],
      completed: [{ questId: 1, title: 'Done', objectiveText: '', step: 0, status: 'completed' }],
      visible: true,
      tab: 'active',
    });
    expect(document.querySelectorAll('[data-role="active-quest"]').length).toBe(1);
    expect(document.querySelectorAll('[data-role="completed-quest"]').length).toBe(0);
  });

  it('UI28-31: completed tab shows completed', () => {
    renderQuestLog({
      active: [],
      completed: [{ questId: 255, title: 'Tutorial', objectiveText: '', step: 3, status: 'completed' }],
      visible: true,
      tab: 'completed',
    });
    expect(document.querySelectorAll('[data-role="completed-quest"]').length).toBe(1);
  });

  it('UI28-32: tracker shows first active objective', () => {
    renderQuestTracker({ title: 'Tutorial', objectiveText: 'Kill 3 gremlins' });
    expect(document.getElementById('quest-tracker')?.hidden).toBe(false);
    expect(document.querySelector('[data-role="tracker-objective"]')?.textContent).toContain('gremlins');
  });

  it('UI28-33: tracker hidden when no active', () => {
    renderQuestTracker(null);
    expect(document.getElementById('quest-tracker')?.hidden).toBe(true);
  });
});
