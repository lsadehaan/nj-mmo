const ELEMENT_ID = 'pvp-toggle-panel';

export interface PvpToggleHandlers {
  togglePvp: () => void;
}

export function mountPvpToggle(): HTMLElement {
  const existing = document.getElementById(ELEMENT_ID);
  if (existing) return existing;
  const panel = document.createElement('div');
  panel.id = ELEMENT_ID;
  panel.style.cssText =
    'position:fixed;top:8px;right:8px;z-index:50;background:rgba(0,0,0,0.7);padding:8px';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.dataset['role'] = 'toggle';
  btn.textContent = 'PvP';
  panel.appendChild(btn);
  document.body.appendChild(panel);
  return panel;
}

export function wirePvpToggle(handlers: PvpToggleHandlers): void {
  const panel = mountPvpToggle();
  const btn = panel.querySelector('[data-role="toggle"]') as HTMLButtonElement;
  btn.onclick = () => handlers.togglePvp();
}
