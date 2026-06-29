import { describe, it, expect } from 'vitest';
import { buyItem, sellItem } from './shop-transaction';
import type { MerchantItem } from '../db/schema';

const POTION_LISTING: MerchantItem = {
  id: 1,
  npcId: 30004,
  itemId: 1060,
  name: 'Healing Potion',
  buyPrice: 103,
  sellPrice: 51,
};

describe('shop-transaction', () => {
  it('buy 1× item 1060 at price 103 drops adena from 1000 to 897 and sets count to 1', () => {
    const result = buyItem({
      adena: 1000,
      itemCount: 0,
      listing: POTION_LISTING,
      quantity: 1,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.adena).toBe(897);
      expect(result.itemCount).toBe(1);
    }
  });

  it('buy rejects when adena is insufficient', () => {
    const result = buyItem({
      adena: 50,
      itemCount: 0,
      listing: POTION_LISTING,
      quantity: 1,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.adena).toBe(50);
      expect(result.itemCount).toBe(0);
    }
  });

  it('sell 1× item 1060 at sell price 51 adds adena from 897 to 948 and reduces count to 1', () => {
    const result = sellItem({
      adena: 897,
      itemCount: 2,
      listing: POTION_LISTING,
      quantity: 1,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.adena).toBe(948);
      expect(result.itemCount).toBe(1);
    }
  });

  it('sell rejects when item count is zero', () => {
    const result = sellItem({
      adena: 897,
      itemCount: 0,
      listing: POTION_LISTING,
      quantity: 1,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.adena).toBe(897);
      expect(result.itemCount).toBe(0);
    }
  });

  it('buy rejects when listing itemId does not match requested item', () => {
    const wrongListing: MerchantItem = { ...POTION_LISTING, itemId: 9999 };
    const result = buyItem({
      adena: 1000,
      itemCount: 0,
      listing: wrongListing,
      quantity: 1,
      itemId: 1060,
    });

    expect(result.ok).toBe(false);
  });

  // QUEST21-21
  it('sell rejects quest item 1012', () => {
    const result = sellItem({
      adena: 1000,
      itemCount: 1,
      listing: { ...POTION_LISTING, itemId: 1012 },
      quantity: 1,
      itemId: 1012,
      isQuestItem: true,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('quest_item');
    }
  });
});
