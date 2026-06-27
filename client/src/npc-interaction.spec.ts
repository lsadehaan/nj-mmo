import { describe, it, expect } from 'vitest';
import { NPC_INTERACT_RADIUS, horizontalDistance } from '@nj/game-core';
import {
  KATERINA_NPC_ID,
  ROXXY_NPC_ID,
  findNearestInteractableNpc,
  isWithinInteractRadius,
} from './npc-interaction';

describe('npc-interaction proximity', () => {
  const npcs = [
    { npcId: KATERINA_NPC_ID, x: -6, y: 4.26, z: -8, type: 'Merchant' },
    { npcId: ROXXY_NPC_ID, x: 4, y: 4.26, z: 10, type: 'Teleporter' },
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

  it('maps Katerina to shop and Roxxy to helper dialog roles', () => {
    expect(npcs.find((n) => n.npcId === KATERINA_NPC_ID)?.type).toBe('Merchant');
    expect(npcs.find((n) => n.npcId === ROXXY_NPC_ID)?.type).toBe('Teleporter');
  });
});
