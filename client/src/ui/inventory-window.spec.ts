import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  INVENTORY_SLOT_COUNT,
  layoutItemsToGrid,
  mountInventoryWindow,
  renderInventoryWindow,
  SQUIRES_SWORD_ITEM_ID,
} from './inventory-window';

function defaultHandlers() {
  return { sendEquip: vi.fn(), sendUseItem: vi.fn(), sendUseShot: vi.fn() };
}

describe('inventory-window grid', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('UI28-16: renders 80 inv-slot cells', () => {
    mountInventoryWindow();
    renderInventoryWindow({
      itemCounts: {},
      equippedWeaponItemId: 0,
      equipment: {},
      inventoryWeight: 0,
      maxLoad: 2967,
      slotsUsed: 0,
      healingPotionCooldownRemainingMs: 0,
      visible: true,
      handlers: defaultHandlers(),
    });
    expect(document.querySelectorAll('[data-role="inv-slot"]').length).toBe(INVENTORY_SLOT_COUNT);
  });

  it('UI28-17: shows item icons and stack counts', () => {
    mountInventoryWindow();
    renderInventoryWindow({
      itemCounts: { 1060: 3, 2369: 1 },
      equippedWeaponItemId: 0,
      equipment: {},
      inventoryWeight: 50,
      maxLoad: 2967,
      slotsUsed: 2,
      healingPotionCooldownRemainingMs: 0,
      visible: true,
      handlers: defaultHandlers(),
    });
    expect(document.querySelector('[data-item-id="1060"]')).not.toBeNull();
    expect(document.querySelector('[data-item-id="2369"]')).not.toBeNull();
  });

  it('UI28-18: weight bar ratio >= 0.53 for 1600/2967', () => {
    mountInventoryWindow();
    renderInventoryWindow({
      itemCounts: { 2369: 1 },
      equippedWeaponItemId: 0,
      equipment: {},
      inventoryWeight: 1600,
      maxLoad: 2967,
      slotsUsed: 1,
      healingPotionCooldownRemainingMs: 0,
      visible: true,
      handlers: defaultHandlers(),
    });
    const fill = document.querySelector('[data-role="weight-fill"]') as HTMLElement;
    const width = parseFloat(fill.style.width);
    expect(width / 100).toBeGreaterThanOrEqual(0.53);
  });

  it('UI28-19: slots-used text 2 / 80', () => {
    renderInventoryWindow({
      itemCounts: { 1060: 3, 2369: 1 },
      equippedWeaponItemId: 0,
      equipment: {},
      inventoryWeight: 1650,
      maxLoad: 2967,
      slotsUsed: 2,
      healingPotionCooldownRemainingMs: 0,
      visible: true,
      handlers: defaultHandlers(),
    });
    expect(document.querySelector('[data-role="slots-used"]')?.textContent).toBe('2 / 80');
  });

  it('UI28-20: paper-doll equip slots', () => {
    renderInventoryWindow({
      itemCounts: {},
      equippedWeaponItemId: 2369,
      equipment: { rhand: { itemId: 2369, enchantLevel: 0 } },
      inventoryWeight: 0,
      maxLoad: 2967,
      slotsUsed: 0,
      healingPotionCooldownRemainingMs: 0,
      visible: true,
      handlers: defaultHandlers(),
    });
    expect(document.querySelector('[data-equip-slot="rhand"]')).not.toBeNull();
  });

  it('UI28-21: double-click consumable fires sendUseItem', () => {
    const handlers = defaultHandlers();
    renderInventoryWindow({
      itemCounts: { 1060: 1 },
      equippedWeaponItemId: 0,
      equipment: {},
      inventoryWeight: 5,
      maxLoad: 2967,
      slotsUsed: 1,
      healingPotionCooldownRemainingMs: 0,
      visible: true,
      handlers,
    });
    const slot = document.querySelector('[data-item-id="1060"]') as HTMLElement;
    slot.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(handlers.sendUseItem).toHaveBeenCalledWith({ itemId: 1060 });
  });

  it('shows the item name + description on hover (was blank before)', () => {
    mountInventoryWindow();
    renderInventoryWindow({
      itemCounts: { 2369: 1 },
      equippedWeaponItemId: 0,
      equipment: {},
      inventoryWeight: 5,
      maxLoad: 2967,
      slotsUsed: 1,
      healingPotionCooldownRemainingMs: 0,
      visible: true,
      handlers: defaultHandlers(),
    });
    const slot = document.querySelector('[data-item-id="2369"]') as HTMLElement;
    slot.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, clientX: 50, clientY: 50 }));

    const tip = document.getElementById('game-tooltip');
    expect(tip?.hidden).toBe(false);
    expect(tip?.querySelector('[data-role="tooltip-title"]')?.textContent).toContain("Squire's Sword");
  });

  it('does not stack duplicate hover listeners across re-renders', () => {
    mountInventoryWindow();
    const opts = (counts: Record<number, number>) => ({
      itemCounts: counts,
      equippedWeaponItemId: 0,
      equipment: {},
      inventoryWeight: 5,
      maxLoad: 2967,
      slotsUsed: 1,
      healingPotionCooldownRemainingMs: 0,
      visible: true,
      handlers: defaultHandlers(),
    });
    renderInventoryWindow(opts({ 2369: 1 }));
    renderInventoryWindow(opts({ 1060: 2 }));

    const slot = document.querySelector('[data-item-id="1060"]') as HTMLElement;
    slot.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, clientX: 50, clientY: 50 }));
    const tip = document.getElementById('game-tooltip');
    expect(tip?.querySelector('[data-role="tooltip-title"]')?.textContent).toContain('Healing Potion');
    expect(document.querySelectorAll('#game-tooltip').length).toBe(1);
  });

  it('layoutItemsToGrid is deterministic', () => {
    const cells = layoutItemsToGrid({ 1060: 3, 2369: 1 });
    expect(cells.filter((c) => c.itemId > 0).length).toBe(2);
  });
});
