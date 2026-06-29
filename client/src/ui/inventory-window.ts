import { createIconImg } from './icon-img';
import { HEALING_POTION_ITEM_ID } from '@nj/game-core';

export const SQUIRES_SWORD_ITEM_ID = 2369;

/** MVP weapon ids eligible for Equip — server validates ownership and type (AD-001). */
const WEAPON_ITEM_IDS = new Set<number>([SQUIRES_SWORD_ITEM_ID]);

/** MVP consumable ids with inventory Use action — server validates on useItem intent. */
const CONSUMABLE_ITEM_IDS = new Set<number>([HEALING_POTION_ITEM_ID]);
const SHOT_ITEM_IDS = new Set<number>([1835, 2509]);

const ITEM_DISPLAY_NAMES: Record<number, string> = {
  13: 'Short Bow',
  17: 'Wooden Arrow',
  57: 'Adena',
  112: "Apprentice's Earring",
  116: 'Magic Ring',
  118: 'Magic Necklace',
  426: 'Tunic',
  462: 'Stockings',
  1060: 'Healing Potion',
  1835: 'Soulshot (No-grade)',
  2509: 'Spiritshot (No-grade)',
  1786: 'Recipe: Broadsword',
  1788: 'Recipe: Bow',
  1864: 'Stem',
  1867: 'Animal Skin',
  1868: 'Thread',
  1871: 'Charcoal',
  2369: "Squire's Sword",
};

export interface InventorySendHandlers {
  sendEquip: (payload: { itemId: number }) => void;
  sendUseItem: (payload: { itemId: number }) => void;
  sendUseShot?: (payload: { itemId: number }) => void;
}

export interface InventoryRenderOptions {
  itemCounts: Record<number, number>;
  /** 0 = none (schema sentinel). */
  equippedWeaponItemId: number;
  healingPotionCooldownRemainingMs: number;
  visible: boolean;
  handlers: InventorySendHandlers;
}

const ELEMENT_ID = 'inventory-window';

export function mountInventoryWindow(): HTMLElement {
  const existing = document.getElementById(ELEMENT_ID);
  if (existing) return existing;

  const panel = document.createElement('div');
  panel.id = ELEMENT_ID;
  panel.hidden = true;
  panel.style.cssText = [
    'position:fixed',
    'top:50%',
    'right:24px',
    'transform:translateY(-50%)',
    'min-width:260px',
    'padding:16px',
    'background:rgba(16,14,24,0.92)',
    'color:#e8e0f0',
    'border:2px solid #6b5b95',
    'border-radius:6px',
    'z-index:20',
    'font:14px/1.4 system-ui,sans-serif',
  ].join(';');

  const title = document.createElement('h2');
  title.textContent = 'Inventory';
  title.style.margin = '0 0 8px';
  panel.appendChild(title);

  const equippedRow = document.createElement('div');
  equippedRow.dataset['role'] = 'equipped-row';
  equippedRow.hidden = true;
  const equippedLabel = document.createElement('span');
  equippedLabel.dataset['equippedWeapon'] = 'true';
  equippedRow.appendChild(equippedLabel);
  panel.appendChild(equippedRow);

  const list = document.createElement('div');
  list.dataset['role'] = 'item-list';
  panel.appendChild(list);

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.textContent = 'Close';
  closeBtn.dataset['action'] = 'close';
  closeBtn.style.marginTop = '12px';
  panel.appendChild(closeBtn);

  document.body.appendChild(panel);
  return panel;
}

export function itemDisplayName(itemId: number): string {
  return ITEM_DISPLAY_NAMES[itemId] ?? `Item ${itemId}`;
}

export function renderInventoryWindow(options: InventoryRenderOptions): void {
  const panel = mountInventoryWindow();
  panel.hidden = !options.visible;

  const equippedRow = panel.querySelector('[data-role="equipped-row"]');
  const equippedLabel = panel.querySelector('[data-equipped-weapon]');
  const isEquipped = options.equippedWeaponItemId === SQUIRES_SWORD_ITEM_ID;
  if (equippedRow instanceof HTMLElement) {
    equippedRow.hidden = !isEquipped;
  }
  if (equippedLabel) {
    equippedLabel.textContent = isEquipped
      ? `Equipped: ${itemDisplayName(SQUIRES_SWORD_ITEM_ID)}`
      : '';
  }

  const list = panel.querySelector('[data-role="item-list"]');
  if (!list) return;
  list.innerHTML = '';

  const itemIds = Object.keys(options.itemCounts)
    .map(Number)
    .filter((id) => (options.itemCounts[id] ?? 0) > 0)
    .sort((a, b) => a - b);

  for (const itemId of itemIds) {
    const count = options.itemCounts[itemId] ?? 0;
    const row = document.createElement('div');
    row.dataset['inventoryItemId'] = String(itemId);
    row.style.cssText = 'display:flex;align-items:center;gap:8px;margin:6px 0;';

    row.appendChild(
      createIconImg({
        kind: 'item',
        id: itemId,
        alt: itemDisplayName(itemId),
        sizePx: 32,
      })
    );

    const label = document.createElement('span');
    label.style.flex = '1';
    label.textContent = `${itemDisplayName(itemId)} × `;
    const countSpan = document.createElement('span');
    countSpan.dataset['count'] = 'true';
    countSpan.textContent = String(count);
    label.appendChild(countSpan);
    row.appendChild(label);

    if (WEAPON_ITEM_IDS.has(itemId)) {
      const equipBtn = document.createElement('button');
      equipBtn.type = 'button';
      equipBtn.dataset['action'] = 'equip';
      equipBtn.textContent = 'Equip';
      equipBtn.disabled = options.equippedWeaponItemId === itemId;
      equipBtn.addEventListener('click', () => {
        options.handlers.sendEquip({ itemId });
      });
      row.appendChild(equipBtn);
    }

    if (SHOT_ITEM_IDS.has(itemId)) {
      const shotBtn = document.createElement('button');
      shotBtn.type = 'button';
      shotBtn.dataset['action'] = 'use-shot';
      shotBtn.textContent = 'Use';
      shotBtn.addEventListener('click', () => {
        options.handlers.sendUseShot?.({ itemId });
      });
      row.appendChild(shotBtn);
    } else if (CONSUMABLE_ITEM_IDS.has(itemId)) {
      const useBtn = document.createElement('button');
      useBtn.type = 'button';
      useBtn.dataset['action'] = 'use';
      useBtn.textContent = 'Use';
      useBtn.disabled = options.healingPotionCooldownRemainingMs > 0;
      useBtn.addEventListener('click', () => {
        options.handlers.sendUseItem({ itemId });
      });
      row.appendChild(useBtn);
    }

    list.appendChild(row);
  }

  const closeBtn = panel.querySelector('[data-action="close"]');
  if (closeBtn && !closeBtn.hasAttribute('data-bound')) {
    closeBtn.setAttribute('data-bound', 'true');
    closeBtn.addEventListener('click', () => {
      panel.hidden = true;
      panel.dispatchEvent(new CustomEvent('inventory-close'));
    });
  }
}

export function setInventoryVisible(visible: boolean): void {
  const panel = mountInventoryWindow();
  panel.hidden = !visible;
}

export function isInventoryVisible(): boolean {
  const panel = document.getElementById(ELEMENT_ID);
  return panel !== null && !panel.hidden;
}
