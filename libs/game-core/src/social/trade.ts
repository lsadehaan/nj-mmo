export interface TradeOfferItem {
  itemId: number;
  count: number;
}

export interface TradeOffer {
  items: TradeOfferItem[];
  adena: number;
}

export interface TradeInventory {
  items: Record<number, number>;
  adena: number;
}

export interface TradeEquipment {
  slots: Record<string, number>;
}

export type TradeOfferValidation =
  | { ok: true }
  | { ok: false; error: string };

export function validateTradeOffer(
  offer: TradeOffer,
  inventory: Record<number, number>,
  adena: number,
  equipment: TradeEquipment,
  isQuestItem: (itemId: number) => boolean
): TradeOfferValidation {
  if (offer.adena < 0) return { ok: false, error: 'invalid_adena' };

  const equippedIds = new Set(Object.values(equipment.slots).filter((id) => id > 0));

  for (const stack of offer.items) {
    if (stack.count <= 0) return { ok: false, error: 'invalid_quantity' };
    if (isQuestItem(stack.itemId)) return { ok: false, error: 'quest_item' };
    if (equippedIds.has(stack.itemId)) return { ok: false, error: 'equipped_item' };
    if ((inventory[stack.itemId] ?? 0) < stack.count) {
      return { ok: false, error: 'insufficient_items' };
    }
  }

  if (adena < offer.adena) return { ok: false, error: 'insufficient_adena' };

  return { ok: true };
}

export interface TradeParty {
  inventory: Record<number, number>;
  adena: number;
}

export function executeTradeSwap(
  partyA: TradeParty,
  offerA: TradeOffer,
  partyB: TradeParty,
  offerB: TradeOffer
): { inventoryA: Record<number, number>; inventoryB: Record<number, number>; adenaA: number; adenaB: number } | null {
  const invA = { ...partyA.inventory };
  const invB = { ...partyB.inventory };
  let adenaA = partyA.adena;
  let adenaB = partyB.adena;

  const take = (inv: Record<number, number>, adena: number, offer: TradeOffer) => {
    let nextAdena = adena - offer.adena;
    if (nextAdena < 0) return null;
    const nextInv = { ...inv };
    for (const stack of offer.items) {
      const have = nextInv[stack.itemId] ?? 0;
      if (have < stack.count) return null;
      const left = have - stack.count;
      if (left <= 0) delete nextInv[stack.itemId];
      else nextInv[stack.itemId] = left;
    }
    return { inv: nextInv, adena: nextAdena };
  };

  const give = (inv: Record<number, number>, adena: number, offer: TradeOffer) => {
    const nextInv = { ...inv };
    let nextAdena = adena + offer.adena;
    for (const stack of offer.items) {
      nextInv[stack.itemId] = (nextInv[stack.itemId] ?? 0) + stack.count;
    }
    return { inv: nextInv, adena: nextAdena };
  };

  const afterTakeA = take(invA, adenaA, offerA);
  const afterTakeB = take(invB, adenaB, offerB);
  if (!afterTakeA || !afterTakeB) return null;

  const afterGiveA = give(afterTakeA.inv, afterTakeA.adena, offerB);
  const afterGiveB = give(afterTakeB.inv, afterTakeB.adena, offerA);
  if (!afterGiveA || !afterGiveB) return null;

  return {
    inventoryA: afterGiveA.inv,
    inventoryB: afterGiveB.inv,
    adenaA: afterGiveA.adena,
    adenaB: afterGiveB.adena,
  };
}
