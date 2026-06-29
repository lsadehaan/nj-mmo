import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  SQUIRES_SWORD_ITEM_ID,
  itemDisplayName,
  mountInventoryWindow,
  renderInventoryWindow,
} from './inventory-window';
import { FALLBACK_ICON } from './icon-manifest';
import { HEALING_POTION_ITEM_ID } from '@nj/game-core';

function defaultHandlers() {
  return { sendEquip: vi.fn(), sendUseItem: vi.fn() };
}

function defaultOptions(
  overrides: Partial<Parameters<typeof renderInventoryWindow>[0]> = {}
) {
  return {
    itemCounts: {},
    equippedWeaponItemId: 0,
    healingPotionCooldownRemainingMs: 0,
    visible: true,
    handlers: defaultHandlers(),
    ...overrides,
  };
}

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
    renderInventoryWindow(
      defaultOptions({ itemCounts: { 1060: 3, 2369: 1 }, handlers: defaultHandlers() })
    );

    const rows = document.querySelectorAll('#inventory-window [data-inventory-item-id]');
    expect(rows.length).toBe(2);

    const stacks = [...rows].map((row) => ({
      itemId: Number(row.getAttribute('data-inventory-item-id')),
      count: row.querySelector('[data-count]')?.textContent,
    }));
    expect(stacks).toContainEqual({ itemId: 1060, count: '3' });
    expect(stacks).toContainEqual({ itemId: 2369, count: '1' });
  });

  it('renders mapped item icons for Healing Potion and Squire\'s Sword rows', () => {
    mountInventoryWindow();
    renderInventoryWindow(
      defaultOptions({ itemCounts: { 1060: 1, 2369: 1 }, handlers: defaultHandlers() })
    );

    const potionImg = document.querySelector(
      '#inventory-window [data-inventory-item-id="1060"] img[data-icon-item-id="1060"]'
    ) as HTMLImageElement | null;
    const swordImg = document.querySelector(
      `#inventory-window [data-inventory-item-id="${SQUIRES_SWORD_ITEM_ID}"] img[data-icon-item-id="${SQUIRES_SWORD_ITEM_ID}"]`
    ) as HTMLImageElement | null;

    expect(potionImg?.src).toContain('healing-potion.png');
    expect(swordImg?.src).toContain('squires-sword.png');
  });

  it('returns L2J display names for Wooden Arrow and Soulshot', () => {
    expect(itemDisplayName(17)).toBe('Wooden Arrow');
    expect(itemDisplayName(1835)).toBe('Soulshot (No-grade)');
  });

  it('shows fallback icon for unmapped loot item ids', () => {
    mountInventoryWindow();
    renderInventoryWindow(defaultOptions({ itemCounts: { 99999: 2 } }));

    const img = document.querySelector(
      '#inventory-window [data-inventory-item-id="99999"] img[data-icon-item-id="99999"]'
    ) as HTMLImageElement | null;
    expect(img?.src).toContain(FALLBACK_ICON);
    expect(img?.dataset['iconFallback']).toBe('true');
    expect(img?.alt).toBe('Item 99999');
  });

  it('shows Equip action for Squire\'s Sword weapon row', () => {
    mountInventoryWindow();
    renderInventoryWindow(defaultOptions({ itemCounts: { 2369: 1 } }));

    const equipBtn = document.querySelector(
      `#inventory-window [data-inventory-item-id="${SQUIRES_SWORD_ITEM_ID}"] [data-action="equip"]`
    );
    expect(equipBtn).not.toBeNull();
    expect(equipBtn?.textContent).toMatch(/equip/i);
  });

  it('does not show Equip for consumable Healing Potion', () => {
    mountInventoryWindow();
    renderInventoryWindow(defaultOptions({ itemCounts: { 1060: 3 } }));

    const equipBtn = document.querySelector(
      '#inventory-window [data-inventory-item-id="1060"] [data-action="equip"]'
    );
    expect(equipBtn).toBeNull();
  });

  it('shows Magic Ring loot icon when item 116 is in inventory', () => {
    mountInventoryWindow();
    renderInventoryWindow(defaultOptions({ itemCounts: { 116: 1 } }));

    const img = document.querySelector(
      '#inventory-window [data-inventory-item-id="116"] img[data-icon-item-id="116"]'
    ) as HTMLImageElement | null;
    expect(img?.src).toContain('magic-ring');
    expect(img?.alt).toBe('Magic Ring');
  });

  it('shows equipped weapon label when Squire\'s Sword is equipped', () => {
    mountInventoryWindow();
    renderInventoryWindow(
      defaultOptions({
        itemCounts: { 2369: 1 },
        equippedWeaponItemId: SQUIRES_SWORD_ITEM_ID,
      })
    );

    const equipped = document.querySelector('#inventory-window [data-equipped-weapon]');
    expect(equipped?.textContent).toMatch(/Squire's Sword/i);
  });

  it('shows Use action for Healing Potion row when count > 0', () => {
    mountInventoryWindow();
    renderInventoryWindow(defaultOptions({ itemCounts: { [HEALING_POTION_ITEM_ID]: 2 } }));

    const useBtn = document.querySelector(
      `#inventory-window [data-inventory-item-id="${HEALING_POTION_ITEM_ID}"] [data-action="use"]`
    );
    expect(useBtn).not.toBeNull();
    expect(useBtn?.textContent).toMatch(/use/i);
  });

  it('does not show Use action for Squire\'s Sword weapon row', () => {
    mountInventoryWindow();
    renderInventoryWindow(defaultOptions({ itemCounts: { [SQUIRES_SWORD_ITEM_ID]: 1 } }));

    const useBtn = document.querySelector(
      `#inventory-window [data-inventory-item-id="${SQUIRES_SWORD_ITEM_ID}"] [data-action="use"]`
    );
    expect(useBtn).toBeNull();
  });

  it('calls sendUseItem when Use is clicked on Healing Potion', () => {
    mountInventoryWindow();
    const handlers = defaultHandlers();
    renderInventoryWindow(
      defaultOptions({ itemCounts: { [HEALING_POTION_ITEM_ID]: 1 }, handlers })
    );

    const useBtn = document.querySelector(
      `#inventory-window [data-inventory-item-id="${HEALING_POTION_ITEM_ID}"] [data-action="use"]`
    ) as HTMLButtonElement;
    useBtn.click();

    expect(handlers.sendUseItem).toHaveBeenCalledWith({ itemId: HEALING_POTION_ITEM_ID });
  });

  it('disables Use when healing potion cooldown is active', () => {
    mountInventoryWindow();
    renderInventoryWindow(
      defaultOptions({
        itemCounts: { [HEALING_POTION_ITEM_ID]: 1 },
        healingPotionCooldownRemainingMs: 5_000,
      })
    );

    const useBtn = document.querySelector(
      `#inventory-window [data-inventory-item-id="${HEALING_POTION_ITEM_ID}"] [data-action="use"]`
    ) as HTMLButtonElement;
    expect(useBtn.disabled).toBe(true);
  });
});
