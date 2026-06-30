import { updatePowerStrikeCooldown } from './hud/power-strike-cooldown';
import { updatePlayerVitalsHud } from './hud/player-vitals';
import { renderHotbar } from './ui/hotbar';
import { updateCastBar } from './ui/cast-bar';
import type { AnimationClip } from '@nj/game-core';
import { SKILL_EFFECT_NAMES } from './ui/trainer-skills';
import { questObjectiveText, questTitle, TI_QUEST_TITLES } from './quest-catalog';
import type { QuestLogEntry } from './ui/quest-log';

export interface GameStateVfx {
  powerStrikeCount: number;
  meleeHitCount: number;
  levelUpCount: number;
  targetRingVisible: boolean;
  activeEffectCount: number;
}

import type { GameStateAudio } from './audio/audio-manager';

export type { GameStateAudio };

export interface EnvironmentCategoryState {
  count: number;
  renderKind: 'mesh' | 'primitive';
}

export interface GameStateZone {
  id: string;
  type: string;
  displayName: string;
}

export interface GameStateEnvironment {
  buildings: EnvironmentCategoryState;
  scatter: EnvironmentCategoryState;
  peaceZone: EnvironmentCategoryState;
  landmarks: EnvironmentCategoryState;
  loaded: boolean;
}

export interface GameStateActiveEffect {
  skillId: number;
  kind: string;
  expiresAtMs: number;
}

export interface GameStateUi {
  inventoryOpen: boolean;
  skillWindowOpen: boolean;
  questLogOpen: boolean;
  systemMenuOpen: boolean;
  worldMapOpen: boolean;
}

export interface GameStatePlayer {
  x: number;
  y: number;
  z: number;
  xp: number;
  level: number;
  hp: number;
  mp: number;
  classId: number;
  sex: number;
  str: number;
  dex: number;
  con: number;
  int: number;
  wit: number;
  men: number;
  avatarModel: string;
  knownSkillIds: number[];
  skillCooldownEndMs: number[];
  castingSkillId: number;
  castEndMs: number;
  effects: string[];
  powerStrikeCooldownEndMs: number;
  powerStrikeCooldownRemainingMs: number;
  healingPotionCooldownEndMs: number;
  healingPotionCooldownRemainingMs: number;
  action: AnimationClip;
  sp: number;
  karma: number;
  pvpFlag: number;
  expBeforeDeath: number;
  unspentStatPoints: number;
  inventoryWeight: number;
  maxLoad: number;
  inventorySlotsUsed: number;
  activeEffects: GameStateActiveEffect[];
}

/** Server snapshot input — remaining cooldowns are derived client-side. */
export type GameStatePlayerInput = Omit<
  GameStatePlayer,
  | 'powerStrikeCooldownRemainingMs'
  | 'healingPotionCooldownRemainingMs'
  | 'healingPotionCooldownEndMs'
  | 'action'
  | 'classId'
  | 'sex'
  | 'str'
  | 'dex'
  | 'con'
  | 'int'
  | 'wit'
  | 'men'
  | 'avatarModel'
  | 'knownSkillIds'
  | 'skillCooldownEndMs'
  | 'castingSkillId'
  | 'castEndMs'
  | 'effects'
  | 'sp'
  | 'karma'
  | 'pvpFlag'
  | 'expBeforeDeath'
  | 'unspentStatPoints'
  | 'inventoryWeight'
  | 'maxLoad'
  | 'inventorySlotsUsed'
  | 'activeEffects'
> & {
  action?: AnimationClip;
  healingPotionCooldownEndMs?: number;
  classId?: number;
  sex?: number;
  str?: number;
  dex?: number;
  con?: number;
  int?: number;
  wit?: number;
  men?: number;
  avatarModel?: string;
  knownSkillIds?: number[];
  skillCooldownEndMs?: number[];
  castingSkillId?: number;
  castEndMs?: number;
  effects?: string[];
  sp?: number;
  karma?: number;
  pvpFlag?: number;
  expBeforeDeath?: number;
  unspentStatPoints?: number;
  inventoryWeight?: number;
  maxLoad?: number;
  inventorySlotsUsed?: number;
  activeEffects?: GameStateActiveEffect[];
};

export interface GameStateMob {
  id: string;
  npcId: number;
  name?: string;
  x: number;
  y: number;
  z: number;
  hp: number;
  maxHp: number;
  level?: number;
  aggroTargetSessionId?: string;
  action: AnimationClip;
  actionSeq: number;
}

export interface OtherPlayer {
  id: string;
  name?: string;
  x: number;
  y: number;
  z: number;
  hp?: number;
  maxHp?: number;
  mp?: number;
  maxMp?: number;
  level?: number;
  pvpFlag?: number;
  karma?: number;
  targetMobId?: string | null;
  targetPlayerSessionId?: string | null;
  renderKind: 'mesh';
  action: AnimationClip;
  equippedWeaponId: number | null;
}

export interface GameStateNpc {
  npcId: number;
  name: string;
  type: string;
  x: number;
  y: number;
  z: number;
  renderKind?: 'mesh' | 'capsule';
  action?: AnimationClip;
}

export interface GameStateQuestDef {
  questId: number;
  name: string;
}

export interface GameStateQuests {
  active: QuestLogEntry[];
  completed: QuestLogEntry[];
  defs: Record<number, GameStateQuestDef>;
}

export interface GameStateChatLine {
  channel: 'all' | 'local' | 'trade' | 'party';
  text: string;
  senderSessionId: string;
  senderName: string;
  timestampMs: number;
}

export interface GameStateParty {
  partyId: number;
  leaderSessionId: string;
  memberSessionIds: string[];
}

export interface GameStateTradeOffer {
  items: { itemId: number; count: number }[];
  adena: number;
}

export interface GameStateTrade {
  status: string;
  partnerSessionId: string;
  myOffer: GameStateTradeOffer | null;
  partnerOffer: GameStateTradeOffer | null;
  myConfirmed: boolean;
  partnerConfirmed: boolean;
}

export interface GameStateFriend {
  characterId: string;
  name: string;
  online: boolean;
}

export interface GameState {
  connected: boolean;
  ready: boolean;
  player: GameStatePlayer;
  target: { x: number | null; z: number | null };
  others: OtherPlayer[];
  mobs: GameStateMob[];
  npcs: GameStateNpc[];
  adena: number;
  items: Record<number, number>;
  nearbyNpcId: number | null;
  canInteract: boolean;
  shopOpen: boolean;
  targetMobId: string | null;
  targetPlayerSessionId: string | null;
  characterId: string | null;
  equippedWeaponId: number | null;
  equipment: Record<string, { itemId: number; enchantLevel: number }>;
  pDef: number;
  maxHp: number;
  maxMp: number;
  /** Stays 0 while movement is server-authoritative (no client step()). */
  localMovementTicks: number;
  vfx: GameStateVfx;
  audio: GameStateAudio;
  environment: GameStateEnvironment;
  zone: GameStateZone;
  quests: GameStateQuests;
  warehouse: Record<number, number>;
  chat: GameStateChatLine[];
  party: GameStateParty | null;
  trade: GameStateTrade | null;
  friends: GameStateFriend[];
  ui: GameStateUi;
}

declare global {
  interface Window {
    __GAME_STATE__: GameState;
    __handleGroundClick__?: (clientX: number, clientY: number) => void;
    __handleMobTarget__?: (mobId: string) => void;
    __sendMoveIntent__?: (targetX: number, targetZ: number) => void;
    __attack__?: () => void;
    __useSkill__?: (skillId?: number) => void;
    __useShot__?: (itemId: number) => void;
    __learnSkill__?: (skillId: number) => void;
    __interact__?: (npcId: number) => void;
    __buyItem__?: (npcId: number, itemId: number, quantity?: number) => void;
    __sellItem__?: (npcId: number, itemId: number, quantity?: number) => void;
    __npcAction__?: (npcId: number, action: 'heal' | 'starterKit' | 'resurrect' | 'bless') => void;
    __warehouseDeposit__?: (npcId: number, itemId: number, quantity: number) => void;
    __warehouseWithdraw__?: (npcId: number, itemId: number, quantity: number) => void;
    __teleport__?: (npcId: number, destinationId: string) => void;
    __classTransfer__?: (npcId: number, targetClassId: number) => void;
    __equipItem__?: (itemId: number) => void;
    __useItem__?: (itemId: number) => void;
    __openInventory__?: () => void;
    __consentLeave__?: () => Promise<void>;
    __questAction__?: (npcId: number, action: string) => void;
    __toggleQuestLog__?: () => void;
    __sendChat__?: (channel: string, text: string) => void;
    __partyInvite__?: (targetSessionId: string) => void;
    __partyLeave__?: () => void;
    __tradeConfirm__?: () => void;
    __friendAdd__?: (targetSessionId: string) => void;
    __togglePvp__?: () => void;
    __allocateStat__?: (stat: string) => void;
    __resetStats__?: () => void;
  }
}

const initialState: GameState = {
  connected: false,
  ready: false,
  player: { x: 0, y: 0, z: 0, xp: 0, level: 1, hp: 0, mp: 0, classId: 0, sex: 0, str: 40, dex: 30, con: 43, int: 21, wit: 11, men: 25, avatarModel: '/models/characters/Knight.glb', knownSkillIds: [], skillCooldownEndMs: [], castingSkillId: 0, castEndMs: 0, effects: [], powerStrikeCooldownEndMs: 0, powerStrikeCooldownRemainingMs: 0, healingPotionCooldownEndMs: 0, healingPotionCooldownRemainingMs: 0, action: 'idle', sp: 0, karma: 0, pvpFlag: 0, expBeforeDeath: 0, unspentStatPoints: 0, inventoryWeight: 0, maxLoad: 2967, inventorySlotsUsed: 0, activeEffects: [] },
  target: { x: null, z: null },
  others: [],
  mobs: [],
  npcs: [],
  adena: 0,
  items: {},
  nearbyNpcId: null,
  canInteract: false,
  shopOpen: false,
  targetMobId: null,
  targetPlayerSessionId: null,
  characterId: null,
  equippedWeaponId: null,
  equipment: {},
  pDef: 0,
  maxHp: 0,
  maxMp: 0,
  localMovementTicks: 0,
  vfx: {
    powerStrikeCount: 0,
    meleeHitCount: 0,
    levelUpCount: 0,
    targetRingVisible: false,
    activeEffectCount: 0,
  },
  audio: {
    currentMusicId: null,
    ambientId: null,
    sfxCounts: {},
    musicVolume: 0.7,
    sfxVolume: 0.8,
    muted: false,
    inCombat: false,
  },
  environment: {
    buildings: { count: 0, renderKind: 'primitive' },
    scatter: { count: 0, renderKind: 'primitive' },
    peaceZone: { count: 0, renderKind: 'primitive' },
    landmarks: { count: 0, renderKind: 'primitive' },
    loaded: false,
  },
  zone: { id: '', type: 'unknown', displayName: '' },
  quests: { active: [], completed: [], defs: {} },
  warehouse: {},
  chat: [],
  party: null,
  trade: null,
  friends: [],
  ui: {
    inventoryOpen: false,
    skillWindowOpen: false,
    questLogOpen: false,
    systemMenuOpen: false,
    worldMapOpen: false,
  },
};

export function initGameState(): GameState {
  window.__GAME_STATE__ = {
    ...initialState,
    player: { ...initialState.player },
    target: { ...initialState.target },
    others: [],
    mobs: [],
    npcs: [],
    adena: 0,
    items: {},
    nearbyNpcId: null,
    canInteract: false,
    shopOpen: false,
    targetMobId: null,
    targetPlayerSessionId: null,
    characterId: null,
    equippedWeaponId: null,
    equipment: {},
    pDef: 0,
    maxHp: 0,
    maxMp: 0,
    localMovementTicks: 0,
    vfx: {
      powerStrikeCount: 0,
      meleeHitCount: 0,
      levelUpCount: 0,
      targetRingVisible: false,
      activeEffectCount: 0,
    },
    environment: {
      buildings: { count: 0, renderKind: 'primitive' },
      scatter: { count: 0, renderKind: 'primitive' },
      peaceZone: { count: 0, renderKind: 'primitive' },
      landmarks: { count: 0, renderKind: 'primitive' },
      loaded: false,
    },
    zone: { id: '', type: 'unknown', displayName: '' },
    quests: { active: [], completed: [], defs: buildQuestDefs() },
    warehouse: {},
    chat: [],
    party: null,
    trade: null,
    friends: [],
    ui: { ...initialState.ui },
  };
  return window.__GAME_STATE__;
}

export function getGameState(): GameState {
  if (!window.__GAME_STATE__) {
    return initGameState();
  }
  return window.__GAME_STATE__;
}

export function setConnected(connected: boolean): void {
  getGameState().connected = connected;
}

export function setReady(ready: boolean): void {
  getGameState().ready = ready;
}

export function setTarget(x: number | null, z: number | null): void {
  const state = getGameState();
  state.target.x = x;
  state.target.z = z;
}

export function computePowerStrikeCooldownRemainingMs(
  cooldownEndMs: number,
  nowMs = Date.now()
): number {
  return Math.max(0, cooldownEndMs - nowMs);
}

export function computeHealingPotionCooldownRemainingMs(
  cooldownEndMs: number,
  nowMs = Date.now()
): number {
  return Math.max(0, cooldownEndMs - nowMs);
}

export function refreshPlayerCooldownRemaining(nowMs = Date.now()): void {
  const state = getGameState();
  state.player.powerStrikeCooldownRemainingMs = computePowerStrikeCooldownRemainingMs(
    state.player.powerStrikeCooldownEndMs,
    nowMs
  );
  state.player.healingPotionCooldownRemainingMs = computeHealingPotionCooldownRemainingMs(
    state.player.healingPotionCooldownEndMs,
    nowMs
  );
}

export function setPlayer(player: GameStatePlayerInput, nowMs = Date.now()): void {
  const state = getGameState();
  state.player.x = player.x;
  state.player.y = player.y;
  state.player.z = player.z;
  state.player.xp = player.xp;
  state.player.level = player.level;
  state.player.hp = player.hp;
  state.player.mp = player.mp;
  if (player.classId !== undefined) state.player.classId = player.classId;
  if (player.sex !== undefined) state.player.sex = player.sex;
  if (player.str !== undefined) state.player.str = player.str;
  if (player.dex !== undefined) state.player.dex = player.dex;
  if (player.con !== undefined) state.player.con = player.con;
  if (player.int !== undefined) state.player.int = player.int;
  if (player.wit !== undefined) state.player.wit = player.wit;
  if (player.men !== undefined) state.player.men = player.men;
  if (player.avatarModel !== undefined) state.player.avatarModel = player.avatarModel;
  if (player.knownSkillIds !== undefined) state.player.knownSkillIds = [...player.knownSkillIds];
  if (player.skillCooldownEndMs !== undefined) {
    state.player.skillCooldownEndMs = [...player.skillCooldownEndMs];
  }
  if (player.castingSkillId !== undefined) state.player.castingSkillId = player.castingSkillId;
  if (player.castEndMs !== undefined) state.player.castEndMs = player.castEndMs;
  if (player.effects !== undefined) state.player.effects = [...player.effects];
  state.player.powerStrikeCooldownEndMs = player.powerStrikeCooldownEndMs;
  state.player.healingPotionCooldownEndMs = player.healingPotionCooldownEndMs ?? 0;
  state.player.powerStrikeCooldownRemainingMs = computePowerStrikeCooldownRemainingMs(
    player.powerStrikeCooldownEndMs,
    nowMs
  );
  state.player.healingPotionCooldownRemainingMs = computeHealingPotionCooldownRemainingMs(
    player.healingPotionCooldownEndMs ?? 0,
    nowMs
  );
  if (player.action !== undefined) {
    state.player.action = player.action;
  }
  if (player.sp !== undefined) state.player.sp = player.sp;
  if (player.karma !== undefined) state.player.karma = player.karma;
  if (player.pvpFlag !== undefined) state.player.pvpFlag = player.pvpFlag;
  if (player.expBeforeDeath !== undefined) state.player.expBeforeDeath = player.expBeforeDeath;
  if (player.unspentStatPoints !== undefined) {
    state.player.unspentStatPoints = player.unspentStatPoints;
  }
  if (typeof document !== 'undefined') {
    updatePowerStrikeCooldown(player.powerStrikeCooldownEndMs, nowMs);
    renderHotbar({
      knownSkillIds: state.player.knownSkillIds,
      skillCooldownEndMs: state.player.skillCooldownEndMs,
      nowMs,
      handlers: {
        onUseSkill: (skillId) => window.__useSkill__?.(skillId),
      },
    });
    updateCastBar({
      castingSkillId: state.player.castingSkillId,
      castEndMs: state.player.castEndMs,
      nowMs,
    });
    renderVitalsHud();
  }
}

/**
 * Render the corner vitals HUD from a single source of truth. Vitals updates
 * arrive from several setters (hp/mp, maxHp, maxMp, pDef) at different times;
 * sourcing every field — including pDef — from game state here prevents the
 * P.Def line from flickering in and out as individual setters omit it.
 */
function renderVitalsHud(): void {
  if (typeof document === 'undefined') return;
  const state = getGameState();
  updatePlayerVitalsHud({
    level: state.player.level,
    hp: state.player.hp,
    maxHp: state.maxHp,
    mp: state.player.mp,
    maxMp: state.maxMp,
    pDef: state.pDef,
  });
}

export function setMobs(mobs: GameStateMob[]): void {
  getGameState().mobs = mobs.map((mob) => ({ ...mob }));
}

export function setTargetMobId(targetMobId: string | null): void {
  getGameState().targetMobId = targetMobId;
  if (targetMobId) getGameState().targetPlayerSessionId = null;
}

export function setTargetPlayerSessionId(targetPlayerSessionId: string | null): void {
  getGameState().targetPlayerSessionId = targetPlayerSessionId;
  if (targetPlayerSessionId) getGameState().targetMobId = null;
}

export function setPlayerInventoryMetrics(metrics: {
  inventoryWeight: number;
  maxLoad: number;
  inventorySlotsUsed: number;
}): void {
  const player = getGameState().player;
  player.inventoryWeight = metrics.inventoryWeight;
  player.maxLoad = metrics.maxLoad;
  player.inventorySlotsUsed = metrics.inventorySlotsUsed;
}

export function setPlayerActiveEffects(effects: GameStateActiveEffect[]): void {
  getGameState().player.activeEffects = effects.map((e) => ({ ...e }));
}

export function setOthers(others: OtherPlayer[]): void {
  getGameState().others = others.map((other) => ({ ...other }));
}

export function setCharacterId(characterId: string | null): void {
  getGameState().characterId = characterId;
}

export function recordLocalMovementTick(): void {
  getGameState().localMovementTicks += 1;
}

export function setAdena(adena: number): void {
  getGameState().adena = adena;
}

export function setItems(items: Record<number, number>): void {
  getGameState().items = { ...items };
}

export function setWarehouse(warehouse: Record<number, number>): void {
  getGameState().warehouse = { ...warehouse };
}

export function setNpcs(npcs: GameStateNpc[]): void {
  getGameState().npcs = npcs.map((npc) => ({ ...npc }));
}

export function setNearbyNpc(nearbyNpcId: number | null, canInteract: boolean): void {
  const state = getGameState();
  state.nearbyNpcId = nearbyNpcId;
  state.canInteract = canInteract;
}

export function setShopOpen(shopOpen: boolean): void {
  getGameState().shopOpen = shopOpen;
}

export function setEquippedWeaponId(equippedWeaponId: number | null): void {
  getGameState().equippedWeaponId = equippedWeaponId;
}

export function setEquipment(
  equipment: Record<string, { itemId: number; enchantLevel: number }>
): void {
  getGameState().equipment = { ...equipment };
}

export function setPlayerPDef(pDef: number): void {
  getGameState().pDef = pDef;
  renderVitalsHud();
}

export function setMaxHp(maxHp: number): void {
  getGameState().maxHp = maxHp;
  renderVitalsHud();
}

export function setMaxMp(maxMp: number): void {
  getGameState().maxMp = maxMp;
  renderVitalsHud();
}

export function effectsFromBuffSkillId(activeBuffSkillId: number): string[] {
  if (!activeBuffSkillId) return [];
  const name = SKILL_EFFECT_NAMES[activeBuffSkillId];
  return name ? [name] : [`Skill ${activeBuffSkillId}`];
}

export function setEnvironment(environment: GameStateEnvironment): void {
  getGameState().environment = {
    buildings: { ...environment.buildings },
    scatter: { ...environment.scatter },
    peaceZone: { ...environment.peaceZone },
    landmarks: { ...environment.landmarks },
    loaded: environment.loaded,
  };
}

export function setZone(zone: GameStateZone): void {
  getGameState().zone = { ...zone };
}

function buildQuestDefs(): Record<number, GameStateQuestDef> {
  const defs: Record<number, GameStateQuestDef> = {};
  for (const [id, name] of Object.entries(TI_QUEST_TITLES)) {
    defs[Number(id)] = { questId: Number(id), name };
  }
  return defs;
}

export function setQuests(
  entries: { questId: number; status: string; step: number }[]
): void {
  const state = getGameState();
  const active: QuestLogEntry[] = [];
  const completed: QuestLogEntry[] = [];
  for (const e of entries) {
    const title = questTitle(e.questId);
    if (e.status === 'completed') {
      completed.push({
        questId: e.questId,
        title,
        objectiveText: '',
        step: e.step,
        status: 'completed',
      });
    } else {
      active.push({
        questId: e.questId,
        title,
        objectiveText: questObjectiveText(e.questId, e.step),
        step: e.step,
        status: 'in_progress',
      });
    }
  }
  state.quests = { active, completed, defs: buildQuestDefs() };
}

const CHAT_HISTORY_MAX = 20;

export function appendChatLine(line: GameStateChatLine): void {
  const state = getGameState();
  state.chat = [...state.chat, line].slice(-CHAT_HISTORY_MAX);
}

export function setParty(party: GameStateParty | null): void {
  getGameState().party = party ? { ...party, memberSessionIds: [...party.memberSessionIds] } : null;
}

export function setTrade(trade: GameStateTrade | null): void {
  getGameState().trade = trade
    ? {
        ...trade,
        myOffer: trade.myOffer ? { ...trade.myOffer, items: [...trade.myOffer.items] } : null,
        partnerOffer: trade.partnerOffer
          ? { ...trade.partnerOffer, items: [...trade.partnerOffer.items] }
          : null,
      }
    : null;
}

export function setFriends(friends: GameStateFriend[]): void {
  getGameState().friends = friends.map((f) => ({ ...f }));
}
