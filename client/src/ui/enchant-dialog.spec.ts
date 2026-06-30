import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderEnchantDialog, PINTER_NPC_ID } from './enchant-dialog';

describe('enchant-dialog', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders enchant UI for Pinter interact (ITEM25-49)', () => {
    renderEnchantDialog(true, { sendEnchant: () => undefined });
    const dialog = document.querySelector('[data-role="enchant-dialog"]') as HTMLElement | null;
    expect(dialog?.hidden).toBe(false);
    expect(PINTER_NPC_ID).toBe(30298);
  });
});
