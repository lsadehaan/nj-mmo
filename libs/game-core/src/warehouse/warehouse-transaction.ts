export const WAREHOUSE_MAX_STACKS = 100;

export interface WarehouseDepositInput {
  inventoryCount: number;
  warehouseCount: number;
  quantity: number;
  isQuestItem: boolean;
  distinctWarehouseItems: number;
  maxStacks?: number;
}

export type WarehouseTxnSuccess = {
  ok: true;
  inventoryCount: number;
  warehouseCount: number;
};

export type WarehouseTxnFailure = {
  ok: false;
  reason: string;
};

export type WarehouseTxnResult = WarehouseTxnSuccess | WarehouseTxnFailure;

export function depositToWarehouse(input: WarehouseDepositInput): WarehouseTxnResult {
  const maxStacks = input.maxStacks ?? WAREHOUSE_MAX_STACKS;
  if (input.isQuestItem) {
    return { ok: false, reason: 'quest_item' };
  }
  if (input.quantity <= 0) {
    return { ok: false, reason: 'invalid_quantity' };
  }
  if (input.inventoryCount < input.quantity) {
    return { ok: false, reason: 'insufficient_inventory' };
  }
  const isNewStack = input.warehouseCount === 0;
  if (isNewStack && input.distinctWarehouseItems >= maxStacks) {
    return { ok: false, reason: 'warehouse_full' };
  }
  return {
    ok: true,
    inventoryCount: input.inventoryCount - input.quantity,
    warehouseCount: input.warehouseCount + input.quantity,
  };
}

export function withdrawFromWarehouse(input: {
  inventoryCount: number;
  warehouseCount: number;
  quantity: number;
}): WarehouseTxnResult {
  if (input.quantity <= 0) {
    return { ok: false, reason: 'invalid_quantity' };
  }
  if (input.warehouseCount < input.quantity) {
    return { ok: false, reason: 'insufficient_warehouse' };
  }
  return {
    ok: true,
    inventoryCount: input.inventoryCount + input.quantity,
    warehouseCount: input.warehouseCount - input.quantity,
  };
}
