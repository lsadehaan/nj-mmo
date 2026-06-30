import { getGameState } from '../test-hook';

const ELEMENT_ID = 'craft-dialog';
const RECIPE_BROADSWORD = 1786;

export interface CraftDialogHandlers {
  sendCraft: (payload: { recipeId: number }) => void;
}

export function mountCraftDialog(): HTMLElement {
  const existing = document.getElementById(ELEMENT_ID);
  if (existing) return existing;
  const dialog = document.createElement('div');
  dialog.id = ELEMENT_ID;
  dialog.hidden = true;
  dialog.dataset['role'] = 'craft-dialog';
  dialog.style.cssText =
    'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);padding:16px;background:#1a1528;color:#eee;border:2px solid #6b5b95;z-index:30';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.dataset['action'] = 'craft';
  btn.textContent = 'Craft Broadsword';
  dialog.appendChild(btn);
  document.body.appendChild(dialog);
  return dialog;
}

export function renderCraftDialog(handlers: CraftDialogHandlers): void {
  const dialog = mountCraftDialog();
  const items = getGameState().items;
  const canCraft = (items[RECIPE_BROADSWORD] ?? 0) > 0;
  dialog.hidden = !canCraft;
  const btn = dialog.querySelector('[data-action="craft"]') as HTMLButtonElement | null;
  if (btn) {
    btn.disabled = !canCraft;
    btn.onclick = () => handlers.sendCraft({ recipeId: 2 });
  }
}
