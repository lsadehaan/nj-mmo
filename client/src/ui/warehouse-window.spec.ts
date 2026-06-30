import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  mountWarehouseWindow,
  renderWarehouseWindow,
  WAREHOUSE_WINDOW_ID,
} from './warehouse-window';

describe('warehouse-window', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('mounts panel with deposit and withdraw actions (TOWN24-27)', () => {
    const panel = mountWarehouseWindow();
    expect(panel.id).toBe(WAREHOUSE_WINDOW_ID);
    expect(panel.querySelector('[data-action="deposit"]')).not.toBeNull();
    expect(panel.querySelector('[data-action="withdraw"]')).not.toBeNull();
  });

  it('deposit button sends warehouseDeposit intent payload', () => {
    const sendDeposit = vi.fn();
    const sendWithdraw = vi.fn();
    renderWarehouseWindow({
      npcId: 30005,
      inventory: [{ itemId: 1060, count: 5 }],
      warehouse: [],
      visible: true,
      handlers: { sendDeposit, sendWithdraw },
    });

    const select = document.querySelector(
      '#warehouse-window [data-role="item-select"]'
    ) as HTMLSelectElement;
    select.value = '1060';
    const deposit = document.querySelector(
      '#warehouse-window [data-action="deposit"]'
    ) as HTMLButtonElement;
    deposit.click();

    expect(sendDeposit).toHaveBeenCalledWith({ itemId: 1060, quantity: 1 });
    expect(sendWithdraw).not.toHaveBeenCalled();
  });

  it('withdraw button sends warehouseWithdraw intent payload', () => {
    const sendDeposit = vi.fn();
    const sendWithdraw = vi.fn();
    renderWarehouseWindow({
      npcId: 30005,
      inventory: [],
      warehouse: [{ itemId: 1060, count: 3 }],
      visible: true,
      handlers: { sendDeposit, sendWithdraw },
    });

    const select = document.querySelector(
      '#warehouse-window [data-role="item-select"]'
    ) as HTMLSelectElement;
    select.value = '1060';
    const withdraw = document.querySelector(
      '#warehouse-window [data-action="withdraw"]'
    ) as HTMLButtonElement;
    withdraw.click();

    expect(sendWithdraw).toHaveBeenCalledWith({ itemId: 1060, quantity: 1 });
  });
});
