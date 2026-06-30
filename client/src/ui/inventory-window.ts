import { createIconImg } from './icon-img';
import { HEALING_POTION_ITEM_ID, EQUIP_SLOTS } from '@nj/game-core';
import { getItemInfo } from './game-catalog';
import { attachTooltip } from './tooltip';

export const SQUIRES_SWORD_ITEM_ID = 2369;
export const INVENTORY_GRID_COLS = 8;
export const INVENTORY_GRID_ROWS = 10;
export const INVENTORY_SLOT_COUNT = INVENTORY_GRID_COLS * INVENTORY_GRID_ROWS;

const EQUIPPABLE_ITEM_IDS = new Set<number>([
  SQUIRES_SWORD_ITEM_ID,
  3, 13, 23, 28, 43, 112, 116, 118, 2386, 58, 59, 47,
]);
const CONSUMABLE_ITEM_IDS = new Set<number>([HEALING_POTION_ITEM_ID]);

export interface GridCell {
  itemId: number;
  count: number;
}

export function layoutItemsToGrid(itemCounts: Record<number, number>): GridCell[] {
  const cells: GridCell[] = Array.from({ length: INVENTORY_SLOT_COUNT }, () => ({
    itemId: 0,
    count: 0,
  }));
  const ids = Object.keys(itemCounts)
    .map(Number)
    .filter((id) => (itemCounts[id] ?? 0) > 0)
    .sort((a, b) => a - b);

  let slot = 0;
  for (const itemId of ids) {
    let remaining = itemCounts[itemId] ?? 0;
    while (remaining > 0 && slot < INVENTORY_SLOT_COUNT) {
      cells[slot] = { itemId, count: remaining };
      remaining = 0;
      slot++;
    }
  }
  return cells;
}

export interface InventorySendHandlers {
  sendEquip: (payload: { itemId: number }) => void;
  sendUseItem: (payload: { itemId: number }) => void;
  sendUseShot?: (payload: { itemId: number }) => void;
}

export interface InventoryRenderOptions {
  itemCounts: Record<number, number>;
  equippedWeaponItemId: number;
  equipment: Record<string, { itemId: number; enchantLevel: number }>;
  inventoryWeight: number;
  maxLoad: number;
  slotsUsed: number;
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
  panel.style.cssText =
    'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);padding:16px;background:rgba(16,14,24,0.92);color:#e8e0f0;border:2px solid #6b5b95;border-radius:6px;z-index:25;pointer-events:auto';

  const title = document.createElement('h2');
  title.textContent = 'Inventory';
  panel.appendChild(title);

  const doll = document.createElement('div');
  doll.dataset['role'] = 'paper-doll';
  panel.appendChild(doll);

  const weightRow = document.createElement('div');
  weightRow.dataset['role'] = 'weight-row';
  const weightBar = document.createElement('div');
  weightBar.dataset['role'] = 'weight-bar';
  weightBar.style.cssText = 'height:8px;background:#333;border-radius:4px;overflow:hidden';
  const weightFill = document.createElement('div');
  weightFill.dataset['role'] = 'weight-fill';
  weightFill.style.height = '100%';
  weightFill.style.background = '#5a8';
  weightBar.appendChild(weightFill);
  weightRow.appendChild(weightBar);
  panel.appendChild(weightRow);

  const slotsRow = document.createElement('div');
  slotsRow.dataset['role'] = 'slots-used';
  panel.appendChild(slotsRow);

  const adenaRow = document.createElement('div');
  adenaRow.dataset['role'] = 'adena-row';
  panel.appendChild(adenaRow);

  const grid = document.createElement('div');
  grid.dataset['role'] = 'inv-grid';
  grid.style.cssText = `display:grid;grid-template-columns:repeat(${INVENTORY_GRID_COLS},32px);gap:2px`;
  for (let i = 0; i < INVENTORY_SLOT_COUNT; i++) {
    const slot = document.createElement('div');
    slot.dataset['role'] = 'inv-slot';
    slot.style.cssText = 'width:32px;height:32px;border:1px solid #444;background:rgba(0,0,0,0.3)';
    // Slots persist across renders, so attach once with a live getter that reads
    // the slot's current item id (set in renderInventoryWindow).
    attachTooltip(slot, () => {
      const itemId = Number(slot.dataset['itemId'] ?? 0);
      if (!itemId) return null;
      const info = getItemInfo(itemId);
      const count = Number(slot.dataset['count'] ?? 0);
      return { title: count > 1 ? `${info.name} x${count}` : info.name, body: info.description };
    });
    grid.appendChild(slot);
  }
  panel.appendChild(grid);

  document.body.appendChild(panel);
  return panel;
}

export function itemDisplayName(itemId: number): string {
  return getItemInfo(itemId).name;
}

export function renderInventoryWindow(options: InventoryRenderOptions): void {
  const panel = mountInventoryWindow();
  panel.hidden = !options.visible;

  const ratio =
    options.maxLoad > 0 ? options.inventoryWeight / options.maxLoad : 0;
  const weightBar = panel.querySelector('[data-role="weight-bar"]') as HTMLElement | null;
  const weightFill = panel.querySelector('[data-role="weight-fill"]') as HTMLElement | null;
  if (weightFill) {
    weightFill.style.width = `${Math.min(1, ratio) * 100}%`;
    weightFill.style.background = ratio > 1 ? '#c44' : '#5a8';
  }
  if (weightBar) {
    weightBar.dataset['overweight'] = ratio > 1 ? 'true' : 'false';
  }

  const slotsEl = panel.querySelector('[data-role="slots-used"]');
  if (slotsEl) slotsEl.textContent = `${options.slotsUsed} / ${INVENTORY_SLOT_COUNT}`;

  const doll = panel.querySelector('[data-role="paper-doll"]');
  if (doll) {
    doll.innerHTML = '';
    for (const slot of EQUIP_SLOTS) {
      const eq = options.equipment[slot];
      if (!eq?.itemId) continue;
      const cell = document.createElement('div');
      cell.dataset['equipSlot'] = slot;
      cell.appendChild(
        createIconImg({ kind: 'item', id: eq.itemId, alt: itemDisplayName(eq.itemId), sizePx: 24 })
      );
      const eqInfo = getItemInfo(eq.itemId);
      attachTooltip(cell, {
        title: eq.enchantLevel > 0 ? `+${eq.enchantLevel} ${eqInfo.name}` : eqInfo.name,
        body: `Equipped (${slot})\n${eqInfo.description}`,
      });
      doll.appendChild(cell);
    }
  }

  const cells = layoutItemsToGrid(options.itemCounts);
  const slots = panel.querySelectorAll('[data-role="inv-slot"]');
  slots.forEach((slotEl, index) => {
    const cell = cells[index]!;
    const slot = slotEl as HTMLElement;
    slot.innerHTML = '';
    slot.removeAttribute('data-item-id');
    slot.removeAttribute('data-count');
    if (cell.itemId > 0) {
      slot.dataset['itemId'] = String(cell.itemId);
      slot.appendChild(
        createIconImg({
          kind: 'item',
          id: cell.itemId,
          alt: itemDisplayName(cell.itemId),
          sizePx: 28,
        })
      );
      slot.dataset['count'] = String(cell.count);
      if (cell.count > 1) {
        const count = document.createElement('span');
        count.dataset['count'] = 'true';
        count.textContent = String(cell.count);
        count.style.cssText = 'position:absolute;bottom:0;right:2px;font-size:10px';
        slot.style.position = 'relative';
        slot.appendChild(count);
      }
      if (CONSUMABLE_ITEM_IDS.has(cell.itemId)) {
        slot.addEventListener('dblclick', () => {
          options.handlers.sendUseItem({ itemId: cell.itemId });
        });
      }
      if (EQUIPPABLE_ITEM_IDS.has(cell.itemId)) {
        slot.addEventListener('dblclick', () => {
          options.handlers.sendEquip({ itemId: cell.itemId });
        });
      }
    }
  });
}

export function setInventoryVisible(visible: boolean): void {
  const panel = mountInventoryWindow();
  panel.hidden = !visible;
}

export function isInventoryVisible(): boolean {
  const panel = document.getElementById(ELEMENT_ID);
  return panel !== null && !panel.hidden;
}
