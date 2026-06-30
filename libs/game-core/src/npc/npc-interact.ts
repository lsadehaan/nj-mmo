import { horizontalDistance } from '../combat/combat-range';
import { NPC_INTERACT_RADIUS } from '../peace-zone';

export function canNpcInteract(
  player: { playerX: number; playerZ: number },
  npc: { npcX: number; npcZ: number },
  npcType: string
): boolean {
  if (npcType === 'Guard') return false;
  const dist = horizontalDistance(
    player.playerX,
    player.playerZ,
    npc.npcX,
    npc.npcZ
  );
  return dist <= NPC_INTERACT_RADIUS;
}
