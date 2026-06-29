export const ROXXY_NPC_ID = 30006;
export const WILFORD_NPC_ID = 30005;
export const BITZ_NPC_ID = 30026;
export const GWINTER_NPC_ID = 30027;
export const BAULRO_NPC_ID = 30033;

export type NpcDialogVariant = 'helper' | 'warehouse' | 'trainer' | 'folkTrainer' | 'quest';

export interface QuestDialogButton {
  action: string;
  label: string;
}

export interface NpcDialogHandlers {
  sendNpcAction: (payload: { npcId: number; action: 'heal' | 'starterKit' }) => void;
  sendLearnSkill?: (payload: { skillId: number }) => void;
  sendQuestAction?: (payload: { npcId: number; action: string }) => void;
}

export interface NpcDialogRenderOptions {
  npcId: number;
  name: string;
  variant: NpcDialogVariant;
  visible: boolean;
  learnableSkillIds?: number[];
  questBody?: string;
  questButtons?: QuestDialogButton[];
  handlers: NpcDialogHandlers;
}

const ELEMENT_ID = 'npc-dialog';

const VARIANT_TITLES: Record<NpcDialogVariant, string> = {
  helper: 'Newbie Helper',
  warehouse: 'Warehouse Keeper',
  trainer: 'Grand Master',
  folkTrainer: 'Folk Trainer',
  quest: 'Quest',
};

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

function appendActionButton(
  actions: Element,
  label: string,
  actionKey: string,
  options: { disabled?: boolean; disabledLabel?: string; onClick?: () => void }
): void {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.dataset['action'] = actionKey;
  btn.textContent = options.disabled ? `${label} (${options.disabledLabel ?? 'Coming soon'})` : label;
  btn.style.display = 'block';
  btn.style.marginBottom = '8px';
  if (options.disabled) {
    btn.disabled = true;
  } else if (options.onClick) {
    btn.addEventListener('click', options.onClick);
  }
  actions.appendChild(btn);
}

export function renderNpcDialog(options: NpcDialogRenderOptions): void {
  const panel = mountNpcDialog();
  panel.hidden = !options.visible;

  const title = panel.querySelector('[data-role="title"]');
  if (title) {
    title.textContent = `${options.name} — ${VARIANT_TITLES[options.variant]}`;
  }

  const actions = panel.querySelector('[data-role="actions"]');
  if (!actions) return;
  actions.innerHTML = '';

  if (options.variant === 'quest') {
    const body = document.createElement('p');
    body.dataset['role'] = 'quest-body';
    body.textContent = options.questBody ?? '';
    body.style.margin = '0 0 12px';
    actions.appendChild(body);
    for (const btn of options.questButtons ?? []) {
      appendActionButton(actions, btn.label, btn.action, {
        onClick: () =>
          options.handlers.sendQuestAction?.({ npcId: options.npcId, action: btn.action }),
      });
    }
  } else if (options.variant === 'helper') {
    appendActionButton(actions, 'Heal', 'heal', {
      onClick: () => {
        options.handlers.sendNpcAction({ npcId: options.npcId, action: 'heal' });
      },
    });
    appendActionButton(actions, 'Starter Kit', 'starterKit', {
      onClick: () => {
        options.handlers.sendNpcAction({ npcId: options.npcId, action: 'starterKit' });
      },
    });
  } else if (options.variant === 'warehouse') {
    appendActionButton(actions, 'Deposit', 'deposit', {
      disabled: true,
      disabledLabel: 'Coming soon',
    });
    appendActionButton(actions, 'Withdraw', 'withdraw', {
      disabled: true,
      disabledLabel: 'Coming soon',
    });
  } else if (options.variant === 'trainer' || options.variant === 'folkTrainer') {
    const learnable = options.learnableSkillIds ?? [];
    if (learnable.length === 0) {
      appendActionButton(actions, 'No skills to learn', 'none', { disabled: true });
    } else {
      for (const skillId of learnable) {
        appendActionButton(actions, `Learn skill ${skillId}`, `learn-${skillId}`, {
          onClick: () => options.handlers.sendLearnSkill?.({ skillId }),
        });
      }
    }
  }

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

export function resolveNpcDialogVariant(
  npcId: number,
  type: string
): NpcDialogVariant | null {
  if (type === 'Warehouse' || npcId === WILFORD_NPC_ID) return 'warehouse';
  if (type === 'VillageMasterFighter' || npcId === BITZ_NPC_ID) return 'trainer';
  if (type === 'Folk' || npcId === GWINTER_NPC_ID || npcId === BAULRO_NPC_ID) {
    return 'folkTrainer';
  }
  if (type === 'Teleporter' || npcId === ROXXY_NPC_ID) return 'helper';
  return null;
}
