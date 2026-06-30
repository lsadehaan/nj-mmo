export const ROXXY_NPC_ID = 30006;
export const WILFORD_NPC_ID = 30005;
export const BITZ_NPC_ID = 30026;
export const BIOTIN_NPC_ID = 30031;
export const GWINTER_NPC_ID = 30027;
export const BAULRO_NPC_ID = 30033;

export type NpcDialogVariant =
  | 'helper'
  | 'gatekeeper'
  | 'warehouse'
  | 'trainer'
  | 'folkTrainer'
  | 'priest'
  | 'quest';

export interface TeleportDestinationButton {
  destinationId: string;
  label: string;
  feeAdena: number;
}

export interface ClassTransferOption {
  targetClassId: number;
  label: string;
}

export interface QuestDialogButton {
  action: string;
  label: string;
}

export type NpcAction =
  | 'heal'
  | 'starterKit'
  | 'resurrect'
  | 'bless'
  | 'restoreExp';

export interface NpcDialogHandlers {
  sendNpcAction: (payload: { npcId: number; action: NpcAction }) => void;
  sendLearnSkill?: (payload: { skillId: number }) => void;
  sendResetStats?: () => void;
  sendQuestAction?: (payload: { npcId: number; action: string }) => void;
  sendTeleport?: (payload: { destinationId: string }) => void;
  sendClassTransfer?: (payload: { targetClassId: number }) => void;
  openWarehouse?: () => void;
}

export interface NpcDialogRenderOptions {
  npcId: number;
  name: string;
  variant: NpcDialogVariant;
  visible: boolean;
  learnableSkillIds?: number[];
  teleportDestinations?: TeleportDestinationButton[];
  classTransferOptions?: ClassTransferOption[];
  questBody?: string;
  questButtons?: QuestDialogButton[];
  handlers: NpcDialogHandlers;
}

/** Roxxy TI teleport list (fees mirror server seed). */
export const ROXXY_TELEPORT_DESTINATIONS: TeleportDestinationButton[] = [
  { destinationId: 'obelisk', label: 'Obelisk of Victory', feeAdena: 200 },
  { destinationId: 'northern_ti', label: 'Northern Territory of TI', feeAdena: 450 },
  { destinationId: 'southern_ti', label: 'Southern Territory of TI', feeAdena: 140 },
  { destinationId: 'elven_ruins', label: 'Elven Ruins', feeAdena: 590 },
  { destinationId: 'singing_waterfall', label: 'Singing Waterfall', feeAdena: 330 },
];

export const FIGHTER_CLASS_TRANSFER_OPTIONS: ClassTransferOption[] = [
  { targetClassId: 1, label: 'Warrior' },
  { targetClassId: 4, label: 'Knight' },
  { targetClassId: 7, label: 'Rogue' },
];

export const MYSTIC_CLASS_TRANSFER_OPTIONS: ClassTransferOption[] = [
  { targetClassId: 11, label: 'Wizard' },
  { targetClassId: 15, label: 'Cleric' },
];

const ELEMENT_ID = 'npc-dialog';

const VARIANT_TITLES: Record<NpcDialogVariant, string> = {
  helper: 'Newbie Helper',
  gatekeeper: 'Gatekeeper',
  warehouse: 'Warehouse Keeper',
  trainer: 'Grand Master',
  folkTrainer: 'Folk Trainer',
  priest: 'High Priest',
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
  } else if (options.variant === 'helper' || options.variant === 'gatekeeper') {
    if (options.variant === 'gatekeeper') {
      for (const dest of options.teleportDestinations ?? ROXXY_TELEPORT_DESTINATIONS) {
        appendActionButton(actions, `${dest.label} (${dest.feeAdena} adena)`, dest.destinationId, {
          onClick: () => options.handlers.sendTeleport?.({ destinationId: dest.destinationId }),
        });
      }
    }
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
      onClick: () => options.handlers.openWarehouse?.(),
    });
    appendActionButton(actions, 'Withdraw', 'withdraw', {
      onClick: () => options.handlers.openWarehouse?.(),
    });
  } else if (options.variant === 'priest') {
    appendActionButton(actions, 'Resurrect', 'resurrect', {
      onClick: () =>
        options.handlers.sendNpcAction({ npcId: options.npcId, action: 'resurrect' }),
    });
    appendActionButton(actions, 'Heal', 'heal', {
      onClick: () => options.handlers.sendNpcAction({ npcId: options.npcId, action: 'heal' }),
    });
    appendActionButton(actions, 'Bless', 'bless', {
      onClick: () => options.handlers.sendNpcAction({ npcId: options.npcId, action: 'bless' }),
    });
    appendActionButton(actions, 'Restore XP', 'restoreExp', {
      onClick: () =>
        options.handlers.sendNpcAction({ npcId: options.npcId, action: 'restoreExp' }),
    });
    for (const opt of options.classTransferOptions ?? []) {
      appendActionButton(actions, `Change Class: ${opt.label}`, `class-${opt.targetClassId}`, {
        onClick: () => options.handlers.sendClassTransfer?.({ targetClassId: opt.targetClassId }),
      });
    }
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
    for (const opt of options.classTransferOptions ?? []) {
      appendActionButton(actions, `Change Class: ${opt.label}`, `class-${opt.targetClassId}`, {
        onClick: () => options.handlers.sendClassTransfer?.({ targetClassId: opt.targetClassId }),
      });
    }
    appendActionButton(actions, 'Reset stats', 'resetStats', {
      onClick: () => options.handlers.sendResetStats?.(),
    });
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
  if (type === 'Guard') return null;
  if (type === 'Warehouse' || npcId === WILFORD_NPC_ID) return 'warehouse';
  if (type === 'VillageMasterFighter' || npcId === BITZ_NPC_ID) return 'trainer';
  if (type === 'VillageMasterPriest' || npcId === BIOTIN_NPC_ID) return 'priest';
  if (type === 'Folk') return 'folkTrainer';
  if (type === 'Teleporter' || npcId === ROXXY_NPC_ID) return 'gatekeeper';
  return null;
}
