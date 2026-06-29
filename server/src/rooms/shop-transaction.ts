import type { MerchantItem } from '../db/schema';

export type ShopSuccess = {
  ok: true;
  adena: number;
  itemCount: number;
};

export type ShopFailure = {
  ok: false;
  adena: number;
  itemCount: number;
  error: string;
};

export type ShopResult = ShopSuccess | ShopFailure;

export function buyItem(params: {
  adena: number;
  itemCount: number;
  listing: MerchantItem;
  quantity: number;
  itemId?: number;
}): ShopResult {
  const { adena, itemCount, listing, quantity, itemId = listing.itemId } = params;

  if (itemId !== listing.itemId) {
    return { ok: false, adena, itemCount, error: 'unknown_item' };
  }

  if (quantity <= 0) {
    return { ok: false, adena, itemCount, error: 'invalid_quantity' };
  }

  const totalCost = listing.buyPrice * quantity;
  if (adena < totalCost) {
    return { ok: false, adena, itemCount, error: 'insufficient_adena' };
  }

  return {
    ok: true,
    adena: adena - totalCost,
    itemCount: itemCount + quantity,
  };
}

export function sellItem(params: {
  adena: number;
  itemCount: number;
  listing: MerchantItem;
  quantity: number;
  itemId?: number;
  isQuestItem?: boolean;
}): ShopResult {
  const { adena, itemCount, listing, quantity, itemId = listing.itemId, isQuestItem = false } = params;

  if (isQuestItem) {
    return { ok: false, adena, itemCount, error: 'quest_item' };
  }

  if (itemId !== listing.itemId) {
    return { ok: false, adena, itemCount, error: 'unknown_item' };
  }

  if (quantity <= 0) {
    return { ok: false, adena, itemCount, error: 'invalid_quantity' };
  }

  if (itemCount < quantity) {
    return { ok: false, adena, itemCount, error: 'insufficient_items' };
  }

  const totalGain = listing.sellPrice * quantity;
  return {
    ok: true,
    adena: adena + totalGain,
    itemCount: itemCount - quantity,
  };
}
