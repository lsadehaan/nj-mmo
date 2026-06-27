import { Client, Room, Callbacks } from '@colyseus/sdk';
import { setConnected, setCharacterId, setOthers, setMobs, setPlayer } from '../test-hook';
import type { GameRenderer } from '../scene/renderer';
import {
  mountShopWindow,
  renderShopWindow,
  setShopVisible,
  isShopVisible,
} from '../ui/shop-window';
import { mountNpcDialog, renderNpcDialog, setNpcDialogVisible } from '../ui/npc-dialog';
import {
  findNearestInteractableNpc,
  mountInteractPrompt,
  openNpcUiForInteract,
  setInteractPromptVisible,
  type NpcPresence,
} from '../npc-interaction';
import { getGameState } from '../test-hook';

const DEFAULT_ENDPOINT =
  import.meta.env.VITE_COLYSEUS_ENDPOINT ?? 'http://localhost:2567';

export const CHARACTER_ID_STORAGE_KEY = 'nj.characterId';

export function getStoredCharacterId(): string | null {
  return localStorage.getItem(CHARACTER_ID_STORAGE_KEY);
}

export function storeCharacterId(id: string): void {
  localStorage.setItem(CHARACTER_ID_STORAGE_KEY, id);
}

export async function connect(endpoint = DEFAULT_ENDPOINT): Promise<Room> {
  const client = new Client(endpoint);
  const characterId = getStoredCharacterId();
  if (characterId) {
    setCharacterId(characterId);
  }
  const options = characterId ? { characterId } : {};
  const room = await client.joinOrCreate('town', options);

  room.onMessage('characterId', (id: string) => {
    storeCharacterId(id);
    setCharacterId(id);
  });

  setConnected(true);
  return room;
}

export async function connectSafe(endpoint = DEFAULT_ENDPOINT): Promise<Room | null> {
  try {
    return await connect(endpoint);
  } catch {
    setConnected(false);
    return null;
  }
}

export function wireRoom(room: Room, game: GameRenderer): void {
  const callbacks = Callbacks.get(room);
  const localId = room.sessionId;

  const publishOthers = (): void => {
    setOthers(
      [...room.state.players.entries()]
        .filter(
          ([sessionId, player]) =>
            sessionId !== localId && (player as { connected?: boolean }).connected !== false
        )
        .map(([sessionId, player]) => ({
          id: sessionId,
          x: (player as { x: number }).x,
          y: (player as { y: number }).y,
          z: (player as { z: number }).z,
        }))
    );
  };

  type PlayerSchema = {
    x: number;
    y: number;
    z: number;
    xp: number;
    level: number;
    mp: number;
    adena: number;
    powerStrikeCooldownEndMs: number;
    items: { entries: () => Iterable<[string, { itemId: number; count: number }]> };
  };

  type MobSchema = {
    npcId: number;
    x: number;
    y: number;
    z: number;
    hp: number;
    maxHp: number;
  };

  type NpcSchema = {
    npcId: number;
    name: string;
    type: string;
    x: number;
    y: number;
    z: number;
  };

  const publishMobs = (): void => {
    const mobsMap = room.state.mobs;
    if (!mobsMap) {
      setMobs([]);
      return;
    }
    setMobs(
      [...mobsMap.entries()].map(([id, mob]) => {
        const state = mob as MobSchema;
        return {
          id,
          npcId: state.npcId,
          x: state.x,
          y: state.y,
          z: state.z,
          hp: state.hp,
          maxHp: state.maxHp,
        };
      })
    );
  };

  let prevPowerStrikeCooldownEndMs = 0;
  let localItemCounts: Record<number, number> = {};
  let npcPresences: NpcPresence[] = [];

  const updateInteractPrompt = (): void => {
    const player = getGameState().player;
    const nearest = findNearestInteractableNpc({ x: player.x, z: player.z }, npcPresences);
    setInteractPromptVisible(Boolean(nearest?.canInteract));
  };

  const readItemCounts = (player: PlayerSchema): Record<number, number> => {
    const counts: Record<number, number> = {};
    if (!player.items) return counts;
    for (const [, stack] of player.items.entries()) {
      counts[stack.itemId] = stack.count;
    }
    return counts;
  };

  const refreshShopDom = (player: PlayerSchema): void => {
    renderShopWindow({
      adena: player.adena ?? 0,
      itemCounts: localItemCounts,
      visible: isShopVisible(),
      handlers: {
        sendBuy: (payload) => room.send('buy', payload),
        sendSell: (payload) => room.send('sell', payload),
      },
    });
  };

  const syncLocal = (player: PlayerSchema): void => {
    if (prevPowerStrikeCooldownEndMs === 0 && player.powerStrikeCooldownEndMs > 0) {
      game.triggerSkillFlash();
    }
    prevPowerStrikeCooldownEndMs = player.powerStrikeCooldownEndMs;

    game.syncLocalPlayer(player.x, player.y, player.z);
    setPlayer({
      x: player.x,
      y: player.y,
      z: player.z,
      xp: player.xp,
      level: player.level,
      mp: player.mp,
      powerStrikeCooldownEndMs: player.powerStrikeCooldownEndMs,
    });
    localItemCounts = readItemCounts(player);
    refreshShopDom(player);
    updateInteractPrompt();
  };

  mountShopWindow();
  mountNpcDialog();
  mountInteractPrompt();

  const sendInteract = (npcId: number): void => {
    room.send('interact', { npcId });
  };

  window.__interact__ = sendInteract;

  const onInteractKey = (ev: KeyboardEvent): void => {
    if (ev.key !== 'e' && ev.key !== 'E') return;
    const player = getGameState().player;
    const nearest = findNearestInteractableNpc({ x: player.x, z: player.z }, npcPresences);
    if (!nearest?.canInteract) return;
    ev.preventDefault();
    sendInteract(nearest.npcId);
  };
  window.addEventListener('keydown', onInteractKey);

  room.onMessage('interactResult', (message: { npcId: number; type: string; name: string }) => {
    openNpcUiForInteract(message, {
      openShop: () => {
        const local = room.state.players.get(localId) as PlayerSchema | undefined;
        if (local) {
          renderShopWindow({
            adena: local.adena ?? 0,
            itemCounts: localItemCounts,
            visible: true,
            handlers: {
              sendBuy: (payload) => room.send('buy', payload),
              sendSell: (payload) => room.send('sell', payload),
            },
          });
        } else {
          setShopVisible(true);
        }
        setNpcDialogVisible(false);
      },
      openDialog: (npcId, name) => {
        setShopVisible(false);
        renderNpcDialog({
          npcId,
          name,
          visible: true,
          handlers: {
            sendNpcAction: (payload) => room.send('npcAction', payload),
          },
        });
      },
    });
  });

  callbacks.onAdd('players', (player, sessionId) => {
    const id = sessionId as string;
    const state = player as PlayerSchema;
    if (id === localId) {
      syncLocal(state);
      callbacks.onChange(state, () => syncLocal(state));
      return;
    }

    game.syncRemotePlayer(id, state.x, state.y, state.z);
    publishOthers();
    callbacks.onChange(state, () => {
      game.syncRemotePlayer(id, state.x, state.y, state.z);
      publishOthers();
    });
  });

  callbacks.onRemove('players', (_player, sessionId) => {
    const id = sessionId as string;
    if (id !== localId) {
      game.removeRemotePlayer(id);
      publishOthers();
    }
  });

  const syncMobFromState = (mobId: string, mob: MobSchema): void => {
    game.syncMob({
      id: mobId,
      x: mob.x,
      y: mob.y,
      z: mob.z,
      hp: mob.hp,
      maxHp: mob.maxHp,
    });
    publishMobs();
  };

  callbacks.onAdd('mobs', (mob, mobId) => {
    const id = mobId as string;
    const state = mob as MobSchema;
    syncMobFromState(id, state);
    callbacks.onChange(state, () => syncMobFromState(id, state));
  });

  callbacks.onRemove('mobs', (_mob, mobId) => {
    game.removeMob(mobId as string);
    publishMobs();
  });

  if (room.state.mobs) {
    for (const [id, mob] of room.state.mobs.entries() as Iterable<[string, MobSchema]>) {
      syncMobFromState(id, mob);
      callbacks.onChange(mob, () => syncMobFromState(id, mob));
    }
  }

  publishMobs();

  const syncNpcFromState = (npcKey: string, npc: NpcSchema): void => {
    game.syncNpc({
      id: npcKey,
      npcId: npc.npcId,
      type: npc.type,
      x: npc.x,
      y: npc.y,
      z: npc.z,
    });
    const idx = npcPresences.findIndex((entry) => entry.npcId === npc.npcId);
    const presence: NpcPresence = {
      npcId: npc.npcId,
      x: npc.x,
      y: npc.y,
      z: npc.z,
      type: npc.type,
    };
    if (idx >= 0) npcPresences[idx] = presence;
    else npcPresences.push(presence);
    updateInteractPrompt();
  };

  callbacks.onAdd('npcs', (npc, npcKey) => {
    const id = npcKey as string;
    const state = npc as NpcSchema;
    syncNpcFromState(id, state);
    callbacks.onChange(state, () => syncNpcFromState(id, state));
  });

  callbacks.onRemove('npcs', (_npc, npcKey) => {
    game.removeNpc(npcKey as string);
  });

  const npcsMap = room.state.npcs;
  if (npcsMap) {
    for (const [id, npc] of npcsMap.entries() as Iterable<[string, NpcSchema]>) {
      syncNpcFromState(id, npc);
      callbacks.onChange(npc, () => syncNpcFromState(id, npc));
    }
  }
}
