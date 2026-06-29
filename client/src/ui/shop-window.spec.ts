import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  KATERINA_NPC_ID,
  LECTOR_NPC_ID,
  JACKSON_NPC_ID,
  SILVIA_NPC_ID,
  KATERINA_SHOP_ITEMS,
  LECTOR_SHOP_ITEMS,
  JACKSON_SHOP_ITEMS,
  SILVIA_SHOP_ITEMS,
  createShopRowIcon,
  mountShopWindow,
  renderShopWindow,
} from './shop-window';
import { FALLBACK_ICON } from './icon-manifest';

const defaultHandlers = { sendBuy: vi.fn(), sendSell: vi.fn() };

function renderKaterinaShop(overrides: Partial<Parameters<typeof renderShopWindow>[0]> = {}) {
  renderShopWindow({
    npcId: KATERINA_NPC_ID,
    merchantName: 'Katerina',
    adena: 1000,
    itemCounts: {},
    visible: true,
    handlers: defaultHandlers,
    ...overrides,
  });
}

describe('shop-window DOM', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('lists Healing Potion, Soulshot, and Wooden Arrow with buy prices 103, 8, 2', () => {
    mountShopWindow();
    renderKaterinaShop();

    const shop = document.getElementById('shop-window');
    expect(shop).not.toBeNull();
    expect(shop?.hidden).toBe(false);

    const rows = shop?.querySelectorAll('[data-shop-item-id]');
    expect(rows?.length).toBe(3);

    const prices = [...(rows ?? [])].map((row) => ({
      itemId: Number(row.getAttribute('data-shop-item-id')),
      buyPrice: Number(row.querySelector('[data-buy-price]')?.textContent),
    }));
    expect(prices).toEqual([
      { itemId: 1060, buyPrice: 103 },
      { itemId: 1835, buyPrice: 8 },
      { itemId: 17, buyPrice: 2 },
    ]);
  });

  it('lists Jackson armor subset buy prices 169, 105, 8 (TINPC-24)', () => {
    mountShopWindow();
    renderShopWindow({
      npcId: JACKSON_NPC_ID,
      merchantName: 'Jackson',
      adena: 1000,
      itemCounts: {},
      visible: true,
      handlers: defaultHandlers,
    });

    const prices = [...document.querySelectorAll('#shop-window [data-shop-item-id]')].map((row) =>
      Number(row.querySelector('[data-buy-price]')?.textContent)
    );
    expect(prices).toEqual([169, 105, 8]);
    expect(document.querySelector('#shop-window [data-role="title"]')?.textContent).toBe(
      'Jackson — Shop'
    );
  });

  it('lists Silvia accessory subset buy prices 37, 56, 75 (TINPC-25)', () => {
    mountShopWindow();
    renderShopWindow({
      npcId: SILVIA_NPC_ID,
      merchantName: 'Silvia',
      adena: 1000,
      itemCounts: {},
      visible: true,
      handlers: defaultHandlers,
    });

    const prices = [...document.querySelectorAll('#shop-window [data-shop-item-id]')].map((row) =>
      Number(row.querySelector('[data-buy-price]')?.textContent)
    );
    expect(prices).toEqual([37, 56, 75]);
  });

  it('renders item icons for catalog rows 1060, 1835, and 17', () => {
    mountShopWindow();
    renderKaterinaShop();

    for (const item of KATERINA_SHOP_ITEMS) {
      const row = document.querySelector(`[data-shop-item-id="${item.itemId}"]`);
      const img = row?.querySelector(`img[data-icon-item-id="${item.itemId}"]`) as
        | HTMLImageElement
        | null;
      expect(img).not.toBeNull();
      expect(img?.dataset['iconFallback']).toBeUndefined();
      expect(img?.src).not.toContain(FALLBACK_ICON);
      expect(img?.alt).toBe(item.name);
    }
  });

  it('renders Adena icon beside adena amount', () => {
    mountShopWindow();
    renderKaterinaShop({ adena: 500 });

    const adenaIcon = document.querySelector(
      '#shop-window img[data-icon-item-id="57"]'
    ) as HTMLImageElement | null;
    expect(adenaIcon).not.toBeNull();
    expect(adenaIcon?.alt).toBe('Adena');
    expect(adenaIcon?.src).toContain('adena.png');
  });

  it('uses FALLBACK_ICON for unmapped catalog item ids', () => {
    const img = createShopRowIcon(99999, 'Unknown Item');
    expect(img.src).toContain(FALLBACK_ICON);
    expect(img.dataset['iconFallback']).toBe('true');
    expect(img.alt).toBe('Unknown Item');
  });

  it('displays adena from server-synced game state', () => {
    mountShopWindow();
    renderKaterinaShop({ adena: 897, itemCounts: { 1060: 1 } });

    const adenaEl = document.querySelector('#shop-window [data-adena]');
    expect(adenaEl?.textContent).toBe('897');
  });

  it('buy button sends buy intent with npcId, itemId, and quantity', () => {
    const sendBuy = vi.fn();
    const sendSell = vi.fn();
    mountShopWindow();
    renderShopWindow({
      npcId: KATERINA_NPC_ID,
      merchantName: 'Katerina',
      adena: 1000,
      itemCounts: {},
      visible: true,
      handlers: { sendBuy, sendSell },
    });

    const buyBtn = document.querySelector(
      '#shop-window [data-shop-item-id="1060"] [data-action="buy"]'
    ) as HTMLButtonElement | null;
    expect(buyBtn).not.toBeNull();
    buyBtn?.click();

    expect(sendBuy).toHaveBeenCalledWith({
      npcId: KATERINA_NPC_ID,
      itemId: 1060,
      quantity: 1,
    });
    expect(sendSell).not.toHaveBeenCalled();
  });

  it('exports seeded merchant catalog matching Katerina buylist subset (TINPC-30)', () => {
    expect(KATERINA_SHOP_ITEMS.map((item) => item.itemId)).toEqual([1060, 1835, 17]);
    expect(KATERINA_SHOP_ITEMS.map((item) => item.buyPrice)).toEqual([103, 8, 2]);
    expect(LECTOR_SHOP_ITEMS.map((item) => item.buyPrice)).toEqual([883, 883, 883]);
    expect(JACKSON_SHOP_ITEMS.map((item) => item.buyPrice)).toEqual([169, 105, 8]);
    expect(SILVIA_SHOP_ITEMS.map((item) => item.buyPrice)).toEqual([37, 56, 75]);
  });

  it('Lector buy button sends npcId 30001 (TINPC-22 client path)', () => {
    const sendBuy = vi.fn();
    mountShopWindow();
    renderShopWindow({
      npcId: LECTOR_NPC_ID,
      merchantName: 'Lector',
      adena: 1000,
      itemCounts: {},
      visible: true,
      handlers: { sendBuy, sendSell: vi.fn() },
    });

    const buyBtn = document.querySelector(
      '#shop-window [data-shop-item-id="1"] [data-action="buy"]'
    ) as HTMLButtonElement | null;
    buyBtn?.click();
    expect(sendBuy).toHaveBeenCalledWith({ npcId: LECTOR_NPC_ID, itemId: 1, quantity: 1 });
  });
});
