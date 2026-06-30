import { getGameState } from '../test-hook';
import { itemDisplayName } from './inventory-window';

const ELEMENT_ID = 'equipment-panel';

export function mountEquipmentPanel(): HTMLElement {
  const existing = document.getElementById(ELEMENT_ID);
  if (existing) return existing;
  const panel = document.createElement('div');
  panel.id = ELEMENT_ID;
  panel.dataset['role'] = 'equipment-panel';
  panel.hidden = true;
  panel.style.cssText =
    'position:fixed;top:120px;right:24px;min-width:200px;padding:12px;background:rgba(16,14,24,0.92);color:#e8e0f0;border:2px solid #6b5b95;border-radius:6px;z-index:19;font:13px system-ui,sans-serif';
  document.body.appendChild(panel);
  return panel;
}

export function renderEquipmentPanel(): void {
  const panel = mountEquipmentPanel();
  const equipment = getGameState().equipment;
  const slots = Object.entries(equipment);
  panel.hidden = slots.length === 0;
  panel.innerHTML = '<strong>Equipment</strong>';
  for (const [slot, row] of slots) {
    const line = document.createElement('div');
    line.dataset['equipSlot'] = slot;
    line.dataset['equipItemId'] = String(row.itemId);
    line.textContent = `${slot}: ${itemDisplayName(row.itemId)}${row.enchantLevel > 0 ? ` +${row.enchantLevel}` : ''}`;
    panel.appendChild(line);
  }
}
