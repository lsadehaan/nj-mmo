import { describe, it, expect, vi } from 'vitest';
import { openNpcUiForInteract } from './npc-interaction';

describe('npc-interaction quest chooser', () => {
  it('opens quest chooser for merchant when quest available', () => {
    const openQuestChooser = vi.fn();
    const openShop = vi.fn();
    openNpcUiForInteract(
      { npcId: 30004, type: 'Merchant', name: 'Katerina' },
      { openShop, openDialog: vi.fn(), openQuestChooser },
      true
    );
    expect(openQuestChooser).toHaveBeenCalledWith(30004, 'Katerina');
    expect(openShop).not.toHaveBeenCalled();
  });

  it('opens shop when no quest available', () => {
    const openShop = vi.fn();
    openNpcUiForInteract(
      { npcId: 30004, type: 'Merchant', name: 'Katerina' },
      { openShop, openDialog: vi.fn() },
      false
    );
    expect(openShop).toHaveBeenCalled();
  });
});
