import { Client, Room, Callbacks } from '@colyseus/sdk';
import { EntityAction, EQUIP_SLOTS, MOB_RENDER_DISTANCE, SpatialHash } from '@nj/game-core';
import type { AnimationClip } from '@nj/game-core';
import { setConnected, setCharacterId, setOthers, setMobs, setPlayer, setAdena, setItems, setWarehouse, setNpcs, setNearbyNpc, setShopOpen, setEquippedWeaponId, setEquipment, setPlayerPDef, setMaxHp, setMaxMp, effectsFromBuffSkillId, setQuests, getGameState, setZone, appendChatLine, setParty, setTrade, setFriends, setPlayerInventoryMetrics, setPlayerActiveEffects, setTargetMobId, setTargetPlayerSessionId } from '../test-hook';
import { getZoneAt } from '@nj/game-core';
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
} from '../ui/inventory-window';
import { renderEquipmentPanel } from '../ui/equipment-panel';
import {
  mountNpcDialog,
  renderNpcDialog,
  setNpcDialogVisible,
  ROXXY_TELEPORT_DESTINATIONS,
  FIGHTER_CLASS_TRANSFER_OPTIONS,
  MYSTIC_CLASS_TRANSFER_OPTIONS,
  BITZ_NPC_ID,
  BIOTIN_NPC_ID,
  WILFORD_NPC_ID,
} from '../ui/npc-dialog';
import { renderWarehouseWindow } from '../ui/warehouse-window';
import { mountQuestLog, renderQuestLog, entriesFromQuestState } from '../ui/quest-log';
import { mountChatPanel, wireChatPanel, renderChatLog } from '../ui/chat-panel';
import { mountPartyPanel, wirePartyPanel, renderPartyPanel, type PartyMemberView } from '../ui/party-panel';
import { mountTradeWindow, wireTradeWindow, renderTradeWindow } from '../ui/trade-window';
import { mountFriendsPanel, wireFriendsPanel, renderFriendsPanel } from '../ui/friends-panel';
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
import { renderSkillWindow } from '../ui/skill-window';
import { renderQuestTracker } from '../ui/quest-tracker';
import { renderMinimap } from '../ui/minimap';
import { renderEffectBars } from '../ui/buff-debuff-bars';
import { renderTargetFrame } from '../ui/target-frame';
import { publishUiState, isPanelOpen, togglePanel, openPanel } from '../ui/window-manager';
import type { AudioManager } from '../audio/audio-manager';

export const DEFAULT_COLYSEUS_ENDPOINT =
  import.meta.env.VITE_COLYSEUS_ENDPOINT ?? 'http://localhost:2567';

const DEFAULT_ENDPOINT = DEFAULT_COLYSEUS_ENDPOINT;

export const CHARACTER_ID_STORAGE_KEY = 'nj.characterId';

export interface CreateCharacterOptions {
  classId: number;
  sex: 0 | 1;
  accountName?: string;
  name?: string;
}

export function getStoredCharacterId(): string | null {
  return localStorage.getItem(CHARACTER_ID_STORAGE_KEY);
}

export function storeCharacterId(id: string): void {
  localStorage.setItem(CHARACTER_ID_STORAGE_KEY, id);
}

export async function connect(
  endpoint = DEFAULT_ENDPOINT,
  options: {
    create?: CreateCharacterOptions;
    characterId?: string;
    accountName?: string;
  } = {}
): Promise<Room> {
  const client = new Client(endpoint);
  // An explicit `create` request always means "make a new character" — never
  // fall back to a previously stored characterId, or we'd silently rejoin an
  // existing character instead of creating the new one.
  const characterId = options.characterId ?? (options.create ? undefined : getStoredCharacterId());
  if (characterId) {
    setCharacterId(characterId);
  }
  const joinOptions: Record<string, unknown> = characterId
    ? {
        characterId,
        ...(options.accountName ? { accountName: options.accountName } : {}),
      }
    : options.create
      ? { create: options.create }
      : {};
  const room = await client.joinOrCreate('town', joinOptions);
  await waitForRoomState(room);
  await waitForRoomMobs(room);

  room.onMessage('characterId', (id: string) => {
    storeCharacterId(id);
    setCharacterId(id);
  });

  setConnected(true);
  return room;
}

/** Colyseus resolves join before the first ROOM_STATE patch — wait for local player. */
export function waitForRoomState(room: Room, timeoutMs = 10_000): Promise<void> {
  const hasLocalPlayer = (): boolean => {
    const players = (room.state as { players?: Map<string, unknown> } | undefined)?.players;
    return Boolean(players?.get?.(room.sessionId));
  };

  if (hasLocalPlayer()) return Promise.resolve();

  const onStateChange = room.onStateChange;
  if (typeof onStateChange !== 'function') return Promise.resolve();

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      onStateChange.remove(onChange);
      reject(new Error('Timed out waiting for room state'));
    }, timeoutMs);

    const onChange = (): void => {
      if (!hasLocalPlayer()) return;
      clearTimeout(timer);
      onStateChange.remove(onChange);
      resolve();
    };

    onStateChange(onChange);
    onChange();
  });
}

/** Mobs may arrive in a later patch than the local player. */
export function waitForRoomMobs(room: Room, timeoutMs = 15_000): Promise<void> {
  const mobCount = (): number => {
    const mobs = (room.state as { mobs?: { size?: number } } | undefined)?.mobs;
    return mobs?.size ?? 0;
  };

  if (mobCount() > 0) return Promise.resolve();

  const onStateChange = room.onStateChange;
  if (typeof onStateChange !== 'function') return Promise.resolve();

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      onStateChange.remove(onChange);
      resolve();
    }, timeoutMs);

    const onChange = (): void => {
      if (mobCount() <= 0) return;
      clearTimeout(timer);
      onStateChange.remove(onChange);
      resolve();
    };

    onStateChange(onChange);
    onChange();
  });
}

export async function connectSafe(
  endpoint = DEFAULT_ENDPOINT,
  options: {
    create?: CreateCharacterOptions;
    characterId?: string;
    accountName?: string;
  } = {}
): Promise<Room | null> {
  try {
    return await connect(endpoint, options);
  } catch {
    setConnected(false);
    return null;
  }
}

export function wireRoom(
  room: Room,
  game: GameRenderer,
  options?: { audioManager?: AudioManager }
): void {
  const audioManager = options?.audioManager;
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
    equipItemIds?: { length: number; [index: number]: number };
    equipEnchantLevels?: { length: number; [index: number]: number };
    pDef?: number;
    powerStrikeCooldownEndMs: number;
    healingPotionCooldownEndMs: number;
    sp?: number;
    karma?: number;
    pvpFlag?: number;
    expBeforeDeath?: number;
    unspentStatPoints?: number;
    knownSkillIds?: { length: number; [index: number]: number };
    skillCooldownEndMs?: { length: number; [index: number]: number };
    castingSkillId?: number;
    castEndMs?: number;
    activeBuffSkillId?: number;
    inventoryWeight?: number;
    maxLoad?: number;
    inventorySlotsUsed?: number;
    characterName?: string;
    activeEffects?: {
      length: number;
      [index: number]: { skillId: number; kind: string; expiresAtMs: number };
    };
    action?: number;
    actionSeq?: number;
    zoneId?: string;
    partyId?: number;
    warehouseItemIds?: { length: number; [index: number]: number };
    warehouseItemCounts?: { length: number; [index: number]: number };
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
    name?: string;
    level?: number;
    x: number;
    y: number;
    z: number;
    hp: number;
    maxHp: number;
    aggroTargetSessionId?: string;
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

  const mobRenderDistSq = MOB_RENDER_DISTANCE * MOB_RENDER_DISTANCE;
  const mobSpatialIndex = new SpatialHash<string>(MOB_RENDER_DISTANCE);

  const indexMob = (mobId: string, mob: MobSchema): void => {
    mobSpatialIndex.set(mobId, mob.x, mob.z);
  };

  const collectRelevantMobIds = (local: PlayerSchema): string[] => {
    const ids = mobSpatialIndex.queryRadius(local.x, local.z, MOB_RENDER_DISTANCE);
    const targetId = getGameState().targetMobId;
    if (targetId && !ids.includes(targetId) && room.state.mobs?.has(targetId)) {
      ids.push(targetId);
    }
    return ids;
  };

  const isMobVisuallyRelevant = (
    mobId: string,
    mobX: number,
    mobZ: number,
    local: PlayerSchema | undefined
  ): boolean => {
    if (!local) return false;
    if (mobId === getGameState().targetMobId) return true;
    const dx = mobX - local.x;
    const dz = mobZ - local.z;
    return dx * dx + dz * dz <= mobRenderDistSq;
  };

  const pushMobToGame = (mobId: string, mob: MobSchema): void => {
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
    audioManager?.syncMob({ id: mobId, hp: mob.hp });
  };

  const publishMobs = (): void => {
    const local = room.state.players.get(localId) as PlayerSchema | undefined;
    const hookById = new Map((game.getMobHookEntries?.() ?? []).map((mob) => [mob.id, mob]));
    const mobsMap = room.state.mobs;
    if (!mobsMap) {
      setMobs([...hookById.values()]);
      return;
    }
    const relevantIds = local ? collectRelevantMobIds(local) : [];
    const merged = relevantIds.map((id) => {
      const mob = mobsMap.get(id) as MobSchema | undefined;
      if (!mob) return null;
      const hook = hookById.get(id);
      return {
        id,
        npcId: mob.npcId,
        name: mob.name || hook?.name,
        level: mob.level || hook?.level,
        x: mob.x,
        y: mob.y,
        z: mob.z,
        hp: mob.hp,
        maxHp: mob.maxHp,
        aggroTargetSessionId: mob.aggroTargetSessionId || undefined,
        action: mobActionClip(mob.action, hook?.action ?? 'idle'),
        actionSeq: mob.actionSeq ?? hook?.actionSeq ?? 0,
      };
    }).filter((entry): entry is NonNullable<typeof entry> => entry !== null);
    for (const [id, hook] of hookById) {
      if (!mobsMap.has(id)) merged.push({ ...hook, aggroTargetSessionId: undefined });
    }
    setMobs(merged);
  };

  let mobPublishQueued = false;
  const schedulePublishMobs = (): void => {
    if (mobPublishQueued) return;
    mobPublishQueued = true;
    queueMicrotask(() => {
      mobPublishQueued = false;
      publishMobs();
    });
  };

  const MOB_SCAN_MOVE_THRESHOLD_SQ = 25;
  let lastMobScanX = Number.NaN;
  let lastMobScanZ = Number.NaN;

  const syncMobsInRenderRange = (): void => {
    const local = room.state.players.get(localId) as PlayerSchema | undefined;
    if (!local || !room.state.mobs) return;
    for (const id of collectRelevantMobIds(local)) {
      const mob = room.state.mobs.get(id) as MobSchema | undefined;
      if (mob) pushMobToGame(id, mob);
    }
    schedulePublishMobs();
  };

  const onMobStateChange = (mobId: string, mob: MobSchema): void => {
    indexMob(mobId, mob);
    syncMobFromState(mobId, mob);
  };

  const syncMobFromState = (mobId: string, mob: MobSchema): void => {
    const local = room.state.players.get(localId) as PlayerSchema | undefined;
    if (!isMobVisuallyRelevant(mobId, mob.x, mob.z, local)) {
      return;
    }
    pushMobToGame(mobId, mob);
    schedulePublishMobs();
  };

  let localItemCounts: Record<number, number> = {};
  let activeShopNpcId = KATERINA_NPC_ID;
  let activeShopMerchantName = 'Katerina';
  const npcPresences: NpcPresence[] = [];
  let greetUiEpoch = 0;
  let tradePartnerSessionId: string | null = null;
  let tradeMyOffer: { items: { itemId: number; count: number }[]; adena: number } | null = null;
  let tradePartnerOffer: { items: { itemId: number; count: number }[]; adena: number } | null = null;
  let tradeMyConfirmed = false;
  let tradePartnerConfirmed = false;

  const buildPartyMemberViews = (
    memberSessionIds: string[],
    leaderSessionId: string
  ): PartyMemberView[] =>
    memberSessionIds.map((sessionId) => {
      const member = room.state.players.get(sessionId) as PlayerSchema | undefined;
      return {
        sessionId,
        name: member?.characterName || sessionId.slice(0, 8),
        hp: member?.hp ?? 0,
        maxHp: member?.maxHp ?? 100,
        mp: member?.mp ?? 0,
        maxMp: member?.maxMp ?? 50,
        isLeader: sessionId === leaderSessionId,
      };
    });

  const syncPartyFromState = (player: PlayerSchema): void => {
    const partyId = player.partyId ?? 0;
    if (partyId === 0) {
      setParty(null);
      renderPartyPanel([]);
      return;
    }
    const parties = (room.state as { parties?: Map<string, { leaderSessionId: string; memberSessionIds: { length: number; [i: number]: string } }> }).parties;
    const party = parties?.get(String(partyId));
    if (!party) {
      setParty(null);
      renderPartyPanel([]);
      return;
    }
    const memberSessionIds = readStringArray(party.memberSessionIds);
    setParty({ partyId, leaderSessionId: party.leaderSessionId, memberSessionIds });
    renderPartyPanel(buildPartyMemberViews(memberSessionIds, party.leaderSessionId));
  };

  const readStringArray = (arr: { length: number; [index: number]: string } | undefined): string[] => {
    if (!arr) return [];
    const out: string[] = [];
    for (let i = 0; i < arr.length; i++) out.push(arr[i] as string);
    return out;
  };

  const publishTradeState = (status: string): void => {
    const snapshot = tradePartnerSessionId
      ? {
          status,
          partnerSessionId: tradePartnerSessionId,
          myOffer: tradeMyOffer,
          partnerOffer: tradePartnerOffer,
          myConfirmed: tradeMyConfirmed,
          partnerConfirmed: tradePartnerConfirmed,
        }
      : null;
    setTrade(snapshot);
    renderTradeWindow(status, status !== 'closed');
  };

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

  const readActiveEffects = (
    player: PlayerSchema
  ): { skillId: number; kind: string; expiresAtMs: number }[] => {
    const arr = player.activeEffects;
    if (!arr) return [];
    const out: { skillId: number; kind: string; expiresAtMs: number }[] = [];
    for (let i = 0; i < arr.length; i++) {
      const e = arr[i]!;
      out.push({ skillId: e.skillId, kind: e.kind, expiresAtMs: e.expiresAtMs });
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
    const { player: hookPlayer, equipment } = getGameState();
    renderInventoryWindow({
      itemCounts: localItemCounts,
      equippedWeaponItemId: player.equippedWeaponItemId ?? 0,
      equipment,
      inventoryWeight: player.inventoryWeight ?? hookPlayer.inventoryWeight,
      maxLoad: player.maxLoad ?? hookPlayer.maxLoad,
      slotsUsed: player.inventorySlotsUsed ?? hookPlayer.inventorySlotsUsed,
      healingPotionCooldownRemainingMs: hookPlayer.healingPotionCooldownRemainingMs,
      visible: isPanelOpen('inventory-window'),
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
    const prevScanX = lastMobScanX;
    const prevScanZ = lastMobScanZ;
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
    if (player.characterName) game.setLocalPlayerName(player.characterName);
    const scanDx = player.x - prevScanX;
    const scanDz = player.z - prevScanZ;
    if (
      !Number.isFinite(prevScanX) ||
      scanDx * scanDx + scanDz * scanDz >= MOB_SCAN_MOVE_THRESHOLD_SQ
    ) {
      lastMobScanX = player.x;
      lastMobScanZ = player.z;
      syncMobsInRenderRange();
    }
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
    const hook = getGameState().player;
    setPlayer({
      ...hook,
      x: player.x,
      y: player.y,
      z: player.z,
      hp: player.hp,
      mp: player.mp,
      action: game.getCurrentAnimationClip(),
    });
    const uiSig = fullUiSignature(player);
    if (uiSig !== lastFullUiSig) {
      lastFullUiSig = uiSig;
      scheduleLocalUi(player);
    } else {
      const zoneHit = getZoneAt(player.x, player.z);
      const zoneId = player.zoneId ?? zoneHit.zoneId;
      const zoneChanged = getGameState().zone.id !== zoneId;
      const now = performance.now();
      if (zoneChanged || now - lastMotionUiAt >= MOTION_UI_INTERVAL_MS) {
        lastMotionUiAt = now;
        syncLocalMotionUi(player);
      }
    }
  };

  let pendingLocalUiPlayer: PlayerSchema | null = null;
  let localUiRaf = 0;
  let lastFullUiSig = '';
  let lastMotionUiAt = 0;
  const MOTION_UI_INTERVAL_MS = 150;

  const fullUiSignature = (player: PlayerSchema): string => {
    return [
      player.hp,
      player.mp,
      player.maxHp,
      player.maxMp,
      player.level,
      player.xp,
      player.adena,
      player.equippedWeaponItemId,
      player.pDef,
      player.sp,
      player.pvpFlag,
      player.karma,
      player.unspentStatPoints,
      player.activeBuffSkillId,
      player.castingSkillId,
      player.castEndMs,
      player.partyId,
      player.inventoryWeight,
      player.inventorySlotsUsed,
      player.powerStrikeCooldownEndMs,
      player.healingPotionCooldownEndMs,
      readNumberArray(player.equipItemIds).join(','),
      readNumberArray(player.equipEnchantLevels).join(','),
      readNumberArray(player.knownSkillIds).join(','),
      readNumberArray(player.skillCooldownEndMs).join(','),
      readNumberArray(player.warehouseItemIds).join(','),
      player.questEntries?.length ?? 0,
    ].join('|');
  };

  const syncLocalMotionUi = (player: PlayerSchema): void => {
    const zoneHit = getZoneAt(player.x, player.z);
    const zoneId = player.zoneId ?? zoneHit.zoneId;
    const { zone, party, targetMobId, targetPlayerSessionId, mobs, others } = getGameState();
    if (zone.id !== zoneId) {
      setZone({
        id: zoneId,
        type: zoneHit.type,
        displayName: zoneHit.displayName,
      });
      audioManager?.syncZone(zoneId);
    }
    audioManager?.syncPlayer({
      hp: player.hp,
      level: player.level,
      action: (player.action ?? 0) as EntityAction,
      actionSeq: player.actionSeq ?? 0,
      x: player.x,
      y: player.y,
      z: player.z,
      soulshotCount: localItemCounts[1835] ?? 0,
    });
    updateInteractPrompt();
    renderMinimap({
      playerX: player.x,
      playerZ: player.z,
      zoneDisplayName: zone.displayName,
      partyPositions: party?.memberSessionIds
        .filter((sid) => sid !== localId)
        .map((sid) => {
          const member = room.state.players.get(sid) as PlayerSchema | undefined;
          return member
            ? { sessionId: sid, x: member.x, z: member.z }
            : { sessionId: sid, x: 0, z: 0 };
        }),
    });
    refreshTargetFrames(targetMobId, targetPlayerSessionId, mobs, others, room);
  };

  const syncLocalHudPanels = (player: PlayerSchema): void => {
    const classId = player.classId ?? 0;
    const sex = player.sex ?? 0;
    const manifest = getPlayerManifestEntry(classId);
    const zoneHit = getZoneAt(player.x, player.z);
    const zoneId = player.zoneId ?? zoneHit.zoneId;
    audioManager?.syncCombat(getGameState().targetMobId);
    audioManager?.publishHook();
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
      sp: player.sp ?? 0,
      karma: player.karma ?? 0,
      pvpFlag: player.pvpFlag ?? 0,
      expBeforeDeath: player.expBeforeDeath ?? 0,
      unspentStatPoints: player.unspentStatPoints ?? 0,
      action: game.getCurrentAnimationClip(),
    });
    setPlayerInventoryMetrics({
      inventoryWeight: player.inventoryWeight ?? 0,
      maxLoad: player.maxLoad ?? 2967,
      inventorySlotsUsed: player.inventorySlotsUsed ?? 0,
    });
    const activeEffects = readActiveEffects(player);
    setPlayerActiveEffects(activeEffects);
    renderEffectBars(activeEffects, Date.now());
    renderSkillWindow({
      knownSkillIds,
      skillCooldownEndMs,
      sp: player.sp ?? 0,
      nowMs: Date.now(),
      visible: isPanelOpen('skill-window'),
      onUseSkill: (skillId) => window.__useSkill__?.(skillId),
    });
    refreshHotbarDom(player);
    setMaxHp(player.maxHp ?? 0);
    setMaxMp(player.maxMp ?? 0);
    const weaponId = player.equippedWeaponItemId ?? 0;
    setEquippedWeaponId(weaponId > 0 ? weaponId : null);
    const equipItemIds = readNumberArray(player.equipItemIds);
    const equipEnchants = readNumberArray(player.equipEnchantLevels);
    const equipment: Record<string, { itemId: number; enchantLevel: number }> = {};
    for (let i = 0; i < equipItemIds.length; i++) {
      const itemId = equipItemIds[i] ?? 0;
      if (itemId > 0) {
        const slot = EQUIP_SLOTS[i];
        if (slot) {
          equipment[slot] = { itemId, enchantLevel: equipEnchants[i] ?? 0 };
        }
      }
    }
    setEquipment(equipment);
    setPlayerPDef(player.pDef ?? 0);
    renderEquipmentPanel();
    localItemCounts = readItemCounts(player);
    setAdena(player.adena ?? 0);
    setItems(localItemCounts);
    const warehouseCounts: Record<number, number> = {};
    const whIds = readNumberArray(player.warehouseItemIds);
    const whCounts = readNumberArray(player.warehouseItemCounts);
    for (let i = 0; i < whIds.length; i++) {
      warehouseCounts[whIds[i]!] = whCounts[i] ?? 0;
    }
    setWarehouse(warehouseCounts);
    refreshShopDom(player);
    refreshInventoryDom(player);
    setZone({
      id: zoneId,
      type: zoneHit.type,
      displayName: zoneHit.displayName,
    });
    audioManager?.syncZone(zoneId);
    syncPartyFromState(player);
    const { quests } = getGameState();
    const firstActive = quests.active[0];
    renderQuestTracker(
      firstActive
        ? { title: firstActive.title, objectiveText: firstActive.objectiveText }
        : null
    );
    publishUiState();
  };

  const syncLocalUi = (player: PlayerSchema): void => {
    syncLocalHudPanels(player);
    syncLocalMotionUi(player);
  };

  const flushLocalUi = (): void => {
    const player = pendingLocalUiPlayer;
    pendingLocalUiPlayer = null;
    if (!player) return;
    syncLocalUi(player);
  };

  const scheduleLocalUi = (player: PlayerSchema): void => {
    pendingLocalUiPlayer = player;
    if (!localUiRaf) {
      localUiRaf = requestAnimationFrame(() => {
        localUiRaf = 0;
        flushLocalUi();
      });
    }
  };

  const refreshTargetFrames = (
    targetMobId: string | null,
    targetPlayerSessionId: string | null,
    mobs: ReturnType<typeof getGameState>['mobs'],
    others: ReturnType<typeof getGameState>['others'],
    roomRef: Room
  ): void => {
    if (targetMobId) {
      const mob = mobs.find((m) => m.id === targetMobId);
      const aggroSid = mob?.aggroTargetSessionId;
      const aggroPlayer = aggroSid
        ? (roomRef.state.players.get(aggroSid) as PlayerSchema | undefined)
        : undefined;
      renderTargetFrame({
        mob: mob
          ? {
              id: mob.id,
              name: mob.name || `Mob ${mob.npcId}`,
              level: mob.level,
              hp: mob.hp,
              maxHp: mob.maxHp,
              aggroTargetName: aggroPlayer?.characterName,
            }
          : null,
      });
      return;
    }
    if (targetPlayerSessionId) {
      const targetPlayer = roomRef.state.players.get(targetPlayerSessionId) as
        | PlayerSchema
        | undefined;
      const remote = others.find((o) => o.id === targetPlayerSessionId);
      renderTargetFrame({
        player: {
          sessionId: targetPlayerSessionId,
          name: targetPlayer?.characterName ?? remote?.name ?? targetPlayerSessionId,
          hp: targetPlayer?.hp ?? remote?.hp ?? 0,
          maxHp: targetPlayer?.maxHp ?? remote?.maxHp ?? 100,
          pvpFlag: targetPlayer?.pvpFlag ?? remote?.pvpFlag,
          karma: targetPlayer?.karma ?? remote?.karma,
        },
      });
      return;
    }
    renderTargetFrame({});
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
    renderQuestLog({ active, completed, visible: isPanelOpen('quest-log') });
    const firstActive = active[0];
    renderQuestTracker(
      firstActive
        ? { title: firstActive.title, objectiveText: firstActive.objectiveText }
        : null
    );
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
  mountChatPanel();
  mountPartyPanel();
  mountTradeWindow();
  mountFriendsPanel();

  wireChatPanel({ sendChat: (p) => room.send('chat', p) });
  wirePartyPanel({
    sendPartyInvite: (p) => room.send('partyInvite', p),
    sendPartyLeave: () => room.send('partyLeave', {}),
  });
  wireTradeWindow({
    sendTradeConfirm: () => room.send('tradeConfirm', {}),
    sendTradeCancel: () => room.send('tradeCancel', {}),
  });
  wireFriendsPanel({
    sendFriendAdd: (p) => room.send('friendAdd', p),
    sendFriendRemove: (p) => room.send('friendRemove', p),
  });

  window.__sendChat__ = (channel, text) => room.send('chat', { channel, text });
  window.__partyInvite__ = (targetSessionId) => room.send('partyInvite', { targetSessionId });
  window.__partyLeave__ = () => room.send('partyLeave', {});
  window.__tradeConfirm__ = () => room.send('tradeConfirm', {});
  window.__friendAdd__ = (targetSessionId) => room.send('friendAdd', { targetSessionId });

  window.__questAction__ = (npcId, action) => {
    room.send('questAction', { npcId, action });
  };

  window.__toggleQuestLog__ = () => {
    const local = room.state.players.get(localId) as PlayerSchema | undefined;
    togglePanel('quest-log');
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
  window.__togglePvp__ = () => {
    room.send('togglePvp', {});
  };
  window.__allocateStat__ = (stat: string) => {
    room.send('allocateStat', { stat });
  };
  window.__resetStats__ = () => {
    room.send('resetStats', {});
  };

  window.__openInventory__ = () => {
    openPanel('inventory-window');
    const local = room.state.players.get(localId) as PlayerSchema | undefined;
    if (local) refreshInventoryDom(local);
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
        const level = local?.level ?? hookPlayer.level;
        const classTransferOptions =
          variant === 'trainer' && classId === 0 && level >= 20
            ? FIGHTER_CLASS_TRANSFER_OPTIONS
            : variant === 'priest' && classId === 10 && level >= 20
              ? MYSTIC_CLASS_TRANSFER_OPTIONS
              : undefined;
        renderNpcDialog({
          npcId,
          name,
          variant,
          visible: true,
          learnableSkillIds:
            variant === 'trainer' || variant === 'folkTrainer'
              ? getLearnableSkillIds(npcId, classId, knownSkillIds)
              : undefined,
          teleportDestinations:
            variant === 'gatekeeper' ? ROXXY_TELEPORT_DESTINATIONS : undefined,
          classTransferOptions,
          handlers: {
            sendNpcAction: (payload) => room.send('npcAction', payload),
            sendLearnSkill: (payload) => room.send('learnSkill', payload),
            sendResetStats: () => room.send('resetStats', {}),
            sendTeleport: (payload) => room.send('teleport', { npcId, destinationId: payload.destinationId }),
            sendClassTransfer: (payload) =>
              room.send('classTransfer', { npcId, targetClassId: payload.targetClassId }),
            openWarehouse: () => {
              if (npcId !== WILFORD_NPC_ID) return;
              setNpcDialogVisible(false);
              const inv = Object.entries(localItemCounts).map(([itemId, count]) => ({
                itemId: Number(itemId),
                count,
              }));
              const wh = Object.entries(getGameState().warehouse).map(([itemId, count]) => ({
                itemId: Number(itemId),
                count,
              }));
              renderWarehouseWindow({
                npcId,
                inventory: inv,
                warehouse: wh,
                visible: true,
                handlers: {
                  sendDeposit: ({ itemId, quantity }) =>
                    room.send('warehouseDeposit', { npcId, itemId, quantity }),
                  sendWithdraw: ({ itemId, quantity }) =>
                    room.send('warehouseWithdraw', { npcId, itemId, quantity }),
                },
              });
            },
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
      syncLocalUi(state);
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
      name: state.characterName,
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
        name: state.characterName,
      });
      publishOthers();
    });
  }, true);

  callbacks.onRemove('players', (_player, sessionId) => {
    const id = sessionId as string;
    if (id !== localId) {
      game.removeRemotePlayer(id);
      publishOthers();
    }
  });

  const wiredMobIds = new Set<string>();
  let mobsBootstrapped = false;

  const bootstrapMobsFromState = (): void => {
    const mobsMap = room.state.mobs;
    if (!mobsMap || (mobsMap as { size?: number }).size === 0) return;
    for (const [id, mob] of mobsMap.entries() as Iterable<[string, MobSchema]>) {
      bindMob(id, mob);
    }
    mobsBootstrapped = true;
    const local = room.state.players.get(localId) as PlayerSchema | undefined;
    if (local) {
      lastMobScanX = Number.NaN;
      lastMobScanZ = Number.NaN;
      syncLocal(local);
      syncMobsInRenderRange();
    }
  };

  const bindMob = (id: string, state: MobSchema): void => {
    indexMob(id, state);
    if (wiredMobIds.has(id)) return;
    wiredMobIds.add(id);
    callbacks.onChange(state, () => onMobStateChange(id, state));
  };

  callbacks.onAdd('mobs', (mob, mobId) => {
    const id = mobId as string;
    const state = mob as MobSchema;
    bindMob(id, state);
    syncMobFromState(id, state);
  }, true);

  callbacks.onRemove('mobs', (_mob, mobId) => {
    const id = mobId as string;
    wiredMobIds.delete(id);
    mobSpatialIndex.remove(id);
    game.removeMob(id);
    publishMobs();
  });

  bootstrapMobsFromState();
  if (!mobsBootstrapped && typeof room.onStateChange === 'function') {
    room.onStateChange(() => {
      if (!mobsBootstrapped) bootstrapMobsFromState();
    });
  } else if (mobsBootstrapped) {
    publishMobs();
  }

  const localAtWire = room.state.players.get(localId) as PlayerSchema | undefined;
  if (localAtWire && !mobsBootstrapped) {
    lastMobScanX = Number.NaN;
    lastMobScanZ = Number.NaN;
    syncLocal(localAtWire);
  }

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

  const wiredNpcIds = new Set<string>();
  const bindNpc = (id: string, state: NpcSchema): void => {
    if (wiredNpcIds.has(id)) return;
    wiredNpcIds.add(id);
    callbacks.onChange(state, () => syncNpcFromState(id, state));
  };

  callbacks.onAdd('npcs', (npc, npcKey) => {
    const id = npcKey as string;
    const state = npc as NpcSchema;
    bindNpc(id, state);
    syncNpcFromState(id, state);
  });

  callbacks.onRemove('npcs', (_npc, npcKey) => {
    wiredNpcIds.delete(npcKey as string);
    game.removeNpc(npcKey as string);
  });

  if (room.state.npcs) {
    for (const [id, npc] of room.state.npcs.entries() as Iterable<[string, NpcSchema]>) {
      bindNpc(id, npc);
      syncNpcFromState(id, npc);
    }
  }

  room.onMessage('chat', (message: {
    channel: 'all' | 'local' | 'trade' | 'party';
    text: string;
    senderSessionId: string;
    senderName: string;
    timestampMs: number;
  }) => {
    appendChatLine(message);
    renderChatLog(getGameState().chat);
  });

  room.onMessage('friendsList', (message: { friends: { characterId: string; name: string; online: boolean }[] }) => {
    setFriends(message.friends);
    renderFriendsPanel(message.friends);
  });

  room.onMessage('tradeOpen', (message: { status: string; partnerSessionId: string }) => {
    tradePartnerSessionId = message.partnerSessionId;
    tradeMyOffer = null;
    tradePartnerOffer = null;
    tradeMyConfirmed = false;
    tradePartnerConfirmed = false;
    publishTradeState(message.status);
  });

  room.onMessage('tradeOfferAck', (message: { offer: { items: { itemId: number; count: number }[]; adena: number } }) => {
    tradeMyOffer = message.offer;
    tradeMyConfirmed = false;
    publishTradeState('open');
  });

  room.onMessage('tradePartnerOffer', (message: { offer: { items: { itemId: number; count: number }[]; adena: number } }) => {
    tradePartnerOffer = message.offer;
    tradePartnerConfirmed = false;
    publishTradeState('open');
  });

  room.onMessage('tradeComplete', () => {
    tradePartnerSessionId = null;
    tradeMyOffer = null;
    tradePartnerOffer = null;
    tradeMyConfirmed = false;
    tradePartnerConfirmed = false;
    publishTradeState('closed');
  });

  room.onMessage('tradeClosed', () => {
    tradePartnerSessionId = null;
    publishTradeState('closed');
  });

  callbacks.onAdd('parties', (party, partyId) => {
    const partyState = party as object;
    const local = room.state.players.get(localId) as PlayerSchema | undefined;
    if (local) syncPartyFromState(local);
    callbacks.onChange(partyState, () => {
      const lp = room.state.players.get(localId) as PlayerSchema | undefined;
      if (lp) syncPartyFromState(lp);
    });
  });

  callbacks.onRemove('parties', () => {
    const local = room.state.players.get(localId) as PlayerSchema | undefined;
    if (local) syncPartyFromState(local);
  });
}
