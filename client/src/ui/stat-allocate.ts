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
    'position:fixed;top:48px;right:8px;z-index:50;background:rgba(0,0,0,0.7);padding:8px';
  for (const stat of ['str', 'dex', 'con', 'int', 'wit', 'men']) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset['stat'] = stat;
    btn.textContent = `+${stat.toUpperCase()}`;
    btn.style.display = 'block';
    btn.style.marginBottom = '4px';
    panel.appendChild(btn);
  }
  const reset = document.createElement('button');
  reset.type = 'button';
  reset.dataset['role'] = 'reset';
  reset.textContent = 'Reset stats';
  panel.appendChild(reset);
  document.body.appendChild(panel);
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
