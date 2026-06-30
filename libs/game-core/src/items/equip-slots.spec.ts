import { describe, it, expect } from 'vitest';
import {
  EQUIP_SLOTS,
  bodyPartToSlot,
  validateEquip,
  validateUnequip,
} from './equip-slots';

describe('equip-slots', () => {
  it('exports 11 equip slot keys (ITEM25-18)', () => {
    expect(EQUIP_SLOTS).toHaveLength(11);
    expect(EQUIP_SLOTS).toContain('chest');
    expect(EQUIP_SLOTS).toContain('earring');
    expect(EQUIP_SLOTS).toContain('ring');
  });

  it('maps L2J body parts to slot keys', () => {
    expect(bodyPartToSlot('rhand')).toBe('rhand');
    expect(bodyPartToSlot('rear;lear')).toBe('earring');
    expect(bodyPartToSlot('rfinger;lfinger')).toBe('ring');
  });

  it('rejects consumable equip (ITEM25-23)', () => {
    const result = validateEquip({
      item: { itemId: 1060, type: 'consumable', bodyPart: null },
      ownedCount: 1,
      equipment: [],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('not_equippable');
  });

  it('accepts weapon equip to rhand', () => {
    const result = validateEquip({
      item: { itemId: 3, type: 'weapon', bodyPart: 'rhand' },
      ownedCount: 1,
      equipment: [],
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.targetSlot).toBe('rhand');
  });

  it('rejects unequip when inventory full', () => {
    const result = validateUnequip({
      slot: 'chest',
      equipment: [{ slot: 'chest', itemId: 23 }],
      inventoryFull: true,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('inventory_full');
  });
});
