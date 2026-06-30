export interface SystemMenuHandlers {
  onInventory?: () => void;
  onSkills?: () => void;
  onQuestLog?: () => void;
  onWorldMap?: () => void;
  onLogout?: () => void;
}

export function mountSystemMenu(handlers: SystemMenuHandlers): HTMLElement {
  const existing = document.getElementById('system-menu');
  if (existing) return existing;

  const menu = document.createElement('div');
  menu.id = 'system-menu';
  menu.hidden = true;
  menu.style.cssText =
    'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);padding:16px;background:rgba(0,0,0,0.85);color:#fff;border:1px solid #666;border-radius:8px;z-index:100;pointer-events:auto';

  const actions: { action: string; label: string; fn?: () => void }[] = [
    { action: 'inventory', label: 'Inventory', fn: handlers.onInventory },
    { action: 'skills', label: 'Skills', fn: handlers.onSkills },
    { action: 'quest-log', label: 'Quest Log', fn: handlers.onQuestLog },
    { action: 'world-map', label: 'World Map', fn: handlers.onWorldMap },
    { action: 'logout', label: 'Logout', fn: handlers.onLogout },
  ];

  for (const { action, label, fn } of actions) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset['action'] = action;
    btn.textContent = label;
    btn.style.display = 'block';
    btn.style.margin = '6px 0';
    btn.addEventListener('click', () => fn?.());
    menu.appendChild(btn);
  }

  const close = document.createElement('button');
  close.type = 'button';
  close.dataset['role'] = 'panel-close';
  close.textContent = 'Close';
  close.addEventListener('click', () => {
    menu.hidden = true;
  });
  menu.appendChild(close);

  document.body.appendChild(menu);
  return menu;
}
