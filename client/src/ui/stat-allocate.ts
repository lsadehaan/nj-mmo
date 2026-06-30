import { attachToRightRail, RIGHT_RAIL_ORDER } from './hud-rail';

const ELEMENT_ID = 'stat-allocate-panel';

export interface StatAllocateHandlers {
  allocateStat: (stat: string) => void;
  resetStats: () => void;
}

export function mountStatAllocate(): HTMLElement {
  const existing = document.getElementById(ELEMENT_ID);
  if (existing) return existing;
  const panel = document.createElement('div');
  panel.id = ELEMENT_ID;
  panel.style.cssText =
    'background:rgba(0,0,0,0.7);padding:8px;border-radius:4px;' +
    'display:grid;grid-template-columns:repeat(3,1fr);gap:4px';
  for (const stat of ['str', 'dex', 'con', 'int', 'wit', 'men']) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset['stat'] = stat;
    btn.textContent = `+${stat.toUpperCase()}`;
    panel.appendChild(btn);
  }
  const reset = document.createElement('button');
  reset.type = 'button';
  reset.dataset['role'] = 'reset';
  reset.textContent = 'Reset stats';
  reset.style.gridColumn = '1 / -1';
  panel.appendChild(reset);
  attachToRightRail(panel, RIGHT_RAIL_ORDER.stats);
  return panel;
}

export function wireStatAllocate(handlers: StatAllocateHandlers): void {
  const panel = mountStatAllocate();
  for (const btn of panel.querySelectorAll('[data-stat]')) {
    const stat = (btn as HTMLElement).dataset['stat']!;
    (btn as HTMLButtonElement).onclick = () => handlers.allocateStat(stat);
  }
  const reset = panel.querySelector('[data-role="reset"]') as HTMLButtonElement;
  reset.onclick = () => handlers.resetStats();
}
