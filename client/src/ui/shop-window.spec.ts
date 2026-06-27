import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  KATERINA_NPC_ID,
  KATERINA_SHOP_ITEMS,
  mountShopWindow,
  renderShopWindow,
  type ShopSendHandlers,
} from './shop-window';

describe('shop-window DOM', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('lists Healing Potion, Soulshot, and Wooden Arrow with buy prices 103, 8, 2', () => {
    mountShopWindow();
    renderShopWindow({
      adena: 1000,
      itemCounts: {},
      visible: true,
      handlers: { sendBuy: vi.fn(), sendSell: vi.fn() },
    });

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

  it('displays adena from server-synced game state', () => {
    mountShopWindow();
    renderShopWindow({
      adena: 897,
      itemCounts: { 1060: 1 },
      visible: true,
      handlers: { sendBuy: vi.fn(), sendSell: vi.fn() },
    });

    const adenaEl = document.querySelector('#shop-window [data-adena]');
    expect(adenaEl?.textContent).toBe('897');
  });

  it('buy button sends buy intent with npcId, itemId, and quantity', () => {
    const sendBuy = vi.fn();
    const sendSell = vi.fn();
    mountShopWindow();
    renderShopWindow({
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

  it('exports seeded merchant catalog matching Katerina buylist subset', () => {
    expect(KATERINA_SHOP_ITEMS.map((item) => item.itemId)).toEqual([1060, 1835, 17]);
    expect(KATERINA_SHOP_ITEMS.map((item) => item.buyPrice)).toEqual([103, 8, 2]);
  });
});
