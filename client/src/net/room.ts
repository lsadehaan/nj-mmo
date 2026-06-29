import { Client, Room, Callbacks } from '@colyseus/sdk';
import { EntityAction } from '@nj/game-core';
import type { AnimationClip } from '@nj/game-core';
import { setConnected, setCharacterId, setOthers, setMobs, setPlayer, setAdena, setItems, setNpcs, setNearbyNpc, setShopOpen, setEquippedWeaponId, setMaxHp, setMaxMp, effectsFromBuffSkillId, setQuests, getGameState } from '../test-hook';
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
import { mountQuestLog, renderQuestLog, isQuestLogVisible, setQuestLogVisible, entriesFromQuestState } from '../ui/quest-log';
import { getLearnableSkillIds } from '../ui/trainer-skills';
import { renderHotbar } from '../ui/hotbar';
import { updateCastBar } from '../ui/cast-bar';
import {
  findNearestInteractableNpc,
  mountInteractPrompt,
  openNpcUiForInteract,
  setInteractPromptVisible,
  KATERINA_NPC_ID,
  ROXXY_NPC_ID,
  type NpcPresence,
} from '../npc-interaction';
import { getPlayerManifestEntry } from '../scene/creature/player-manifest';

const DEFAULT_ENDPOINT =
  import.meta.env.VITE_COLYSEUS_ENDPOINT ?? 'http://localhost:2567';

export const CHARACTER_ID_STORAGE_KEY = 'nj.characterId';

export interface CreateCharacterOptions {
  classId: number;
  sex: 0 | 1;
}

export function getStoredCharacterId(): string | null {
  return localStorage.getItem(CHARACTER_ID_STORAGE_KEY);
}

export function storeCharacterId(id: string): void {
  localStorage.setItem(CHARACTER_ID_STORAGE_KEY, id);
}

export async function connect(
  endpoint = DEFAULT_ENDPOINT,
  options: { create?: CreateCharacterOptions } = {}
): Promise<Room> {
  const client = new Client(endpoint);
  const characterId = getStoredCharacterId();
  if (characterId) {
    setCharacterId(characterId);
  }
  const joinOptions: Record<string, unknown> = characterId
    ? { characterId }
    : options.create
      ? { create: options.create }
      : {};
  const room = await client.joinOrCreate('town', joinOptions);

  room.onMessage('characterId', (id: string) => {
    storeCharacterId(id);
    setCharacterId(id);
  });

  setConnected(true);
  return room;
}

export async function connectSafe(
  endpoint = DEFAULT_ENDPOINT,
  options: { create?: CreateCharacterOptions } = {}
): Promise<Room | null> {
  try {
    return await connect(endpoint, options);
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
    classId?: number;
    sex?: number;
    str?: number;
    dex?: number;
    con?: number;
    int?: number;
    wit?: number;
    men?: number;
    xp: number;
    level: number;
    hp: number;
    maxHp: number;
    mp: number;
    maxMp: number;
    adena: number;
    equippedWeaponItemId: number;
    powerStrikeCooldownEndMs: number;
    healingPotionCooldownEndMs: number;
    knownSkillIds?: { length: number; [index: number]: number };
    skillCooldownEndMs?: { length: number; [index: number]: number };
    castingSkillId?: number;
    castEndMs?: number;
    activeBuffSkillId?: number;
    action?: number;
    actionSeq?: number;
    items: { entries: () => Iterable<[string, { itemId: number; count: number }]> };
    questEntries?: {
      length: number;
      [index: number]: {
        questId: number;
        status: string;
        step: number;
      };
    };
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

  const mobActionClip = (actionNum: number | undefined, fallback: AnimationClip): AnimationClip => {
    switch (actionNum) {
      case EntityAction.Attack:
        return 'attack';
      case EntityAction.Cast:
        return 'cast';
      case EntityAction.Die:
        return 'die';
      default:
        return fallback;
    }
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
        action: mobActionClip(state.action, hook?.action ?? 'idle'),
        actionSeq: state.actionSeq ?? hook?.actionSeq ?? 0,
      };
    });
    for (const [id, hook] of hookById) {
      if (!mobsMap.has(id)) merged.push(hook);
    }
    setMobs(merged);
  };

  let localItemCounts: Record<number, number> = {};
  let activeShopNpcId = KATERINA_NPC_ID;
  let activeShopMerchantName = 'Katerina';
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

  const readNumberArray = (
    arr: { length: number; [index: number]: number } | undefined
  ): number[] => {
    if (!arr) return [];
    const out: number[] = [];
    for (let i = 0; i < arr.length; i++) {
      out.push(arr[i] as number);
    }
    return out;
  };

  const inventoryHandlers = () => ({
    sendEquip: (payload: { itemId: number }) => room.send('equip', payload),
    sendUseItem: (payload: { itemId: number }) => room.send('useItem', payload),
    sendUseShot: (payload: { itemId: number }) => room.send('useShot', payload),
  });

  const refreshHotbarDom = (player: PlayerSchema, nowMs = Date.now()): void => {
    const knownSkillIds = readNumberArray(player.knownSkillIds);
    const skillCooldownEndMs = readNumberArray(player.skillCooldownEndMs);
    renderHotbar({
      knownSkillIds,
      skillCooldownEndMs,
      nowMs,
      handlers: { onUseSkill: (skillId) => room.send('useSkill', { skillId }) },
    });
    updateCastBar({
      castingSkillId: player.castingSkillId ?? 0,
      castEndMs: player.castEndMs ?? 0,
      nowMs,
    });
  };

  const refreshShopDom = (player: PlayerSchema): void => {
    renderShopWindow({
      npcId: activeShopNpcId,
      merchantName: activeShopMerchantName,
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
    const { player: hookPlayer } = getGameState();
    renderInventoryWindow({
      itemCounts: localItemCounts,
      equippedWeaponItemId: player.equippedWeaponItemId ?? 0,
      healingPotionCooldownRemainingMs: hookPlayer.healingPotionCooldownRemainingMs,
      visible: isInventoryVisible(),
      handlers: inventoryHandlers(),
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
    const classId = player.classId ?? 0;
    const sex = player.sex ?? 0;
    const manifest = getPlayerManifestEntry(classId);
    game.syncLocalPlayer(
      player.x,
      player.y,
      player.z,
      player.action ?? 0,
      player.actionSeq ?? 0,
      player.equippedWeaponItemId ?? 0,
      classId,
      sex
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
    const knownSkillIds = readNumberArray(player.knownSkillIds);
    const skillCooldownEndMs = readNumberArray(player.skillCooldownEndMs);
    const activeBuffSkillId = player.activeBuffSkillId ?? 0;
    setPlayer({
      x: player.x,
      y: player.y,
      z: player.z,
      xp: player.xp,
      level: player.level,
      hp: player.hp,
      mp: player.mp,
      classId,
      sex,
      str: player.str ?? 40,
      dex: player.dex ?? 30,
      con: player.con ?? 43,
      int: player.int ?? 21,
      wit: player.wit ?? 11,
      men: player.men ?? 25,
      avatarModel: manifest.model,
      knownSkillIds,
      skillCooldownEndMs,
      castingSkillId: player.castingSkillId ?? 0,
      castEndMs: player.castEndMs ?? 0,
      effects: effectsFromBuffSkillId(activeBuffSkillId),
      powerStrikeCooldownEndMs: player.powerStrikeCooldownEndMs,
      healingPotionCooldownEndMs: player.healingPotionCooldownEndMs ?? 0,
      action: game.getCurrentAnimationClip(),
    });
    refreshHotbarDom(player);
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

  const readQuestEntries = (
    player: PlayerSchema
  ): { questId: number; status: string; step: number }[] => {
    const arr = player.questEntries;
    if (!arr) return [];
    const out: { questId: number; status: string; step: number }[] = [];
    for (let i = 0; i < arr.length; i++) {
      const e = arr[i]!;
      out.push({ questId: e.questId, status: e.status, step: e.step });
    }
    return out;
  };

  const refreshQuestLogDom = (player: PlayerSchema): void => {
    const entries = readQuestEntries(player);
    setQuests(entries);
    const { active, completed } = entriesFromQuestState(entries);
    renderQuestLog({ active, completed, visible: isQuestLogVisible() });
  };

  const bindLocalPlayerQuests = (player: PlayerSchema): void => {
    const onQuestsChanged = (): void => refreshQuestLogDom(player);
    const collectionCallbacks = callbacks as {
      onAdd: (
        instance: PlayerSchema,
        property: 'questEntries',
        handler: (entry: { questId: number; status: string; step: number }) => void,
        immediate?: boolean
      ) => void;
      onChange: (instance: PlayerSchema, property: 'questEntries', handler: () => void) => void;
      onRemove: (instance: PlayerSchema, property: 'questEntries', handler: () => void) => void;
      listen: (
        instance: { questId: number; status: string; step: number },
        property: 'step' | 'status' | 'questId',
        handler: () => void
      ) => void;
    };
    collectionCallbacks.onAdd(
      player,
      'questEntries',
      (entry) => {
        onQuestsChanged();
        collectionCallbacks.listen(entry, 'step', onQuestsChanged);
        collectionCallbacks.listen(entry, 'status', onQuestsChanged);
      },
      true
    );
    collectionCallbacks.onChange(player, 'questEntries', onQuestsChanged);
    collectionCallbacks.onRemove(player, 'questEntries', onQuestsChanged);
  };

  mountShopWindow();
  mountInventoryWindow();
  mountNpcDialog();
  mountQuestLog();
  mountInteractPrompt();

  window.__questAction__ = (npcId, action) => {
    room.send('questAction', { npcId, action });
  };

  window.__toggleQuestLog__ = () => {
    const local = room.state.players.get(localId) as PlayerSchema | undefined;
    const next = !isQuestLogVisible();
    setQuestLogVisible(next);
    if (local) refreshQuestLogDom(local);
  };

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
  window.__useItem__ = (itemId) => {
    room.send('useItem', { itemId });
  };

  window.__useShot__ = (itemId) => {
    room.send('useShot', { itemId });
  };

  window.__learnSkill__ = (skillId) => {
    room.send('learnSkill', { skillId });
  };

  window.__openInventory__ = () => {
    const local = room.state.players.get(localId) as PlayerSchema | undefined;
    if (local) {
      const { player: hookPlayer } = getGameState();
      renderInventoryWindow({
        itemCounts: localItemCounts,
        equippedWeaponItemId: local.equippedWeaponItemId ?? 0,
        healingPotionCooldownRemainingMs: hookPlayer.healingPotionCooldownRemainingMs,
        visible: true,
        handlers: inventoryHandlers(),
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
      const { player: hookPlayer } = getGameState();
      renderInventoryWindow({
        itemCounts: localItemCounts,
        equippedWeaponItemId: local.equippedWeaponItemId ?? 0,
        healingPotionCooldownRemainingMs: hookPlayer.healingPotionCooldownRemainingMs,
        visible: nextVisible,
        handlers: inventoryHandlers(),
      });
    } else {
      setInventoryVisible(nextVisible);
    }
  };
  window.addEventListener('keydown', onInventoryKey);

  const onQuestLogKey = (ev: KeyboardEvent): void => {
    if (ev.key !== 'q' && ev.key !== 'Q') return;
    ev.preventDefault();
    window.__toggleQuestLog__?.();
  };
  window.addEventListener('keydown', onQuestLogKey);

  room.onMessage(
    'questDialog',
    (message: {
      npcId: number;
      questId: number;
      title: string;
      body: string;
      buttons: { action: string; label: string }[];
      levelTooLow?: boolean;
    }) => {
      setShopVisible(false);
      setShopOpen(false);
      renderNpcDialog({
        npcId: message.npcId,
        name: message.title,
        variant: 'quest',
        visible: true,
        questBody: message.body,
        questButtons: message.buttons,
        handlers: {
          sendNpcAction: (payload) => room.send('npcAction', payload),
          sendQuestAction: (payload) => room.send('questAction', payload),
        },
      });
    }
  );

  room.onMessage('interactResult', (message: { npcId: number; type: string; name: string; questAvailable?: boolean }) => {
    openNpcUiForInteract(
      message,
      {
      openShop: (npcId, merchantName) => {
        activeShopNpcId = npcId;
        activeShopMerchantName = merchantName;
        const local = room.state.players.get(localId) as PlayerSchema | undefined;
        if (local) {
          renderShopWindow({
            npcId,
            merchantName,
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
        fireNpcGreet(npcId);
      },
      openDialog: (npcId, name, variant) => {
        setShopVisible(false);
        setShopOpen(false);
        const local = room.state.players.get(localId) as PlayerSchema | undefined;
        const hookPlayer = getGameState().player;
        const classId = local?.classId ?? hookPlayer.classId;
        const knownSkillIds = local
          ? readNumberArray(local.knownSkillIds)
          : hookPlayer.knownSkillIds;
        renderNpcDialog({
          npcId,
          name,
          variant,
          visible: true,
          learnableSkillIds:
            variant === 'trainer' || variant === 'folkTrainer'
              ? getLearnableSkillIds(npcId, classId, knownSkillIds)
              : undefined,
          handlers: {
            sendNpcAction: (payload) => room.send('npcAction', payload),
            sendLearnSkill: (payload) => room.send('learnSkill', payload),
          },
        });
        fireNpcGreet(npcId);
      },
      openQuestChooser: (npcId, merchantName) => {
        setShopVisible(false);
        renderNpcDialog({
          npcId,
          name: merchantName,
          variant: 'quest',
          visible: true,
          questBody: 'What would you like to do?',
          questButtons: [
            { action: 'open_shop', label: 'Shop' },
            { action: 'open_quest', label: 'Quest' },
          ],
          handlers: {
            sendNpcAction: (payload) => room.send('npcAction', payload),
            sendQuestAction: (payload) => {
              if (payload.action === 'open_shop') {
                const local = room.state.players.get(localId) as PlayerSchema | undefined;
                activeShopNpcId = npcId;
                activeShopMerchantName = merchantName;
                if (local) {
                  renderShopWindow({
                    npcId,
                    merchantName,
                    adena: local.adena ?? 0,
                    itemCounts: localItemCounts,
                    visible: true,
                    handlers: {
                      sendBuy: (p) => room.send('buy', p),
                      sendSell: (p) => room.send('sell', p),
                    },
                  });
                }
                setShopOpen(true);
                setNpcDialogVisible(false);
              } else if (payload.action === 'open_quest') {
                room.send('interact', { npcId });
              }
            },
          },
        });
      },
    },
      Boolean(message.questAvailable)
    );
  });

  callbacks.onAdd('players', (player, sessionId) => {
    const id = sessionId as string;
    const state = player as PlayerSchema;
    if (id === localId) {
      syncLocal(state);
      callbacks.onChange(state, () => syncLocal(state));
      bindLocalPlayerItems(state);
      bindLocalPlayerQuests(state);
      refreshQuestLogDom(state);
      return;
    }

    game.syncRemotePlayer(id, {
      x: state.x,
      y: state.y,
      z: state.z,
      action: state.action,
      actionSeq: state.actionSeq,
      equippedWeaponItemId: state.equippedWeaponItemId ?? 0,
      classId: state.classId ?? 0,
      sex: state.sex ?? 0,
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
        classId: state.classId ?? 0,
        sex: state.sex ?? 0,
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
