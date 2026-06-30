import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initGameState, setItems } from '../test-hook';
import { renderCraftDialog } from './craft-dialog';

describe('craft-dialog', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    initGameState();
  });
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('enables Craft with recipe 1786 in inventory (ITEM25-42)', () => {
    setItems({ 1786: 1 });
    renderCraftDialog({ sendCraft: () => undefined });
    const btn = document.querySelector('[data-action="craft"]') as HTMLButtonElement;
    expect(btn?.disabled).toBe(false);
  });
});
