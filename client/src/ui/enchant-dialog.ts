const ELEMENT_ID = 'enchant-dialog';
export const PINTER_NPC_ID = 30298;

export interface EnchantDialogHandlers {
  sendEnchant: (payload: { scrollItemId: number; slot: string }) => void;
}

export function mountEnchantDialog(): HTMLElement {
  const existing = document.getElementById(ELEMENT_ID);
  if (existing) return existing;
  const dialog = document.createElement('div');
  dialog.id = ELEMENT_ID;
  dialog.hidden = true;
  dialog.dataset['role'] = 'enchant-dialog';
  dialog.style.cssText =
    'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);padding:16px;background:#1a1528;color:#eee;border:2px solid #6b5b95;z-index:30';
  const title = document.createElement('div');
  title.dataset['role'] = 'title';
  title.textContent = 'Enchant (Pinter)';
  dialog.appendChild(title);
  const scrollSelect = document.createElement('select');
  scrollSelect.dataset['role'] = 'scroll-select';
  for (const [id, label] of [
    [955, 'Weapon Scroll D'],
    [956, 'Armor Scroll D'],
  ] as const) {
    const opt = document.createElement('option');
    opt.value = String(id);
    opt.textContent = label;
    scrollSelect.appendChild(opt);
  }
  dialog.appendChild(scrollSelect);
  const slotSelect = document.createElement('select');
  slotSelect.dataset['role'] = 'slot-select';
  for (const slot of ['rhand', 'chest', 'legs', 'head']) {
    const opt = document.createElement('option');
    opt.value = slot;
    opt.textContent = slot;
    slotSelect.appendChild(opt);
  }
  dialog.appendChild(slotSelect);
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.dataset['action'] = 'enchant';
  btn.textContent = 'Enchant';
  dialog.appendChild(btn);
  document.body.appendChild(dialog);
  return dialog;
}

export function renderEnchantDialog(
  visible: boolean,
  handlers: EnchantDialogHandlers
): void {
  const dialog = mountEnchantDialog();
  dialog.hidden = !visible;
  const btn = dialog.querySelector('[data-action="enchant"]') as HTMLButtonElement | null;
  const scrollSelect = dialog.querySelector('[data-role="scroll-select"]') as HTMLSelectElement | null;
  const slotSelect = dialog.querySelector('[data-role="slot-select"]') as HTMLSelectElement | null;
  if (btn && scrollSelect && slotSelect) {
    btn.onclick = () =>
      handlers.sendEnchant({
        scrollItemId: Number(scrollSelect.value),
        slot: slotSelect.value,
      });
  }
}
