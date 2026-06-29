import { questObjectiveText, questTitle } from '../quest-catalog';

export interface QuestLogEntry {
  questId: number;
  title: string;
  objectiveText: string;
  step: number;
  status: 'in_progress' | 'completed';
}

export interface QuestLogRenderOptions {
  active: QuestLogEntry[];
  completed: QuestLogEntry[];
  visible: boolean;
}

const ELEMENT_ID = 'quest-log';
export const QUEST_LOG_EMPTY_TEXT = 'No active quests';

export function mountQuestLog(): HTMLElement {
  const existing = document.getElementById(ELEMENT_ID);
  if (existing) return existing;

  const panel = document.createElement('div');
  panel.id = ELEMENT_ID;
  panel.hidden = true;
  panel.style.cssText = [
    'position:fixed',
    'top:12px',
    'right:12px',
    'width:260px',
    'max-height:50vh',
    'overflow:auto',
    'padding:12px',
    'background:rgba(16,12,8,0.9)',
    'color:#f5e6c8',
    'border:2px solid #8b7355',
    'border-radius:6px',
    'z-index:18',
    'font:13px/1.4 system-ui,sans-serif',
  ].join(';');

  const title = document.createElement('h2');
  title.dataset['role'] = 'title';
  title.textContent = 'Quest Log';
  title.style.margin = '0 0 8px';
  title.style.fontSize = '15px';
  panel.appendChild(title);

  const body = document.createElement('div');
  body.dataset['role'] = 'body';
  panel.appendChild(body);

  document.body.appendChild(panel);
  return panel;
}

export function renderQuestLog(options: QuestLogRenderOptions): void {
  const panel = mountQuestLog();
  panel.hidden = !options.visible;

  const body = panel.querySelector('[data-role="body"]');
  if (!body) return;
  body.innerHTML = '';

  if (options.active.length === 0 && options.completed.length === 0) {
    const empty = document.createElement('p');
    empty.dataset['role'] = 'empty';
    empty.textContent = QUEST_LOG_EMPTY_TEXT;
    body.appendChild(empty);
    return;
  }

  for (const entry of options.active) {
    const row = document.createElement('div');
    row.dataset['role'] = 'active-quest';
    row.dataset['questId'] = String(entry.questId);
    row.innerHTML = `<strong>${entry.title}</strong><br/><span data-role="objective">${entry.objectiveText}</span>`;
    body.appendChild(row);
  }

  if (options.completed.length > 0) {
    const doneTitle = document.createElement('h3');
    doneTitle.textContent = 'Completed';
    doneTitle.style.fontSize = '13px';
    doneTitle.style.margin = '12px 0 4px';
    body.appendChild(doneTitle);
    for (const entry of options.completed) {
      const row = document.createElement('div');
      row.dataset['role'] = 'completed-quest';
      row.dataset['questId'] = String(entry.questId);
      row.textContent = entry.title;
      body.appendChild(row);
    }
  }
}

export function setQuestLogVisible(visible: boolean): void {
  const panel = mountQuestLog();
  panel.hidden = !visible;
}

export function isQuestLogVisible(): boolean {
  const panel = document.getElementById(ELEMENT_ID);
  return panel !== null && !panel.hidden;
}

export function entriesFromQuestState(
  entries: { questId: number; status: string; step: number }[]
): { active: QuestLogEntry[]; completed: QuestLogEntry[] } {
  const active: QuestLogEntry[] = [];
  const completed: QuestLogEntry[] = [];
  for (const e of entries) {
    const title = questTitle(e.questId);
    if (e.status === 'completed') {
      completed.push({ questId: e.questId, title, objectiveText: '', step: e.step, status: 'completed' });
    } else {
      active.push({
        questId: e.questId,
        title,
        objectiveText: questObjectiveText(e.questId, e.step),
        step: e.step,
        status: 'in_progress',
      });
    }
  }
  return { active, completed };
}
