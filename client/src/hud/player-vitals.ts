const ELEMENT_ID = 'player-vitals-hud';

export interface PlayerVitalsHudState {
  level: number;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
}

export function mountPlayerVitalsHud(): HTMLElement {
  const existing = document.getElementById(ELEMENT_ID);
  if (existing) return existing;

  const hud = document.createElement('div');
  hud.id = ELEMENT_ID;
  hud.style.cssText = [
    'position:fixed',
    'top:16px',
    'left:16px',
    'padding:8px 12px',
    'background:rgba(0,0,0,0.55)',
    'color:#f5f5f5',
    'border:1px solid rgba(255,255,255,0.35)',
    'border-radius:4px',
    'font:13px/1.35 system-ui,sans-serif',
    'z-index:10',
    'pointer-events:none',
  ].join(';');

  const levelEl = document.createElement('div');
  levelEl.dataset['role'] = 'level';
  hud.appendChild(levelEl);

  const hpEl = document.createElement('div');
  hpEl.dataset['role'] = 'hp';
  hud.appendChild(hpEl);

  const mpEl = document.createElement('div');
  mpEl.dataset['role'] = 'mp';
  hud.appendChild(mpEl);

  document.body.appendChild(hud);
  updatePlayerVitalsHud({ level: 1, hp: 0, maxHp: 0, mp: 0, maxMp: 0 });
  return hud;
}

export function updatePlayerVitalsHud(state: PlayerVitalsHudState): void {
  const hud = mountPlayerVitalsHud();
  const levelEl = hud.querySelector('[data-role="level"]');
  const hpEl = hud.querySelector('[data-role="hp"]');
  const mpEl = hud.querySelector('[data-role="mp"]');

  if (levelEl) levelEl.textContent = `Lv.${state.level}`;
  if (hpEl) hpEl.textContent = `HP ${state.hp}/${state.maxHp}`;
  if (mpEl) mpEl.textContent = `MP ${state.mp}/${state.maxMp}`;
}
