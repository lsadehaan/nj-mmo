import { createIconImg } from './icon-img';

export interface ActiveEffectView {
  skillId: number;
  kind: 'buff_self' | 'debuff_enemy' | string;
  expiresAtMs: number;
}

export function renderEffectBars(effects: ActiveEffectView[], nowMs: number): void {
  let buffBar = document.getElementById('buff-bar');
  if (!buffBar) {
    buffBar = document.createElement('div');
    buffBar.id = 'buff-bar';
    buffBar.style.cssText =
      'position:fixed;bottom:72px;left:50%;transform:translateX(-50%);display:flex;gap:4px;z-index:11';
    document.body.appendChild(buffBar);
  }

  let debuffBar = document.getElementById('debuff-bar');
  if (!debuffBar) {
    debuffBar = document.createElement('div');
    debuffBar.id = 'debuff-bar';
    debuffBar.style.cssText =
      'position:fixed;bottom:56px;left:50%;transform:translateX(-50%);display:flex;gap:4px;z-index:11';
    document.body.appendChild(debuffBar);
  }

  buffBar.innerHTML = '';
  debuffBar.innerHTML = '';

  for (const fx of effects) {
    if (fx.expiresAtMs <= nowMs) continue;
    const remainingSec = Math.floor((fx.expiresAtMs - nowMs) / 1000);
    const row = document.createElement('div');
    row.dataset['effectId'] = String(fx.skillId);
    row.style.cssText = 'position:relative;width:32px;height:32px';
    row.appendChild(
      createIconImg({ kind: 'skill', id: fx.skillId, alt: `Effect ${fx.skillId}`, sizePx: 32 })
    );
    const timer = document.createElement('span');
    timer.dataset['role'] = 'effect-timer';
    timer.textContent = String(remainingSec);
    timer.style.cssText = 'position:absolute;bottom:0;right:0;font-size:9px;color:#fff';
    row.appendChild(timer);

    if (fx.kind === 'debuff_enemy') {
      debuffBar.appendChild(row);
    } else {
      buffBar.appendChild(row);
    }
  }
}
