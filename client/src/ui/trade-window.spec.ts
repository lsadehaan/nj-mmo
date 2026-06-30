import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { wireTradeWindow } from './trade-window';

describe('trade-window', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('confirm sends tradeConfirm', () => {
    const sendTradeConfirm = vi.fn();
    wireTradeWindow({ sendTradeConfirm, sendTradeCancel: vi.fn() });
    (document.querySelector('[data-role="confirm"]') as HTMLButtonElement).click();
    expect(sendTradeConfirm).toHaveBeenCalled();
  });
});
