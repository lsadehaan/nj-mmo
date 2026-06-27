export const ROXXY_NPC_ID = 30006;

export interface NpcDialogHandlers {
  sendNpcAction: (payload: { npcId: number; action: 'heal' | 'starterKit' }) => void;
}

export interface NpcDialogRenderOptions {
  npcId: number;
  name: string;
  visible: boolean;
  handlers: NpcDialogHandlers;
}

const ELEMENT_ID = 'npc-dialog';

export function mountNpcDialog(): HTMLElement {
  const existing = document.getElementById(ELEMENT_ID);
  if (existing) return existing;

  const panel = document.createElement('div');
  panel.id = ELEMENT_ID;
  panel.hidden = true;
  panel.style.cssText = [
    'position:fixed',
    'top:50%',
    'left:50%',
    'transform:translate(-50%,-50%)',
    'min-width:260px',
    'padding:16px',
    'background:rgba(12,28,18,0.94)',
    'color:#e8f5e9',
    'border:2px solid #4caf50',
    'border-radius:6px',
    'z-index:20',
    'font:14px/1.4 system-ui,sans-serif',
  ].join(';');

  const title = document.createElement('h2');
  title.dataset['role'] = 'title';
  title.style.margin = '0 0 12px';
  panel.appendChild(title);

  const actions = document.createElement('div');
  actions.dataset['role'] = 'actions';
  panel.appendChild(actions);

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.textContent = 'Close';
  closeBtn.dataset['action'] = 'close';
  closeBtn.style.marginTop = '12px';
  panel.appendChild(closeBtn);

  document.body.appendChild(panel);
  return panel;
}

export function renderNpcDialog(options: NpcDialogRenderOptions): void {
  const panel = mountNpcDialog();
  panel.hidden = !options.visible;

  const title = panel.querySelector('[data-role="title"]');
  if (title) title.textContent = `${options.name} — Newbie Helper`;

  const actions = panel.querySelector('[data-role="actions"]');
  if (!actions) return;
  actions.innerHTML = '';

  const healBtn = document.createElement('button');
  healBtn.type = 'button';
  healBtn.dataset['action'] = 'heal';
  healBtn.textContent = 'Heal';
  healBtn.style.display = 'block';
  healBtn.style.marginBottom = '8px';
  healBtn.addEventListener('click', () => {
    options.handlers.sendNpcAction({ npcId: options.npcId, action: 'heal' });
  });
  actions.appendChild(healBtn);

  const kitBtn = document.createElement('button');
  kitBtn.type = 'button';
  kitBtn.dataset['action'] = 'starterKit';
  kitBtn.textContent = 'Starter Kit';
  kitBtn.style.display = 'block';
  kitBtn.addEventListener('click', () => {
    options.handlers.sendNpcAction({ npcId: options.npcId, action: 'starterKit' });
  });
  actions.appendChild(kitBtn);

  const closeBtn = panel.querySelector('[data-action="close"]');
  if (closeBtn && !closeBtn.hasAttribute('data-bound')) {
    closeBtn.setAttribute('data-bound', 'true');
    closeBtn.addEventListener('click', () => {
      panel.hidden = true;
      panel.dispatchEvent(new CustomEvent('npc-dialog-close'));
    });
  }
}

export function setNpcDialogVisible(visible: boolean): void {
  const panel = mountNpcDialog();
  panel.hidden = !visible;
}

export function isNpcDialogVisible(): boolean {
  const panel = document.getElementById(ELEMENT_ID);
  return panel !== null && !panel.hidden;
}
