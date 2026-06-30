const ELEMENT_ID = 'quest-tracker';

export interface QuestTrackerEntry {
  title: string;
  objectiveText: string;
}

export function mountQuestTracker(): HTMLElement {
  const existing = document.getElementById(ELEMENT_ID);
  if (existing) return existing;

  const tracker = document.createElement('div');
  tracker.id = ELEMENT_ID;
  tracker.hidden = true;
  tracker.style.cssText =
    'position:fixed;top:8px;left:50%;transform:translateX(-50%);padding:6px 12px;background:rgba(0,0,0,0.7);color:#f5e6c8;border:1px solid #8b7355;border-radius:4px;z-index:12;pointer-events:none;font:13px system-ui';
  document.body.appendChild(tracker);
  return tracker;
}

export function renderQuestTracker(entry: QuestTrackerEntry | null): void {
  const tracker = mountQuestTracker();
  if (!entry) {
    tracker.hidden = true;
    tracker.textContent = '';
    return;
  }
  tracker.hidden = false;
  tracker.innerHTML = `<strong data-role="tracker-title">${entry.title}</strong> — <span data-role="tracker-objective">${entry.objectiveText}</span>`;
}
