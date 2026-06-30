import { createIconImg } from './icon-img';
import { getSkillIconPath } from './icon-manifest';
import { getSkillInfo } from './game-catalog';
import { attachTooltip } from './tooltip';

const ELEMENT_ID = 'skill-window';

export interface SkillWindowRenderOptions {
  knownSkillIds: number[];
  skillCooldownEndMs: number[];
  sp: number;
  nowMs?: number;
  onUseSkill?: (skillId: number) => void;
  visible?: boolean;
}

export function mountSkillWindow(): HTMLElement {
  const existing = document.getElementById(ELEMENT_ID);
  if (existing) return existing;

  const panel = document.createElement('div');
  panel.id = ELEMENT_ID;
  panel.hidden = true;
  panel.style.cssText =
    'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);min-width:280px;padding:16px;background:rgba(16,14,24,0.95);color:#eee;border:2px solid #6b5b95;border-radius:6px;z-index:25;pointer-events:auto';

  const title = document.createElement('h2');
  title.textContent = 'Skills';
  panel.appendChild(title);

  const spRow = document.createElement('div');
  spRow.dataset['role'] = 'sp-balance';
  panel.appendChild(spRow);

  const list = document.createElement('div');
  list.dataset['role'] = 'skill-list';
  panel.appendChild(list);

  document.body.appendChild(panel);
  return panel;
}

export function renderSkillWindow(options: SkillWindowRenderOptions): void {
  const panel = mountSkillWindow();
  if (options.visible !== undefined) panel.hidden = !options.visible;

  const spEl = panel.querySelector('[data-role="sp-balance"]');
  if (spEl) spEl.textContent = `SP: ${options.sp}`;

  const list = panel.querySelector('[data-role="skill-list"]');
  if (!list) return;
  list.innerHTML = '';

  if (options.knownSkillIds.length === 0) {
    const empty = document.createElement('p');
    empty.dataset['role'] = 'skills-empty';
    empty.textContent = 'No skills learned';
    list.appendChild(empty);
    return;
  }

  const nowMs = options.nowMs ?? Date.now();
  options.knownSkillIds.forEach((skillId, index) => {
    const row = document.createElement('button');
    row.type = 'button';
    row.dataset['skillId'] = String(skillId);
    row.style.cssText = 'display:flex;align-items:center;gap:8px;width:100%;margin:4px 0';

    const info = getSkillInfo(skillId);
    row.appendChild(
      createIconImg({ kind: 'skill', id: skillId, alt: info.name, sizePx: 32 })
    );

    const label = document.createElement('span');
    label.dataset['role'] = 'skill-name';
    label.textContent = info.name;
    row.appendChild(label);

    const cdEnd = options.skillCooldownEndMs[index] ?? 0;
    const remaining = Math.max(0, cdEnd - nowMs);
    if (remaining > 0) {
      const overlay = document.createElement('span');
      overlay.dataset['role'] = 'skill-cooldown';
      overlay.textContent = String(Math.ceil(remaining / 1000));
      row.appendChild(overlay);
    }

    attachTooltip(row, { title: info.name, body: info.description });
    row.addEventListener('click', () => options.onUseSkill?.(skillId));
    list.appendChild(row);
  });
}

export function getSkillIconForTest(skillId: number): string {
  return getSkillIconPath(skillId);
}
