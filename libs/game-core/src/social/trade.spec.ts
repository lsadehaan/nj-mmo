import { describe, it, expect } from 'vitest';
import { validateTradeOffer, executeTradeSwap } from './trade';

describe('validateTradeOffer (SOC26-27)', () => {
  const noQuest = () => false;
  const questItem = (id: number) => id === 9999;

  it('rejects quest items', () => {
    const result = validateTradeOffer(
      { items: [{ itemId: 9999, count: 1 }], adena: 0 },
      { 9999: 1 },
      0,
      { slots: {} },
      questItem
    );
    expect(result.ok).toBe(false);
  });

  it('rejects equipped items', () => {
    const result = validateTradeOffer(
      { items: [{ itemId: 2369, count: 1 }], adena: 0 },
      { 2369: 1 },
      0,
      { slots: { rhand: 2369 } },
      noQuest
    );
    expect(result.ok).toBe(false);
  });
});

describe('executeTradeSwap (SOC26-26)', () => {
  it('conserves total item counts and adena on successful swap', () => {
    const partyA = { inventory: { 1835: 10, 1060: 2 }, adena: 500 };
    const partyB = { inventory: { 1060: 3 }, adena: 200 };
    const offerA = { items: [{ itemId: 1835, count: 5 }], adena: 100 };
    const offerB = { items: [{ itemId: 1060, count: 1 }], adena: 50 };

    const result = executeTradeSwap(partyA, offerA, partyB, offerB);
    expect(result).not.toBeNull();
    if (!result) return;

    const totalItems = (inv: Record<number, number>) =>
      Object.values(inv).reduce((s, c) => s + c, 0);
    const before =
      totalItems(partyA.inventory) +
      totalItems(partyB.inventory) +
      partyA.adena +
      partyB.adena;
    const after =
      totalItems(result.inventoryA) +
      totalItems(result.inventoryB) +
      result.adenaA +
      result.adenaB;
    expect(after).toBe(before);
    expect(result.inventoryA[1835]).toBe(5);
    expect(result.inventoryB[1835]).toBe(5);
    expect(result.adenaA).toBe(450);
    expect(result.adenaB).toBe(250);
  });

  it('SOC26-26: returns null when A offers more adena than owned', () => {
    const result = executeTradeSwap(
      { inventory: {}, adena: 50 },
      { items: [], adena: 100 },
      { inventory: {}, adena: 0 },
      { items: [], adena: 0 }
    );
    expect(result).toBeNull();
  });
});
