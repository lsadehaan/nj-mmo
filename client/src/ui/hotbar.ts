import { createIconImg } from './icon-img';
import { getSkillIconPath } from './icon-manifest';
import { getSkillInfo } from './game-catalog';
import { attachTooltip } from './tooltip';

const HOTBAR_ID = 'skill-hotbar';
const HOTKEYS = ['2', '3', '4'] as const;
const MAX_SLOTS = 3;

export interface HotbarHandlers {
  onUseSkill: (skillId: number) => void;
}

export function mountHotbar(): HTMLElement {
  const existing = document.getElementById(HOTBAR_ID);
  if (existing) return existing;

  const bar = document.createElement('div');
  bar.id = HOTBAR_ID;
  bar.style.cssText = [
    'position:fixed',
    'left:50%',
    'bottom:16px',
    'transform:translateX(-50%)',
    'display:flex',
    'gap:8px',
    'z-index:10',
  ].join(';');
  document.body.appendChild(bar);
  return bar;
}

export function renderHotbar(options: {
  knownSkillIds: number[];
  skillCooldownEndMs: number[];
  nowMs?: number;
  handlers: HotbarHandlers;
}): void {
  const bar = mountHotbar();
  bar.innerHTML = '';
  const now = options.nowMs ?? Date.now();
  const skills = options.knownSkillIds.slice(0, MAX_SLOTS);

  skills.forEach((skillId, index) => {
    const slot = document.createElement('button');
    slot.type = 'button';
    slot.dataset['skillId'] = String(skillId);
    slot.dataset['hotkey'] = HOTKEYS[index] ?? String(index + 2);
    const hotkey = slot.dataset['hotkey'];
    const info = getSkillInfo(skillId);
    attachTooltip(slot, () => {
      const cooldownEnd = options.skillCooldownEndMs[index] ?? 0;
      const left = Math.max(0, Math.ceil((cooldownEnd - (options.nowMs ?? Date.now())) / 1000));
      const body = left > 0 ? `${info.description}\nReady in ${left}s` : info.description;
      return { title: `${info.name}  (Hotkey ${hotkey})`, body };
    });
    slot.style.cssText = [
      'position:relative',
      'width:48px',
      'height:48px',
      'padding:0',
      'border:2px solid rgba(255,255,255,0.85)',
      'border-radius:4px',
      'background:rgba(0,0,0,0.45)',
      'overflow:hidden',
      'cursor:pointer',
    ].join(';');

    const icon = createIconImg({
      kind: 'skill',
      id: skillId,
      alt: `Skill ${skillId}`,
      sizePx: 48,
    });
    icon.style.cssText = 'width:100%;height:100%;object-fit:contain;pointer-events:none;';
    slot.appendChild(icon);

    const cooldownEnd = options.skillCooldownEndMs[index] ?? 0;
    const remaining = Math.max(0, cooldownEnd - now);
    if (remaining > 0) {
      const fill = document.createElement('div');
      fill.dataset['role'] = 'cooldown-fill';
      fill.style.cssText = [
        'position:absolute',
        'left:0',
        'bottom:0',
        'width:100%',
        'height:100%',
        'background:rgba(0,0,0,0.55)',
        'pointer-events:none',
      ].join(';');
      slot.appendChild(fill);
      slot.disabled = true;
    }

    slot.addEventListener('click', () => {
      options.handlers.onUseSkill(skillId);
    });
    bar.appendChild(slot);
  });
}

export function getHotbarHotkeys(): readonly string[] {
  return HOTKEYS;
}

export function getSkillIconUrl(skillId: number): string {
  return getSkillIconPath(skillId);
}
