import { describe, it, expect, vi } from 'vitest';
import { NPC_INTERACT_RADIUS, horizontalDistance } from '@nj/game-core';
import {
  KATERINA_NPC_ID,
  ROXXY_NPC_ID,
  LECTOR_NPC_ID,
  WILFORD_NPC_ID,
  BITZ_NPC_ID,
  findNearestInteractableNpc,
  isWithinInteractRadius,
  isMerchantNpc,
  openNpcUiForInteract,
  resolveDialogVariant,
} from './npc-interaction';

describe('npc-interaction proximity', () => {
  const npcs = [
    { npcId: KATERINA_NPC_ID, name: 'Katerina', x: -6, y: 4.26, z: -8, type: 'Merchant' },
    { npcId: ROXXY_NPC_ID, name: 'Roxxy', x: 4, y: 4.26, z: 10, type: 'Teleporter' },
  ];

  it('enables interact within NPC_INTERACT_RADIUS (3.0 m)', () => {
    expect(NPC_INTERACT_RADIUS).toBe(3.0);
    expect(isWithinInteractRadius({ x: -6, z: -8 }, { x: -6, z: -8 })).toBe(true);
    expect(
      isWithinInteractRadius({ x: -6, z: -8 }, { x: -6 + 2.9, z: -8 })
    ).toBe(true);
    expect(
      isWithinInteractRadius({ x: -6, z: -8 }, { x: -6 + 3.1, z: -8 })
    ).toBe(false);
  });

  it('finds nearest NPC and canInteract flag from player position', () => {
    const nearKaterina = findNearestInteractableNpc({ x: -6, z: -8 }, npcs);
    expect(nearKaterina?.npcId).toBe(KATERINA_NPC_ID);
    expect(nearKaterina?.canInteract).toBe(true);

    const far = findNearestInteractableNpc({ x: 0, z: 0 }, npcs);
    expect(far?.npcId).toBe(KATERINA_NPC_ID);
    expect(far?.canInteract).toBe(false);
    expect(horizontalDistance(0, 0, -6, -8)).toBeGreaterThan(NPC_INTERACT_RADIUS);
  });

  it('skips Guard type when finding nearest interactable NPC (TOWN24-15)', () => {
    const withGuard = [
      { npcId: 30039, name: 'Day', x: 0, y: 4.26, z: 0, type: 'Guard' },
      { npcId: KATERINA_NPC_ID, name: 'Katerina', x: 2, y: 4.26, z: 0, type: 'Merchant' },
    ];
    const nearest = findNearestInteractableNpc({ x: 0, z: 0 }, withGuard);
    expect(nearest?.npcId).toBe(KATERINA_NPC_ID);
    expect(nearest?.canInteract).toBe(true);
  });

  it('maps merchant type to shop and utility types to dialog variants', () => {
    expect(isMerchantNpc(LECTOR_NPC_ID, 'Merchant')).toBe(true);
    expect(resolveDialogVariant(WILFORD_NPC_ID, 'Warehouse')).toBe('warehouse');
    expect(resolveDialogVariant(BITZ_NPC_ID, 'VillageMasterFighter')).toBe('trainer');
    expect(resolveDialogVariant(ROXXY_NPC_ID, 'Teleporter')).toBe('gatekeeper');
  });

  it('routes merchant interact to shop with merchant npcId (TINPC-29)', () => {
    const openShop = vi.fn();
    const openDialog = vi.fn();
    openNpcUiForInteract(
      { npcId: LECTOR_NPC_ID, type: 'Merchant', name: 'Lector' },
      { openShop, openDialog }
    );
    expect(openShop).toHaveBeenCalledWith(LECTOR_NPC_ID, 'Lector');
    expect(openDialog).not.toHaveBeenCalled();
  });

  it('routes warehouse and trainer types to dialog variants', () => {
    const openShop = vi.fn();
    const openDialog = vi.fn();
    openNpcUiForInteract(
      { npcId: WILFORD_NPC_ID, type: 'Warehouse', name: 'Wilford' },
      { openShop, openDialog }
    );
    expect(openDialog).toHaveBeenCalledWith(WILFORD_NPC_ID, 'Wilford', 'warehouse');
    openDialog.mockClear();
    openNpcUiForInteract(
      { npcId: BITZ_NPC_ID, type: 'VillageMasterFighter', name: 'Bitz' },
      { openShop, openDialog }
    );
    expect(openDialog).toHaveBeenCalledWith(BITZ_NPC_ID, 'Bitz', 'trainer');
  });
});
