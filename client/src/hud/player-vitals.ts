const ELEMENT_ID = 'player-vitals-hud';

export interface PlayerVitalsHudState {
  level: number;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  pDef?: number;
}

export function mountPlayerVitalsHud(): HTMLElement {
  const existing = document.getElementById(ELEMENT_ID);
  if (existing) return existing;

  const hud = document.createElement('div');
  hud.id = ELEMENT_ID;
  hud.style.cssText =
    'position:fixed;top:16px;left:16px;padding:8px 12px;background:rgba(0,0,0,0.55);color:#f5f5f5;border:1px solid rgba(255,255,255,0.35);border-radius:4px;font:13px/1.35 system-ui,sans-serif;z-index:10;pointer-events:none';

  const levelEl = document.createElement('div');
  levelEl.dataset['role'] = 'level';
  hud.appendChild(levelEl);

  const hpBar = document.createElement('div');
  hpBar.dataset['role'] = 'hp-bar';
  hpBar.style.cssText = 'width:120px;height:8px;background:#333;margin:4px 0;border-radius:2px;overflow:hidden';
  const hpFill = document.createElement('div');
  hpFill.dataset['role'] = 'hp-fill';
  hpFill.style.cssText = 'height:100%;background:#c33';
  hpBar.appendChild(hpFill);
  hud.appendChild(hpBar);

  const mpBar = document.createElement('div');
  mpBar.dataset['role'] = 'mp-bar';
  mpBar.style.cssText = 'width:120px;height:8px;background:#333;border-radius:2px;overflow:hidden';
  const mpFill = document.createElement('div');
  mpFill.dataset['role'] = 'mp-fill';
  mpFill.style.cssText = 'height:100%;background:#33a';
  mpBar.appendChild(mpFill);
  hud.appendChild(mpBar);

  const pDefEl = document.createElement('div');
  pDefEl.dataset['role'] = 'pdef';
  hud.appendChild(pDefEl);

  document.body.appendChild(hud);
  updatePlayerVitalsHud({ level: 1, hp: 0, maxHp: 0, mp: 0, maxMp: 0 });
  return hud;
}

export function updatePlayerVitalsHud(state: PlayerVitalsHudState): void {
  const hud = mountPlayerVitalsHud();
  const levelEl = hud.querySelector('[data-role="level"]');
  const hpFill = hud.querySelector('[data-role="hp-fill"]') as HTMLElement | null;
  const mpFill = hud.querySelector('[data-role="mp-fill"]') as HTMLElement | null;
  const pDefEl = hud.querySelector('[data-role="pdef"]');

  if (levelEl) levelEl.textContent = `Lv.${state.level}`;
  if (hpFill) {
    const pct = state.maxHp > 0 ? (state.hp / state.maxHp) * 100 : 0;
    hpFill.style.width = `${pct}%`;
  }
  if (mpFill) {
    const pct = state.maxMp > 0 ? (state.mp / state.maxMp) * 100 : 0;
    mpFill.style.width = `${pct}%`;
  }
  if (pDefEl) {
    pDefEl.textContent = state.pDef != null && state.pDef > 0 ? `P.Def ${state.pDef}` : '';
  }
}
