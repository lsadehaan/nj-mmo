import { horizontalDistance, NPC_INTERACT_RADIUS } from '@nj/game-core';

export type ItemCounts = Record<number, number>;

export function canInteract(
  player: { playerX: number; playerZ: number },
  npc: { npcX: number; npcZ: number }
): boolean {
  const dist = horizontalDistance(
    player.playerX,
    player.playerZ,
    npc.npcX,
    npc.npcZ
  );
  return dist <= NPC_INTERACT_RADIUS;
}

export type HealSuccess = { ok: true; hp: number };
export type HealFailure = { ok: false; hp: number };
export type HealResult = HealSuccess | HealFailure;

export function applyHeal(params: { hp: number; maxHp: number }): HealResult {
  return { ok: true, hp: params.maxHp };
}

export type StarterKitSuccess = {
  ok: true;
  starterKitGranted: true;
  itemCounts: ItemCounts;
};

export type StarterKitFailure = {
  ok: false;
  starterKitGranted: boolean;
  itemCounts: ItemCounts;
};

export type StarterKitResult = StarterKitSuccess | StarterKitFailure;

const STARTER_KIT_ITEM_ID = 1060;
const STARTER_KIT_QUANTITY = 3;
const STARTER_SWORD_ITEM_ID = 2369;
const STARTER_SWORD_QUANTITY = 1;

export function applyStarterKit(params: {
  starterKitGranted: boolean;
  itemCounts: ItemCounts;
}): StarterKitResult {
  if (params.starterKitGranted) {
    return {
      ok: false,
      starterKitGranted: true,
      itemCounts: { ...params.itemCounts },
    };
  }

  const itemCounts = { ...params.itemCounts };
  itemCounts[STARTER_KIT_ITEM_ID] =
    (itemCounts[STARTER_KIT_ITEM_ID] ?? 0) + STARTER_KIT_QUANTITY;
  itemCounts[STARTER_SWORD_ITEM_ID] =
    (itemCounts[STARTER_SWORD_ITEM_ID] ?? 0) + STARTER_SWORD_QUANTITY;

  return {
    ok: true,
    starterKitGranted: true,
    itemCounts,
  };
}
