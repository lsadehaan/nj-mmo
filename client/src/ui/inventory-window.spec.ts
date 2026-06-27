import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  SQUIRES_SWORD_ITEM_ID,
  mountInventoryWindow,
  renderInventoryWindow,
} from './inventory-window';

describe('inventory-window DOM', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('mounts #inventory-window panel hidden by default', () => {
    const panel = mountInventoryWindow();
    expect(panel.id).toBe('inventory-window');
    expect(panel.hidden).toBe(true);
  });

  it('lists owned item stacks with counts from server-synced state', () => {
    mountInventoryWindow();
    renderInventoryWindow({
      itemCounts: { 1060: 3, 2369: 1 },
      equippedWeaponItemId: 0,
      visible: true,
      handlers: { sendEquip: vi.fn() },
    });

    const rows = document.querySelectorAll('#inventory-window [data-inventory-item-id]');
    expect(rows.length).toBe(2);

    const stacks = [...rows].map((row) => ({
      itemId: Number(row.getAttribute('data-inventory-item-id')),
      count: row.querySelector('[data-count]')?.textContent,
    }));
    expect(stacks).toContainEqual({ itemId: 1060, count: '3' });
    expect(stacks).toContainEqual({ itemId: 2369, count: '1' });
  });

  it('shows Equip action for Squire\'s Sword weapon row', () => {
    mountInventoryWindow();
    renderInventoryWindow({
      itemCounts: { 2369: 1 },
      equippedWeaponItemId: 0,
      visible: true,
      handlers: { sendEquip: vi.fn() },
    });

    const equipBtn = document.querySelector(
      `#inventory-window [data-inventory-item-id="${SQUIRES_SWORD_ITEM_ID}"] [data-action="equip"]`
    );
    expect(equipBtn).not.toBeNull();
    expect(equipBtn?.textContent).toMatch(/equip/i);
  });

  it('does not show Equip for consumable Healing Potion', () => {
    mountInventoryWindow();
    renderInventoryWindow({
      itemCounts: { 1060: 3 },
      equippedWeaponItemId: 0,
      visible: true,
      handlers: { sendEquip: vi.fn() },
    });

    const equipBtn = document.querySelector(
      '#inventory-window [data-inventory-item-id="1060"] [data-action="equip"]'
    );
    expect(equipBtn).toBeNull();
  });

  it('shows equipped weapon label when Squire\'s Sword is equipped', () => {
    mountInventoryWindow();
    renderInventoryWindow({
      itemCounts: { 2369: 1 },
      equippedWeaponItemId: SQUIRES_SWORD_ITEM_ID,
      visible: true,
      handlers: { sendEquip: vi.fn() },
    });

    const equipped = document.querySelector('#inventory-window [data-equipped-weapon]');
    expect(equipped?.textContent).toMatch(/Squire's Sword/i);
  });
});
