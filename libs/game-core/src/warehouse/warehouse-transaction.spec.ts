import { describe, it, expect } from 'vitest';
import { depositToWarehouse, withdrawFromWarehouse } from './warehouse-transaction';

describe('warehouse-transaction', () => {
  it('deposits items to warehouse (happy path)', () => {
    const result = depositToWarehouse({
      inventoryCount: 5,
      warehouseCount: 0,
      quantity: 3,
      isQuestItem: false,
      distinctWarehouseItems: 0,
    });
    expect(result).toEqual({ ok: true, inventoryCount: 2, warehouseCount: 3 });
  });

  it('rejects quest item deposit (TOWN24-24)', () => {
    const result = depositToWarehouse({
      inventoryCount: 5,
      warehouseCount: 0,
      quantity: 1,
      isQuestItem: true,
      distinctWarehouseItems: 0,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('quest_item');
  });

  it('rejects deposit exceeding inventory (TOWN24-25)', () => {
    const result = depositToWarehouse({
      inventoryCount: 2,
      warehouseCount: 0,
      quantity: 3,
      isQuestItem: false,
      distinctWarehouseItems: 0,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('insufficient_inventory');
  });

  it('withdraws from warehouse', () => {
    const result = withdrawFromWarehouse({
      inventoryCount: 2,
      warehouseCount: 3,
      quantity: 1,
    });
    expect(result).toEqual({ ok: true, inventoryCount: 3, warehouseCount: 2 });
  });
});
