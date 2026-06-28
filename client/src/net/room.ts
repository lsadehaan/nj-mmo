import { Client, Room, Callbacks } from '@colyseus/sdk';
import { setConnected, setCharacterId, setOthers, setMobs, setPlayer, setAdena, setItems, setNpcs, setNearbyNpc, setShopOpen, setEquippedWeaponId, setMaxHp, setMaxMp } from '../test-hook';
import type { GameRenderer } from '../scene/renderer';
import {
  mountShopWindow,
  renderShopWindow,
  setShopVisible,
  isShopVisible,
} from '../ui/shop-window';
import {
  mountInventoryWindow,
  renderInventoryWindow,
  setInventoryVisible,
  isInventoryVisible,
} from '../ui/inventory-window';
import { mountNpcDialog, renderNpcDialog, setNpcDialogVisible } from '../ui/npc-dialog';
import {
  findNearestInteractableNpc,
  mountInteractPrompt,
  openNpcUiForInteract,
  setInteractPromptVisible,
  KATERINA_NPC_ID,
  ROXXY_NPC_ID,
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

/**
 * Optional `?room=<key>` query param: when present the client joins an isolated
 * room instance (matched server-side via `filterBy(['instanceKey'])`). Used by
 * e2e tests for per-test isolation; absent in production, so all players share
 * the default `town` world.
 */
function getRoomInstanceKey(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    return new URLSearchParams(window.location.search).get('room') ?? undefined;
  } catch {
    return undefined;
  }
}

export async function connect(endpoint = DEFAULT_ENDPOINT): Promise<Room> {
  const client = new Client(endpoint);
  const characterId = getStoredCharacterId();
  if (characterId) {
    setCharacterId(characterId);
  }
  const options: Record<string, string> = characterId ? { characterId } : {};
  const instanceKey = getRoomInstanceKey();
  if (instanceKey) options.instanceKey = instanceKey;
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
    setOthers(game.listRemotePlayers());
  };

  type PlayerSchema = {
    x: number;
    y: number;
    z: number;
    xp: number;
    level: number;
    hp: number;
    maxHp: number;
    mp: number;
    maxMp: number;
    adena: number;
    equippedWeaponItemId: number;
    powerStrikeCooldownEndMs: number;
    action?: number;
    actionSeq?: number;
    items: { entries: () => Iterable<[string, { itemId: number; count: number }]> };
  };

  type MobSchema = {
    npcId: number;
    x: number;
    y: number;
    z: number;
    hp: number;
    maxHp: number;
    action?: number;
    actionSeq?: number;
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
    const hookById = new Map((game.getMobHookEntries?.() ?? []).map((mob) => [mob.id, mob]));
    const mobsMap = room.state.mobs;
    if (!mobsMap) {
      setMobs([...hookById.values()]);
      return;
    }
    const merged = [...mobsMap.entries()].map(([id, mob]) => {
      const state = mob as MobSchema;
      const hook = hookById.get(id);
      return {
        id,
        npcId: state.npcId,
        x: state.x,
        y: state.y,
        z: state.z,
        hp: state.hp,
        maxHp: state.maxHp,
        action: hook?.action ?? 'idle',
      };
    });
    for (const [id, hook] of hookById) {
      if (!mobsMap.has(id)) merged.push(hook);
    }
    setMobs(merged);
  };

  let localItemCounts: Record<number, number> = {};
  const npcPresences: NpcPresence[] = [];
  let greetUiEpoch = 0;

  const fireNpcGreet = (npcId: number): void => {
    greetUiEpoch += 1;
    const player = getGameState().player;
    game.triggerNpcGreet(npcId, { x: player.x, z: player.z }, greetUiEpoch);
  };

  const updateInteractPrompt = (): void => {
    const player = getGameState().player;
    const nearest = findNearestInteractableNpc({ x: player.x, z: player.z }, npcPresences);
    setInteractPromptVisible(Boolean(nearest?.canInteract));
    setNearbyNpc(nearest?.canInteract ? nearest.npcId : null, Boolean(nearest?.canInteract));
  };

  const publishNpcsToHook = (): void => {
    const hookByNpcId = new Map(
      game.getNpcHookEntries().map((entry) => [entry.npcId, entry])
    );
    setNpcs(
      npcPresences.map((npc) => {
        const hook = hookByNpcId.get(npc.npcId);
        return {
          npcId: npc.npcId,
          name: npc.name,
          type: npc.type,
          x: npc.x,
          y: npc.y,
          z: npc.z,
          renderKind: hook?.renderKind,
          action: hook?.action ?? 'idle',
        };
      })
    );
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

  const refreshInventoryDom = (player: PlayerSchema): void => {
    renderInventoryWindow({
      itemCounts: localItemCounts,
      equippedWeaponItemId: player.equippedWeaponItemId ?? 0,
      visible: isInventoryVisible(),
      handlers: {
        sendEquip: (payload) => room.send('equip', payload),
      },
    });
  };

  const syncPlayerItems = (player: PlayerSchema): void => {
    localItemCounts = readItemCounts(player);
    setItems(localItemCounts);
    refreshShopDom(player);
    refreshInventoryDom(player);
  };

  const bindLocalPlayerItems = (player: PlayerSchema): void => {
    const onItemsChanged = (): void => syncPlayerItems(player);
    const collectionCallbacks = callbacks as {
      onAdd: (
        instance: PlayerSchema,
        property: 'items',
        handler: (stack: { itemId: number; count: number }) => void,
        immediate?: boolean
      ) => void;
      onChange: (instance: PlayerSchema, property: 'items', handler: () => void) => void;
      onRemove: (instance: PlayerSchema, property: 'items', handler: () => void) => void;
      listen: (instance: { count: number }, property: 'count', handler: () => void) => void;
    };
    collectionCallbacks.onAdd(
      player,
      'items',
      (stack) => {
        onItemsChanged();
        collectionCallbacks.listen(stack, 'count', onItemsChanged);
      },
      true
    );
    collectionCallbacks.onChange(player, 'items', onItemsChanged);
    collectionCallbacks.onRemove(player, 'items', onItemsChanged);
  };

  const syncLocal = (player: PlayerSchema): void => {
    game.syncLocalPlayer(
      player.x,
      player.y,
      player.z,
      player.action ?? 0,
      player.actionSeq ?? 0,
      player.equippedWeaponItemId ?? 0
    );
    game.syncPlayerVfx({
      hp: player.hp,
      level: player.level,
      action: player.action ?? 0,
      actionSeq: player.actionSeq ?? 0,
      x: player.x,
      y: player.y,
      z: player.z,
      soulshotCount: localItemCounts[1835] ?? 0,
    });
    setPlayer({
      x: player.x,
      y: player.y,
      z: player.z,
      xp: player.xp,
      level: player.level,
      hp: player.hp,
      mp: player.mp,
      powerStrikeCooldownEndMs: player.powerStrikeCooldownEndMs,
      action: game.getCurrentAnimationClip(),
    });
    setMaxHp(player.maxHp ?? 0);
    setMaxMp(player.maxMp ?? 0);
    const weaponId = player.equippedWeaponItemId ?? 0;
    setEquippedWeaponId(weaponId > 0 ? weaponId : null);
    localItemCounts = readItemCounts(player);
    setAdena(player.adena ?? 0);
    setItems(localItemCounts);
    refreshShopDom(player);
    refreshInventoryDom(player);
    updateInteractPrompt();
  };

  mountShopWindow();
  mountInventoryWindow();
  mountNpcDialog();
  mountInteractPrompt();

  const sendInteract = (npcId: number): void => {
    room.send('interact', { npcId });
  };

  window.__interact__ = sendInteract;
  window.__buyItem__ = (npcId, itemId, quantity = 1) => {
    room.send('buy', { npcId, itemId, quantity });
  };
  window.__sellItem__ = (npcId, itemId, quantity = 1) => {
    room.send('sell', { npcId, itemId, quantity });
  };
  window.__npcAction__ = (npcId, action) => {
    room.send('npcAction', { npcId, action });
  };
  window.__equipItem__ = (itemId) => {
    room.send('equip', { itemId });
  };
  window.__openInventory__ = () => {
    const local = room.state.players.get(localId) as PlayerSchema | undefined;
    if (local) {
      renderInventoryWindow({
        itemCounts: localItemCounts,
        equippedWeaponItemId: local.equippedWeaponItemId ?? 0,
        visible: true,
        handlers: {
          sendEquip: (payload) => room.send('equip', payload),
        },
      });
    } else {
      setInventoryVisible(true);
    }
  };

  const shopPanel = mountShopWindow();
  shopPanel.addEventListener('shop-close', () => setShopOpen(false));

  const onInteractKey = (ev: KeyboardEvent): void => {
    if (ev.key !== 'e' && ev.key !== 'E') return;
    const player = getGameState().player;
    const nearest = findNearestInteractableNpc({ x: player.x, z: player.z }, npcPresences);
    if (!nearest?.canInteract) return;
    ev.preventDefault();
    sendInteract(nearest.npcId);
  };
  window.addEventListener('keydown', onInteractKey);

  const onInventoryKey = (ev: KeyboardEvent): void => {
    if (ev.key !== 'i' && ev.key !== 'I') return;
    ev.preventDefault();
    const local = room.state.players.get(localId) as PlayerSchema | undefined;
    const nextVisible = !isInventoryVisible();
    if (local) {
      renderInventoryWindow({
        itemCounts: localItemCounts,
        equippedWeaponItemId: local.equippedWeaponItemId ?? 0,
        visible: nextVisible,
        handlers: {
          sendEquip: (payload) => room.send('equip', payload),
        },
      });
    } else {
      setInventoryVisible(nextVisible);
    }
  };
  window.addEventListener('keydown', onInventoryKey);

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
        setShopOpen(true);
        setNpcDialogVisible(false);
        fireNpcGreet(KATERINA_NPC_ID);
      },
      openDialog: (npcId, name) => {
        setShopVisible(false);
        setShopOpen(false);
        renderNpcDialog({
          npcId,
          name,
          visible: true,
          handlers: {
            sendNpcAction: (payload) => room.send('npcAction', payload),
          },
        });
        fireNpcGreet(npcId);
      },
    });
  });

  callbacks.onAdd('players', (player, sessionId) => {
    const id = sessionId as string;
    const state = player as PlayerSchema;
    if (id === localId) {
      syncLocal(state);
      callbacks.onChange(state, () => syncLocal(state));
      bindLocalPlayerItems(state);
      return;
    }

    game.syncRemotePlayer(id, {
      x: state.x,
      y: state.y,
      z: state.z,
      action: state.action,
      actionSeq: state.actionSeq,
      equippedWeaponItemId: state.equippedWeaponItemId ?? 0,
    });
    publishOthers();
    callbacks.onChange(state, () => {
      game.syncRemotePlayer(id, {
        x: state.x,
        y: state.y,
        z: state.z,
        action: state.action,
        actionSeq: state.actionSeq,
        equippedWeaponItemId: state.equippedWeaponItemId ?? 0,
      });
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
      npcId: mob.npcId,
      x: mob.x,
      y: mob.y,
      z: mob.z,
      hp: mob.hp,
      maxHp: mob.maxHp,
      action: mob.action,
      actionSeq: mob.actionSeq,
    });
    game.syncMobVfx({
      id: mobId,
      hp: mob.hp,
      x: mob.x,
      y: mob.y,
      z: mob.z,
      action: mob.action ?? 0,
      actionSeq: mob.actionSeq ?? 0,
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
      name: npc.name,
      x: npc.x,
      y: npc.y,
      z: npc.z,
      type: npc.type,
    };
    if (idx >= 0) npcPresences[idx] = presence;
    else npcPresences.push(presence);
    publishNpcsToHook();
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

  game.setAfterTick(() => {
    publishNpcsToHook();
  });
}
