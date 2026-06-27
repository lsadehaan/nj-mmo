import { horizontalDistance, NPC_INTERACT_RADIUS } from '@nj/game-core';

export const KATERINA_NPC_ID = 30004;
export const ROXXY_NPC_ID = 30006;

export interface NpcPresence {
  npcId: number;
  name: string;
  x: number;
  y: number;
  z: number;
  type: string;
}

export interface NearestNpcResult {
  npcId: number;
  type: string;
  distance: number;
  canInteract: boolean;
}

export function isWithinInteractRadius(
  player: { x: number; z: number },
  npc: { x: number; z: number }
): boolean {
  return horizontalDistance(player.x, player.z, npc.x, npc.z) <= NPC_INTERACT_RADIUS;
}

export function findNearestInteractableNpc(
  player: { x: number; z: number },
  npcs: NpcPresence[]
): NearestNpcResult | null {
  if (npcs.length === 0) return null;

  let nearest: NearestNpcResult | null = null;
  for (const npc of npcs) {
    const distance = horizontalDistance(player.x, player.z, npc.x, npc.z);
    if (!nearest || distance < nearest.distance) {
      nearest = {
        npcId: npc.npcId,
        type: npc.type,
        distance,
        canInteract: distance <= NPC_INTERACT_RADIUS,
      };
    }
  }
  return nearest;
}

const PROMPT_ID = 'npc-interact-prompt';

export function mountInteractPrompt(): HTMLElement {
  const existing = document.getElementById(PROMPT_ID);
  if (existing) return existing;

  const prompt = document.createElement('div');
  prompt.id = PROMPT_ID;
  prompt.hidden = true;
  prompt.textContent = 'Press E to interact';
  prompt.style.cssText = [
    'position:fixed',
    'bottom:80px',
    'left:50%',
    'transform:translateX(-50%)',
    'padding:8px 14px',
    'background:rgba(0,0,0,0.65)',
    'color:#fff',
    'border-radius:4px',
    'font:14px system-ui,sans-serif',
    'z-index:15',
    'pointer-events:none',
  ].join(';');
  document.body.appendChild(prompt);
  return prompt;
}

export function setInteractPromptVisible(visible: boolean): void {
  const prompt = mountInteractPrompt();
  prompt.hidden = !visible;
}

export function isUtilityNpc(npcId: number, type: string): boolean {
  return npcId === ROXXY_NPC_ID || type === 'Teleporter';
}

export function isMerchantNpc(npcId: number, type: string): boolean {
  return npcId === KATERINA_NPC_ID || type === 'Merchant';
}

export function openNpcUiForInteract(
  message: { npcId: number; type: string; name: string },
  handlers: {
    openShop: () => void;
    openDialog: (npcId: number, name: string) => void;
  }
): void {
  if (isMerchantNpc(message.npcId, message.type)) {
    handlers.openShop();
    return;
  }
  if (isUtilityNpc(message.npcId, message.type)) {
    handlers.openDialog(message.npcId, message.name);
  }
}
