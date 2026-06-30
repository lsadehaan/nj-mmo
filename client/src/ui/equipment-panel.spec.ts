import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initGameState, setEquipment } from '../test-hook';
import { renderEquipmentPanel } from './equipment-panel';

describe('equipment-panel', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    initGameState();
  });
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('shows chest slot item 23 after equip (ITEM25-32)', () => {
    setEquipment({ chest: { itemId: 23, enchantLevel: 0 } });
    renderEquipmentPanel();
    const row = document.querySelector('[data-equip-slot="chest"]');
    expect(row?.getAttribute('data-equip-item-id')).toBe('23');
  });
});
