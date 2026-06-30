import { Room, Client } from 'colyseus';
import {
  step,
  createPathMoveState,
  isValidMoveIntent,
  createSeededRng,
  STARTER_COMBAT,
  calcClassBasePAtk,
  calcEffectivePAtk,
  calcPlayerPDef,
  calcClassBasePDef,
  EQUIP_SLOTS,
  type EquipSlot,
  applyClassLevelUpReward,
  classVitalsAtLevel,
  resolvePlayerDeath,
  calcDeathXpLoss,
  levelFromCumulativeXp,
  xpForLevel,
  applyRestoreExp,
  canAffordSkill,
  deductSkillSp,
  awardStatPointOnLevelUp,
  effectiveStat,
  isInPeaceZone,
  type ExperienceLossRow,
  stepAlongPath,
  snapEntityY,
  isWalkable,
  findPath,
  snapToNearestWalkable,
  getZoneAt,
  type MovementIntent,
  type PathMoveState,
  type DropRow,
  type ExperienceCurveRow,
  type SeededRng,
  type ClassVitalsRow,
  type QuestDefinition,
  type QuestRuntimeState,
  EntityAction,
  HEALING_POTION_HEAL_AMOUNT,
  HEALING_POTION_ITEM_ID,
  HEALING_POTION_REUSE_MS,
  resolveConsumableUse,
  canTransferClass,
  depositToWarehouse,
  withdrawFromWarehouse,
  applyBuffSelf,
  canCraft,
  applyCraft,
  horizontalDistance,
  calcInventoryWeight,
  calcMaxLoad,
  countInventorySlots,
} from '@nj/game-core';
import { getDb, type AppDatabase } from '../db/client';
import {
  createCharacter,
  loadCharacter,
  saveCharacter,
  loadCharacterItems,
  saveCharacterItems,
  loadCharacterSkills,
  saveCharacterSkills,
  loadCharacterQuests,
  isQuestItem,
  grantAutoGetSkills,
  type CharacterItemCounts,
  type CharacterSkillLevels,
} from '../db/character-repository';
import { loadQuestDefinitions } from '../db/quest-repository';
import {
  loadClassTemplate,
  loadClassVitalsCurve,
  loadClassVitalsAtLevel,
} from '../db/class-template-repository';
import {
  loadWarehouseItems,
  saveWarehouseItems,
  countDistinctWarehouseItems,
  type WarehouseItemCounts,
} from '../db/warehouse-repository';
import { experience, experienceLoss, mobDrops, skills, merchantItems, npcSpawns, npcs, items, recipes, classTemplates, classSkillTree, teleportDestinations, monsters, type Character, type MerchantItem, type Item, type ClassTemplate, type Skill, type Recipe } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { FIXTURE_DATA_DIR } from '../seed/seed';
import { seedSkills } from '../seed/seeders/skills.seeder';
import { TownState, PlayerState } from './schema/TownState';
import { EffectState } from './schema/EffectState';
import { MobState } from './schema/MobState';
import { NpcState } from './schema/NpcState';
import { ItemStackState } from './schema/ItemStackState';
import { tickMobAi, shouldTickMobAi } from './mob-ai';
import {
  createPlayerCombatState,
  resolvePlayerAttack,
  resolvePowerStrike,
  resolveSkillUse,
  resolveMobAttack,
  applyKillRewards,
  resolvePlayerVsPlayerMeleeAttack,
  resolvePlayerVsPlayerSkillUse,
  beginSkillCast,
  cancelSkillCast,
  canUseSkill,
  getSkillCooldownEnd,
  applyDamageToCastingPlayer,
  tickCombatEffects,
  calcPlayerMAtk,
  type PlayerCombatState,
  type KillEvent,
  type PowerStrikeSkill,
  type MobEffectState,
} from './combat-resolver';
import {
  initializeMobs,
  syncMobState,
  loadMobSpawnRow,
  loadMonsterTemplate,
  respawnMobRuntime,
  type MobRuntime,
} from './spawn-manager';
import { buyItem, sellItem } from './shop-transaction';
import {
  loadEquipment,
  saveAllEquipment,
  migrateLegacyWeapon,
  type EquipmentRow,
} from '../db/equipment-repository';
import { ensureStatBonusesRegistered } from '../bootstrap/stat-bonuses';
import {
  applyEquipTransaction,
  applyUnequipTransaction,
  buildCraftRecipe,
  applyEnchantTransaction,
} from './equipment-handlers';
import { syncEquipArrays, weaponItemIdFromEquipment } from './equipment-sync';
import { canInteract, applyHeal, applyStarterKit } from './npc-actions';
import { isStarterClassId, isValidSex } from './starter-classes';
import {
  buildQuestDialog,
  ensureAutoStartQuests,
  getQuestEntriesForNpc,
  handleQuestAction,
  onMobKilledForQuests,
  syncQuestEntriesToPlayer,
  type QuestRoomContext,
} from './quest-handlers';
import { canStartQuest } from '@nj/game-core';
import { handleChat, createChatRateState, type ChatRateState } from './social/chat-handler';
import {
  handlePartyInvite,
  handlePartyAccept,
  handlePartyDecline,
  handlePartyLeave,
  handlePartyKick,
  cleanupPartyOnDisconnect,
  getPartyMemberSessionIds,
  type PartyInvitePending,
} from './party-handlers';
import { resolvePartyKillRewards, PARTY_KILL_RANGE } from './party-kill-rewards';
import {
  handleTradeRequest,
  handleTradeAccept,
  handleTradeOffer,
  handleTradeConfirm,
  handleTradeCancel,
  cleanupTradeOnDisconnect,
  type TradeSession,
} from './trade-handlers';
import {
  handleFriendAdd,
  handleFriendRemove,
  syncFriendsToPlayer,
  registerCharacterSession,
  unregisterCharacterSession,
  type FriendHandlerDeps,
} from './friend-handlers';
import {
  handleTogglePvpIntent,
  tickPvpFlagsForPlayers,
  extendAttackerPvpFlag,
  applyPlayerKillKarma,
  handleSetTargetPlayer,
} from './pvp-handlers';
import { handleAllocateStat, handleResetStats } from './stat-handlers';

const WILFORD_NPC_ID = 30005;
const ROXXY_NPC_ID = 30006;
const BITZ_NPC_ID = 30026;
const BIOTIN_NPC_ID = 30031;
const GWINTER_NPC_ID = 30027;
const BAULRO_NPC_ID = 30033;
const SOULSHOT_ITEM_ID = 1835;
const SPIRITSHOT_ITEM_ID = 2509;
const FOLK_TRAINER_NPC_IDS = [
  30027, 30028, 30029, 30030, 30032, 30033, 30034, 30035, 30036,
] as const;
const TRAINER_NPC_IDS = new Set<number>([BITZ_NPC_ID, ...FOLK_TRAINER_NPC_IDS]);

function questCompletedIds(entries: QuestRuntimeState[]): Set<number> {
  return new Set(entries.filter((e) => e.status === 'completed').map((e) => e.questId));
}

export interface TownJoinOptions {
  characterId?: string;
  accountName?: string;
  create?: {
    classId: number;
    sex: 0 | 1;
    accountName?: string;
    name?: string;
  };
}

export interface TownRoomOptions {
  dbPath?: string;
  /** Colyseus matchmaker passes this from client join options (`filterBy`). */
  instanceKey?: string;
  characterId?: string;
  saveDebounceMs?: number;
  combatSeed?: number;
  combatRng?: SeededRng;
  nowMs?: () => number;
  /** Wall-clock period (ms) of the authoritative simulation tick. Default 50. */
  simulationIntervalMs?: number;
  /**
   * When false, the room does NOT start a background simulation interval. Tests
   * set this (via the `NJ_AUTOSIM=0` env) so they can drive `simulate()`
   * deterministically and synchronously, eliminating the wall-clock
   * tick/transport races that made room-integration tests slow and flaky.
   * Production leaves it `true`.
   */
  autoSimulate?: boolean;
}

const DEFAULT_DB_PATH = process.env['NJ_DB_PATH'] ?? 'data/game.db';
const DEFAULT_SAVE_DEBOUNCE_MS = 5000;
export const DEFAULT_SIM_INTERVAL_MS = 50;
/** How long a player is frozen in the death pose before standing back up at spawn (matches the die clip length). */
const PLAYER_DEATH_FREEZE_MS = 1200;

function resolveSimIntervalMs(option?: number): number {
  if (typeof option === 'number' && option > 0) return option;
  return DEFAULT_SIM_INTERVAL_MS;
}

interface PendingRespawn {
  runtime: MobRuntime;
  respawnAtMs: number;
}

export class TownRoom extends Room<{ state: TownState }> {
  declare state: TownState;

  private db!: AppDatabase;
  private saveDebounceMs = DEFAULT_SAVE_DEBOUNCE_MS;
  private tickStates = new Map<string, PathMoveState>();
  private pendingIntents = new Map<string, MovementIntent>();
  private characterIds = new Map<string, string>();
  private characters = new Map<string, Character>();
  private saveTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private mobRuntime = new Map<string, MobRuntime>();
  private playerCombat = new Map<string, PlayerCombatState>();
  private pendingRespawns = new Map<string, PendingRespawn>();
  private combatRng!: SeededRng;
  private experienceCurve: ExperienceCurveRow[] = [];
  private experienceLossTable: ExperienceLossRow[] = [];
  private pendingPlayerKiller = new Map<string, string>();
  private dropsByNpcId = new Map<number, DropRow[]>();
  private itemsById = new Map<number, Item>();
  private powerStrikeSkill!: PowerStrikeSkill;
  private skillsById = new Map<number, Skill>();
  private playerSkills = new Map<string, CharacterSkillLevels>();
  private mobEffects = new Map<string, MobEffectState>();
  private nowMs = () => Date.now();
  private playerItems = new Map<string, CharacterItemCounts>();
  private playerWarehouse = new Map<string, WarehouseItemCounts>();
  private playerQuests = new Map<string, QuestRuntimeState[]>();
  private questDefs = new Map<number, QuestDefinition>();
  private npcSpawnsById = new Map<number, { x: number; y: number; z: number }>();
  private classTemplatesById = new Map<number, ClassTemplate>();
  private classVitalsByClassId = new Map<number, ClassVitalsRow[]>();
  private playerEquipment = new Map<string, EquipmentRow[]>();
  private recipesById = new Map<number, Recipe>();
  private chatRateBySession = new Map<string, ChatRateState>();
  private pendingPartyInvites = new Map<string, PartyInvitePending>();
  private partyMemberOrder = new Map<number, string[]>();
  private nextPartyId = 1;
  private tradeSessions = new Map<string, TradeSession>();
  private tradeSessionByPlayer = new Map<string, string>();
  private sessionByCharacterId = new Map<string, string>();
  private connectedSessions = new Set<string>();
  /** Sessions in their post-death freeze, mapped to the time they stand back up. */
  private respawnStandAtMs = new Map<string, number>();
  /** Pending reconnection deferreds, so a newer session can evict a stale one. */
  private pendingReconnections = new Map<string, { reject: (reason?: unknown) => void }>();

  override onCreate(options: TownRoomOptions = {}): void {
    this.db = getDb(options.dbPath ?? DEFAULT_DB_PATH);
    this.loadClassTemplateData();
    this.saveDebounceMs = options.saveDebounceMs ?? DEFAULT_SAVE_DEBOUNCE_MS;
    this.nowMs = options.nowMs ?? (() => Date.now());
    this.combatRng =
      options.combatRng ??
      createSeededRng(options.combatSeed ?? hashRoomId(this.roomId));

    this.loadCombatData();
    this.questDefs = loadQuestDefinitions(this.db);
    this.setState(new TownState());
    this.initializeNpcs();
    this.mobRuntime = initializeMobs(this.db, this.state);
    this.autoDispose = true;
    const autoSimulate = options.autoSimulate ?? process.env['NJ_AUTOSIM'] !== '0';
    if (autoSimulate) {
      this.setSimulationInterval(
        (deltaTimeMs) => this.simulate(deltaTimeMs),
        resolveSimIntervalMs(options.simulationIntervalMs)
      );
    }

    this.onMessage('move', (client, message: { targetX: number; targetZ: number }) => {
      if (!isValidMoveIntent(message.targetX, message.targetZ)) return;
      this.pendingIntents.set(client.sessionId, {
        targetX: message.targetX,
        targetZ: message.targetZ,
      });
    });

    this.onMessage('setTarget', (client, message: { mobId: string }) => {
      const combat = this.playerCombat.get(client.sessionId);
      const mob = this.mobRuntime.get(message.mobId);
      if (!combat || !mob || mob.hp <= 0) return;
      combat.targetMobId = message.mobId;
    });

    this.onMessage('attack', (client) => {
      const combat = this.playerCombat.get(client.sessionId);
      if (!combat || (!combat.targetMobId && !combat.targetPlayerSessionId)) return;
      combat.attackPending = true;
    });

    this.onMessage('useSkill', (client, message: { skillId: number }) => {
      this.handleUseSkill(client.sessionId, message.skillId);
    });

    this.onMessage('learnSkill', (client, message: { skillId: number }) => {
      this.handleLearnSkill(client.sessionId, message.skillId);
    });

    this.onMessage('togglePvp', (client) => {
      this.handleTogglePvp(client.sessionId);
    });

    this.onMessage('setTargetPlayer', (client, message: { sessionId: string }) => {
      this.handleSetTargetPlayer(client.sessionId, message.sessionId);
    });

    this.onMessage('allocateStat', (client, message: { stat: string }) => {
      this.handleAllocateStat(client.sessionId, message.stat);
    });

    this.onMessage('resetStats', (client) => {
      this.handleResetStats(client.sessionId);
    });

    this.onMessage('useShot', (client, message: { itemId: number }) => {
      this.handleUseShot(client.sessionId, message.itemId);
    });

    this.onMessage('interact', (client, message: { npcId: number }) => {
      this.handleInteract(client.sessionId, message.npcId);
    });

    this.onMessage(
      'buy',
      (client, message: { npcId: number; itemId: number; quantity: number }) => {
        this.handleBuy(client.sessionId, message.npcId, message.itemId, message.quantity);
      }
    );

    this.onMessage(
      'sell',
      (client, message: { npcId: number; itemId: number; quantity: number }) => {
        this.handleSell(client.sessionId, message.npcId, message.itemId, message.quantity);
      }
    );

    this.onMessage(
      'npcAction',
      (client, message: { npcId: number; action: 'heal' | 'starterKit' | 'resurrect' | 'bless' | 'restoreExp' }) => {
        this.handleNpcAction(client.sessionId, message.npcId, message.action);
      }
    );

    this.onMessage(
      'warehouseDeposit',
      (client, message: { npcId: number; itemId: number; quantity: number }) => {
        this.handleWarehouseDeposit(
          client.sessionId,
          message.npcId,
          message.itemId,
          message.quantity
        );
      }
    );

    this.onMessage(
      'warehouseWithdraw',
      (client, message: { npcId: number; itemId: number; quantity: number }) => {
        this.handleWarehouseWithdraw(
          client.sessionId,
          message.npcId,
          message.itemId,
          message.quantity
        );
      }
    );

    this.onMessage(
      'teleport',
      (client, message: { npcId: number; destinationId: string }) => {
        this.handleTeleport(client.sessionId, message.npcId, message.destinationId);
      }
    );

    this.onMessage(
      'classTransfer',
      (client, message: { npcId: number; targetClassId: number }) => {
        this.handleClassTransfer(client.sessionId, message.npcId, message.targetClassId);
      }
    );

    this.onMessage('equip', (client, message: { itemId: number }) => {
      this.handleEquip(client.sessionId, message.itemId);
    });

    this.onMessage('unequip', (client, message: { slot: EquipSlot }) => {
      this.handleUnequip(client.sessionId, message.slot);
    });

    this.onMessage('craft', (client, message: { recipeId: number }) => {
      this.handleCraft(client.sessionId, message.recipeId);
    });

    this.onMessage(
      'enchant',
      (client, message: { scrollItemId: number; slot: EquipSlot }) => {
        this.handleEnchant(client.sessionId, message.scrollItemId, message.slot);
      }
    );

    this.onMessage('useItem', (client, message: { itemId: number }) => {
      this.handleUseItem(client.sessionId, message.itemId);
    });

    this.onMessage(
      'questAction',
      (client, message: { npcId: number; action: string }) => {
        this.handleQuestAction(client.sessionId, message.npcId, message.action);
      }
    );

    this.onMessage('chat', (client, message: { channel: string; text: string }) => {
      this.handleChatMessage(client.sessionId, message);
    });

    this.onMessage('partyInvite', (client, message: { targetSessionId: string }) => {
      handlePartyInvite(this.createPartyDeps(), client.sessionId, message.targetSessionId);
    });

    this.onMessage('partyAccept', (client, message: { inviterSessionId: string }) => {
      handlePartyAccept(this.createPartyDeps(), client.sessionId, message.inviterSessionId);
    });

    this.onMessage('partyDecline', (client, message: { inviterSessionId: string }) => {
      handlePartyDecline(this.createPartyDeps(), client.sessionId, message.inviterSessionId);
    });

    this.onMessage('partyLeave', (client) => {
      handlePartyLeave(this.createPartyDeps(), client.sessionId);
    });

    this.onMessage('partyKick', (client, message: { targetSessionId: string }) => {
      handlePartyKick(this.createPartyDeps(), client.sessionId, message.targetSessionId);
    });

    this.onMessage('tradeRequest', (client, message: { targetSessionId: string }) => {
      handleTradeRequest(this.createTradeDeps(), client.sessionId, message.targetSessionId);
    });

    this.onMessage('tradeAccept', (client, message: { fromSessionId: string }) => {
      handleTradeAccept(this.createTradeDeps(), client.sessionId, message.fromSessionId);
    });

    this.onMessage(
      'tradeOffer',
      (client, message: { items: { itemId: number; count: number }[]; adena: number }) => {
        handleTradeOffer(this.createTradeDeps(), client.sessionId, message);
      }
    );

    this.onMessage('tradeConfirm', (client) => {
      handleTradeConfirm(this.createTradeDeps(), client.sessionId);
    });

    this.onMessage('tradeCancel', (client) => {
      handleTradeCancel(this.createTradeDeps(), client.sessionId);
    });

    this.onMessage(
      'friendAdd',
      (client, message: { targetSessionId?: string; targetCharacterId?: string }) => {
        handleFriendAdd(this.createFriendDeps(), client.sessionId, message);
      }
    );

    this.onMessage('friendRemove', (client, message: { friendCharacterId: string }) => {
      handleFriendRemove(this.createFriendDeps(), client.sessionId, message.friendCharacterId);
    });
  }

  private initializeNpcs(): void {
    this.npcSpawnsById.clear();
    for (const spawn of this.db.select().from(npcSpawns).all()) {
      this.npcSpawnsById.set(spawn.npcId, { x: spawn.x, y: spawn.y, z: spawn.z });
      const meta = this.db
        .select()
        .from(npcs)
        .where(eq(npcs.npcId, spawn.npcId))
        .get();
      if (!meta) continue;

      const npcState = new NpcState();
      npcState.id = `npc-${spawn.npcId}`;
      npcState.npcId = spawn.npcId;
      npcState.name = meta.name;
      npcState.title = meta.title;
      npcState.type = meta.type;
      npcState.x = spawn.x;
      npcState.y = snapEntityY(spawn.x, spawn.z);
      npcState.z = spawn.z;
      this.state.npcs.set(npcState.id, npcState);
    }
  }

  private getNpcSpawn(npcId: number): { x: number; y: number; z: number } | undefined {
    return this.npcSpawnsById.get(npcId);
  }

  private isNearNpc(
    sessionId: string,
    npcId: number
  ): { ok: true; spawn: { x: number; y: number; z: number } } | { ok: false } {
    const spawn = this.getNpcSpawn(npcId);
    const player = this.state.players.get(sessionId);
    if (!spawn || !player) return { ok: false };
    if (
      !canInteract(
        { playerX: player.x, playerZ: player.z },
        { npcX: spawn.x, npcZ: spawn.z }
      )
    ) {
      return { ok: false };
    }
    return { ok: true, spawn };
  }

  private getMerchantListing(
    npcId: number,
    itemId: number
  ): MerchantItem | undefined {
    return this.db
      .select()
      .from(merchantItems)
      .where(and(eq(merchantItems.npcId, npcId), eq(merchantItems.itemId, itemId)))
      .get();
  }

  private syncItemsToPlayerState(sessionId: string): void {
    const player = this.state.players.get(sessionId);
    const items = this.playerItems.get(sessionId);
    if (!player || !items) return;

    player.items.clear();
    for (const [itemId, count] of Object.entries(items)) {
      if (count <= 0) continue;
      const stack = new ItemStackState();
      stack.itemId = Number(itemId);
      stack.count = count;
      player.items.set(String(itemId), stack);
    }
    this.syncInventoryMetricsToPlayerState(sessionId);
  }

  private buildItemWeightTable(): Record<number, number> {
    const table: Record<number, number> = {};
    for (const [itemId, item] of this.itemsById) {
      table[itemId] = item.weight ?? 0;
    }
    return table;
  }

  private syncInventoryMetricsToPlayerState(sessionId: string): void {
    const player = this.state.players.get(sessionId);
    const items = this.playerItems.get(sessionId);
    if (!player || !items) return;

    const weightTable = this.buildItemWeightTable();
    player.inventoryWeight = calcInventoryWeight(items, weightTable);
    player.inventorySlotsUsed = countInventorySlots(items);
    const template = this.classTemplatesById.get(player.classId);
    const baseCon = template?.baseCon ?? player.con;
    const effectiveCon = effectiveStat(baseCon, player.bonusCon);
    player.maxLoad = calcMaxLoad(effectiveCon);
  }

  private getItemCount(sessionId: string, itemId: number): number {
    return this.playerItems.get(sessionId)?.[itemId] ?? 0;
  }

  private getPlayerBasePAtk(player: PlayerState): number {
    const template = this.classTemplatesById.get(player.classId);
    if (!template) {
      return STARTER_COMBAT.pAtk;
    }
    const effectiveStr = effectiveStat(template.baseStr, player.bonusStr);
    return calcClassBasePAtk(
      { basePAtk: template.basePAtk, baseStr: effectiveStr },
      player.level
    );
  }

  private getPlayerPAtk(sessionId: string, player: PlayerState): number {
    const equipment = this.playerEquipment.get(sessionId) ?? [];
    const weaponRow =
      equipment.find((e) => e.slot === 'rhand') ??
      equipment.find((e) => e.slot === 'lrhand');
    const weapon = weaponRow ? this.itemsById.get(weaponRow.itemId) : undefined;
    const base = this.getPlayerBasePAtk(player);
    if (!weapon || weapon.pAtk == null) return base;
    return calcEffectivePAtk(
      base,
      { pAtk: weapon.pAtk, weaponType: weapon.weaponType, bodyPart: weapon.bodyPart },
      weaponRow?.enchantLevel ?? 0
    );
  }

  private getPlayerMAtk(player: PlayerState): number {
    const template = this.classTemplatesById.get(player.classId);
    if (!template) return 8;
    const baseMAtk = template.baseMAtk ?? 6;
    return calcPlayerMAtk(baseMAtk, template.baseInt, player.level);
  }

  private getSkillMAtk(player: PlayerState, skill: Skill): number {
    if (skill.effectKind === 'magic_damage') {
      return this.getPlayerMAtk(player);
    }
    return 0;
  }

  private getKnownSkillSet(sessionId: string): Set<number> {
    const skills = this.playerSkills.get(sessionId) ?? {};
    return new Set(Object.keys(skills).map(Number));
  }

  private syncPlayerSkillsToState(sessionId: string): void {
    const player = this.state.players.get(sessionId);
    const learned = this.playerSkills.get(sessionId);
    const combat = this.playerCombat.get(sessionId);
    if (!player || !learned) return;

    player.knownSkillIds.clear();
    player.skillCooldownEndMs.clear();
    const ids = Object.keys(learned)
      .map(Number)
      .sort((a, b) => a - b)
      .slice(0, 8);
    for (const skillId of ids) {
      player.knownSkillIds.push(skillId);
      player.skillCooldownEndMs.push(
        combat ? getSkillCooldownEnd(combat, skillId) : 0
      );
    }
    const psCd = combat ? getSkillCooldownEnd(combat, 3) : 0;
    player.powerStrikeCooldownEndMs = psCd;
    player.castingSkillId = combat?.castingSkillId ?? 0;
    player.castEndMs = combat?.castEndMs ?? 0;
    const buff = combat?.activeEffect;
    player.activeBuffSkillId =
      buff && buff.kind === 'buff_self' ? buff.skillId : 0;
    this.syncActiveEffectsToPlayerState(sessionId);
  }

  private syncActiveEffectsToPlayerState(sessionId: string): void {
    const player = this.state.players.get(sessionId);
    const combat = this.playerCombat.get(sessionId);
    if (!player) return;

    player.activeEffects.clear();
    const now = this.nowMs();
    const candidates = [];
    if (combat?.activeEffect && combat.activeEffect.expiresAtMs > now) {
      candidates.push(combat.activeEffect);
    }
    for (const fx of candidates.slice(0, 12)) {
      const entry = new EffectState();
      entry.skillId = fx.skillId;
      entry.kind = fx.kind;
      entry.expiresAtMs = fx.expiresAtMs;
      player.activeEffects.push(entry);
    }
  }

  private handleUseSkill(sessionId: string, skillId: number): void {
    const combat = this.playerCombat.get(sessionId);
    const player = this.state.players.get(sessionId);
    if (!combat || !player) return;

    const targetMobId = combat.targetMobId;
    const targetPlayerSessionId = combat.targetPlayerSessionId;
    if (!targetMobId && !targetPlayerSessionId) return;

    const known = this.getKnownSkillSet(sessionId);
    if (!known.has(skillId)) return;

    const skill = this.skillsById.get(skillId);
    if (!skill) return;

    if (targetMobId) {
      const mob = this.mobRuntime.get(targetMobId);
      if (!mob || mob.hp <= 0) return;
    } else {
      const target = this.state.players.get(targetPlayerSessionId!);
      if (!target || target.hp <= 0) return;
    }

    const now = this.nowMs();
    if (!canUseSkill(combat, skillId, known, now)) return;

    if (skill.hitTime > 0 && (skill.isMagic || skill.effectKind === 'buff_self' || skill.effectKind === 'debuff_enemy')) {
      if (player.mp < skill.mpConsumeL1) return;
      beginSkillCast(
        combat,
        skillId,
        targetMobId,
        skill.hitTime,
        now,
        targetPlayerSessionId
      );
      player.castingSkillId = combat.castingSkillId;
      player.castEndMs = combat.castEndMs;
      return;
    }

    combat.skillPending = true;
    combat.pendingSkillId = skillId;
  }

  private handleLearnSkill(sessionId: string, skillId: number): void {
    const combat = this.playerCombat.get(sessionId);
    const player = this.state.players.get(sessionId);
    const stored = this.characters.get(sessionId);
    const characterId = this.characterIds.get(sessionId);
    if (!combat || !player || !stored || !characterId) return;

    const trainerNpcId = combat.openTrainerNpcId;
    if (!trainerNpcId || !TRAINER_NPC_IDS.has(trainerNpcId)) return;
    if (!this.isNearNpc(sessionId, trainerNpcId).ok) return;

    const treeRow = this.db
      .select()
      .from(classSkillTree)
      .where(
        and(
          eq(classSkillTree.classId, player.classId),
          eq(classSkillTree.skillId, skillId),
          eq(classSkillTree.skillLevel, 1)
        )
      )
      .get();
    if (!treeRow) return;

    const learned = this.playerSkills.get(sessionId) ?? {};
    if (learned[skillId]) return;
    if (!canAffordSkill(player.sp, treeRow.levelUpSp)) return;

    const updated = { ...learned, [skillId]: 1 };
    player.sp = deductSkillSp(player.sp, treeRow.levelUpSp);
    stored.sp = player.sp;
    this.playerSkills.set(sessionId, updated);
    saveCharacterSkills(this.db, characterId, updated);
    this.syncPlayerSkillsToState(sessionId);
    this.scheduleDebouncedSave(sessionId);
  }

  private handleUseShot(sessionId: string, itemId: number): void {
    const player = this.state.players.get(sessionId);
    const combat = this.playerCombat.get(sessionId);
    if (!player || !combat || player.hp <= 0) return;

    const count = this.getItemCount(sessionId, itemId);
    if (count <= 0) return;

    if (itemId === SOULSHOT_ITEM_ID) {
      combat.armedShot = 'soul';
      this.setItemCount(sessionId, itemId, count - 1);
      return;
    }
    if (itemId === SPIRITSHOT_ITEM_ID) {
      combat.armedShot = 'spirit';
      this.setItemCount(sessionId, itemId, count - 1);
    }
  }

  private handleEquip(sessionId: string, itemId: number): void {
    const player = this.state.players.get(sessionId);
    const stored = this.characters.get(sessionId);
    if (!player || !stored || player.hp <= 0) return;

    const item = this.itemsById.get(itemId);
    const equipment = this.playerEquipment.get(sessionId) ?? [];
    const inventory = { ...(this.playerItems.get(sessionId) ?? {}) };
    const result = applyEquipTransaction({ itemId, item, inventory, equipment });
    if (!result) return;

    this.playerItems.set(sessionId, result.inventory);
    this.playerEquipment.set(sessionId, result.equipment);
    this.syncItemsToPlayerState(sessionId);
    this.syncEquipmentToPlayerState(sessionId);
    this.scheduleDebouncedSave(sessionId);
  }

  private handleUnequip(sessionId: string, slot: EquipSlot): void {
    const player = this.state.players.get(sessionId);
    if (!player || player.hp <= 0) return;
    if (!EQUIP_SLOTS.includes(slot)) return;

    const equipment = this.playerEquipment.get(sessionId) ?? [];
    const inventory = { ...(this.playerItems.get(sessionId) ?? {}) };
    const result = applyUnequipTransaction({ slot, equipment, inventory });
    if (!result) return;

    this.playerItems.set(sessionId, result.inventory);
    this.playerEquipment.set(sessionId, result.equipment);
    this.syncItemsToPlayerState(sessionId);
    this.syncEquipmentToPlayerState(sessionId);
    this.scheduleDebouncedSave(sessionId);
  }

  private handleCraft(sessionId: string, recipeId: number): void {
    const player = this.state.players.get(sessionId);
    const stored = this.characters.get(sessionId);
    if (!player || !stored || player.hp <= 0) return;

    const recipe = this.recipesById.get(recipeId);
    if (!recipe) return;
    const recipeItem = [...this.itemsById.values()].find(
      (i) => i.type === 'recipe' && i.recipeId === recipeId
    );
    if (!recipeItem?.recipeId) return;

    const craftRecipe = buildCraftRecipe(recipe, recipeItem.itemId);
    const inventory = { ...(this.playerItems.get(sessionId) ?? {}) };
    const reject = canCraft({
      classId: player.classId,
      recipe: craftRecipe,
      inventory,
      mp: player.mp,
    });
    if (reject) return;

    const result = applyCraft({ recipe: craftRecipe, inventory, mp: player.mp });
    this.playerItems.set(sessionId, result.inventory);
    player.mp = result.mp;
    stored.mp = result.mp;
    this.syncItemsToPlayerState(sessionId);
    this.scheduleDebouncedSave(sessionId);
  }

  private handleEnchant(sessionId: string, scrollItemId: number, slot: EquipSlot): void {
    const player = this.state.players.get(sessionId);
    if (!player || player.hp <= 0) return;

    const equipment = this.playerEquipment.get(sessionId) ?? [];
    const row = equipment.find((e) => e.slot === slot);
    if (!row) return;
    const item = this.itemsById.get(row.itemId);
    if (!item) return;

    const inventory = { ...(this.playerItems.get(sessionId) ?? {}) };
    const result = applyEnchantTransaction({
      slot,
      scrollItemId,
      item,
      equipment,
      inventory,
      rng: () => this.combatRng.nextFloat(),
    });
    if (!result) return;

    this.playerItems.set(sessionId, result.inventory);
    this.playerEquipment.set(sessionId, result.equipment);
    this.syncItemsToPlayerState(sessionId);
    this.syncEquipmentToPlayerState(sessionId);
    this.scheduleDebouncedSave(sessionId);
  }

  private syncEquipmentToPlayerState(sessionId: string): void {
    const player = this.state.players.get(sessionId);
    const stored = this.characters.get(sessionId);
    if (!player || !stored) return;

    const equipment = this.playerEquipment.get(sessionId) ?? [];
    syncEquipArrays(
      player.equipSlotIds,
      player.equipItemIds,
      player.equipEnchantLevels,
      equipment
    );

    const weaponId = weaponItemIdFromEquipment(equipment);
    player.equippedWeaponItemId = weaponId ?? 0;
    stored.equippedWeaponItemId = weaponId;

    const vitals = this.computePlayerVitals(player, equipment);
    player.pDef = vitals.pDef;
    const baseMaxHp = this.getBaseMaxHp(player);
    player.maxHp = baseMaxHp + vitals.maxHpBonus;
    stored.maxHp = player.maxHp;
  }

  private getBaseMaxHp(player: PlayerState): number {
    const curve = this.classVitalsByClassId.get(player.classId);
    const row = curve?.find((v) => v.level === player.level);
    return row?.hp ?? player.maxHp;
  }

  private computePlayerVitals(
    player: PlayerState,
    equipment: EquipmentRow[]
  ): { pDef: number; maxHpBonus: number } {
    const template = this.classTemplatesById.get(player.classId);
    const basePDef = template
      ? calcClassBasePDef({ baseCon: template.baseCon }, player.level)
      : 41;
    const armorPieces = equipment
      .map((e) => {
        const item = this.itemsById.get(e.itemId);
        if (!item || item.type === 'weapon' || item.type === 'shot') return null;
        return {
          itemId: e.itemId,
          pDef: item.pDef ?? 0,
          enchantLevel: e.enchantLevel,
        };
      })
      .filter((p): p is NonNullable<typeof p> => p !== null);
    const equippedIds = equipment.map((e) => e.itemId);
    return calcPlayerPDef(basePDef, armorPieces, equippedIds);
  }

  private getPlayerPDef(player: PlayerState): number {
    return player.pDef > 0
      ? player.pDef
      : calcClassBasePDef(
          { baseCon: this.classTemplatesById.get(player.classId)?.baseCon ?? 43 },
          player.level
        );
  }

  private handleUseItem(sessionId: string, itemId: number): void {
    const player = this.state.players.get(sessionId);
    const stored = this.characters.get(sessionId);
    if (!player || !stored || player.hp <= 0) return;

    const item = this.itemsById.get(itemId);
    const cooldownEndMs =
      itemId === HEALING_POTION_ITEM_ID ? player.healingPotionCooldownEndMs : 0;

    const result = resolveConsumableUse({
      itemId,
      itemType: item?.type,
      ownedCount: this.getItemCount(sessionId, itemId),
      hp: player.hp,
      maxHp: player.maxHp,
      healAmount: HEALING_POTION_HEAL_AMOUNT,
      reuseMs: HEALING_POTION_REUSE_MS,
      nowMs: this.nowMs(),
      cooldownEndMs,
    });

    if (!result.ok) return;

    player.hp = result.hp;
    stored.hp = result.hp;
    this.setItemCount(sessionId, itemId, result.itemCount);
    player.healingPotionCooldownEndMs = result.cooldownEndMs;
    this.scheduleDebouncedSave(sessionId);
  }

  private setItemCount(sessionId: string, itemId: number, count: number): void {
    const items = { ...(this.playerItems.get(sessionId) ?? {}) };
    if (count <= 0) {
      delete items[itemId];
    } else {
      items[itemId] = count;
    }
    this.playerItems.set(sessionId, items);
    this.syncItemsToPlayerState(sessionId);
  }

  private handleInteract(sessionId: string, npcId: number): void {
    const meta = this.db.select().from(npcs).where(eq(npcs.npcId, npcId)).get();
    if (!meta || meta.type === 'Guard') return;
    if (!this.isNearNpc(sessionId, npcId).ok) return;
    const combat = this.playerCombat.get(sessionId);
    if (combat && TRAINER_NPC_IDS.has(npcId)) {
      combat.openTrainerNpcId = npcId;
    }
    const client = this.clients.find((c) => c.sessionId === sessionId);
    const ctx = this.createQuestContext(sessionId);
    const questsAtNpc = getQuestEntriesForNpc(ctx, npcId);
    const hasNewQuest = questsAtNpc.some(
      ({ def, state }) => !state && canStartQuest(def, ctx.player.level, questCompletedIds(ctx.questEntries))
    );
    if (meta.type === 'Merchant' && hasNewQuest) {
      client?.send('interactResult', {
        npcId,
        type: meta.type,
        name: meta.name,
        questAvailable: true,
      });
      return;
    }
    const questDialog = buildQuestDialog(ctx, npcId);
    if (questDialog) {
      client?.send('questDialog', { npcId, ...questDialog });
      return;
    }
    client?.send('interactResult', { npcId, type: meta.type, name: meta.name });
  }

  private handleQuestAction(sessionId: string, npcId: number, action: string): void {
    if (!this.isNearNpc(sessionId, npcId).ok) return;
    handleQuestAction(this.createQuestContext(sessionId), npcId, action);
  }

  private createQuestContext(sessionId: string): QuestRoomContext {
    const characterId = this.characterIds.get(sessionId)!;
    const player = this.state.players.get(sessionId)!;
    const stored = this.characters.get(sessionId)!;
    const questEntries = this.playerQuests.get(sessionId) ?? [];
    return {
      db: this.db,
      characterId,
      player,
      stored,
      questDefs: this.questDefs,
      questEntries,
      playerItems: this.playerItems.get(sessionId) ?? {},
      experienceCurve: this.experienceCurve,
      setItemCount: (itemId, count) => this.setItemCount(sessionId, itemId, count),
      getItemCount: (itemId) => this.getItemCount(sessionId, itemId),
      persistItems: () => this.scheduleDebouncedSave(sessionId),
      persistCharacter: () => this.persistCharacter(sessionId),
      syncQuestEntries: () => this.syncQuestEntries(sessionId),
    };
  }

  private sendToSession(sessionId: string, type: string, payload: unknown): void {
    const client = this.clients.find((c) => c.sessionId === sessionId);
    client?.send(type, payload);
  }

  private createPartyDeps() {
    return {
      state: this.state,
      pendingInvites: this.pendingPartyInvites,
      partyMemberOrder: this.partyMemberOrder,
      allocPartyId: () => this.nextPartyId++,
      getPlayer: (sessionId: string) => this.state.players.get(sessionId),
      sendTo: (sessionId: string, type: string, payload: unknown) =>
        this.sendToSession(sessionId, type, payload),
    };
  }

  private createTradeDeps() {
    return {
      tradeSessions: this.tradeSessions,
      tradeSessionByPlayer: this.tradeSessionByPlayer,
      getPlayer: (sessionId: string) => this.state.players.get(sessionId),
      getItems: (sessionId: string) => this.playerItems.get(sessionId) ?? {},
      setItems: (sessionId: string, items: CharacterItemCounts) =>
        this.playerItems.set(sessionId, items),
      getEquipment: (sessionId: string) => this.playerEquipment.get(sessionId) ?? [],
      isQuestItem: (itemId: number) => isQuestItem(this.db, itemId),
      sendTo: (sessionId: string, type: string, payload: unknown) =>
        this.sendToSession(sessionId, type, payload),
      syncItems: (sessionId: string) => this.syncItemsToPlayerState(sessionId),
      persist: (sessionId: string) => this.persistCharacter(sessionId),
      nowMs: () => this.nowMs(),
    };
  }

  private createFriendDeps(): FriendHandlerDeps {
    return {
      db: this.db,
      characterIds: this.characterIds,
      sessionByCharacterId: this.sessionByCharacterId,
      connectedSessions: this.connectedSessions,
      nowMs: () => this.nowMs(),
      sendTo: (sessionId, type, payload) => this.sendToSession(sessionId, type, payload),
    };
  }

  private handleChatMessage(sessionId: string, message: { channel: string; text: string }): void {
    handleChat(
      {
        getPlayer: (id) => this.state.players.get(id),
        forEachPlayer: (fn) => {
          for (const [id, p] of this.state.players.entries()) fn(id, p);
        },
        chatRateBySession: this.chatRateBySession,
        nowMs: () => this.nowMs(),
        broadcastAll: (payload) => this.broadcast('chat', payload),
        sendTo: (targetId, payload) => this.sendToSession(targetId, 'chat', payload),
        getPartyMemberSessionIds: (partyId) =>
          getPartyMemberSessionIds(this.createPartyDeps(), partyId),
      },
      sessionId,
      message
    );
  }

  private syncQuestEntries(sessionId: string): void {
    const player = this.state.players.get(sessionId);
    const entries = this.playerQuests.get(sessionId) ?? [];
    if (!player) return;
    syncQuestEntriesToPlayer(player, entries);
  }

  private handleBuy(
    sessionId: string,
    npcId: number,
    itemId: number,
    quantity: number
  ): void {
    if (!this.isNearNpc(sessionId, npcId).ok) return;
    const player = this.state.players.get(sessionId);
    const stored = this.characters.get(sessionId);
    if (!player || !stored) return;

    const listing = this.getMerchantListing(npcId, itemId);
    if (!listing) return;

    const result = buyItem({
      adena: player.adena,
      itemCount: this.getItemCount(sessionId, itemId),
      listing,
      quantity,
      itemId,
    });
    if (!result.ok) return;

    player.adena = result.adena;
    stored.adena = result.adena;
    this.setItemCount(sessionId, itemId, result.itemCount);
    this.scheduleDebouncedSave(sessionId);
  }

  private handleSell(
    sessionId: string,
    npcId: number,
    itemId: number,
    quantity: number
  ): void {
    if (!this.isNearNpc(sessionId, npcId).ok) return;
    const player = this.state.players.get(sessionId);
    const stored = this.characters.get(sessionId);
    if (!player || !stored) return;

    const listing = this.getMerchantListing(npcId, itemId);
    if (!listing) return;

    const result = sellItem({
      adena: player.adena,
      itemCount: this.getItemCount(sessionId, itemId),
      listing,
      quantity,
      itemId,
      isQuestItem: isQuestItem(this.db, itemId),
    });
    if (!result.ok) return;

    player.adena = result.adena;
    stored.adena = result.adena;
    this.setItemCount(sessionId, itemId, result.itemCount);
    this.scheduleDebouncedSave(sessionId);
  }

  private syncWarehouseToPlayerState(sessionId: string): void {
    const player = this.state.players.get(sessionId);
    const warehouse = this.playerWarehouse.get(sessionId);
    if (!player || !warehouse) return;

    player.warehouseItemIds.clear();
    player.warehouseItemCounts.clear();
    const ids = Object.keys(warehouse)
      .map(Number)
      .filter((id) => (warehouse[id] ?? 0) > 0)
      .sort((a, b) => a - b);
    for (const itemId of ids) {
      player.warehouseItemIds.push(itemId);
      player.warehouseItemCounts.push(warehouse[itemId]!);
    }
  }

  private getWarehouseCount(sessionId: string, itemId: number): number {
    return this.playerWarehouse.get(sessionId)?.[itemId] ?? 0;
  }

  private setWarehouseCount(sessionId: string, itemId: number, count: number): void {
    const warehouse = { ...(this.playerWarehouse.get(sessionId) ?? {}) };
    if (count <= 0) {
      delete warehouse[itemId];
    } else {
      warehouse[itemId] = count;
    }
    this.playerWarehouse.set(sessionId, warehouse);
    this.syncWarehouseToPlayerState(sessionId);
  }

  private handleWarehouseDeposit(
    sessionId: string,
    npcId: number,
    itemId: number,
    quantity: number
  ): void {
    if (npcId !== WILFORD_NPC_ID) return;
    if (!this.isNearNpc(sessionId, npcId).ok) return;

    const characterId = this.characterIds.get(sessionId);
    if (!characterId) return;

    const inventoryCount = this.getItemCount(sessionId, itemId);
    const warehouseCount = this.getWarehouseCount(sessionId, itemId);
    const warehouse = this.playerWarehouse.get(sessionId) ?? {};

    const result = depositToWarehouse({
      inventoryCount,
      warehouseCount,
      quantity,
      isQuestItem: isQuestItem(this.db, itemId),
      distinctWarehouseItems: countDistinctWarehouseItems(warehouse),
    });
    if (!result.ok) return;

    this.setItemCount(sessionId, itemId, result.inventoryCount);
    this.setWarehouseCount(sessionId, itemId, result.warehouseCount);
    saveWarehouseItems(this.db, characterId, this.playerWarehouse.get(sessionId) ?? {});
    this.scheduleDebouncedSave(sessionId);
  }

  private handleWarehouseWithdraw(
    sessionId: string,
    npcId: number,
    itemId: number,
    quantity: number
  ): void {
    if (npcId !== WILFORD_NPC_ID) return;
    if (!this.isNearNpc(sessionId, npcId).ok) return;

    const characterId = this.characterIds.get(sessionId);
    if (!characterId) return;

    const result = withdrawFromWarehouse({
      inventoryCount: this.getItemCount(sessionId, itemId),
      warehouseCount: this.getWarehouseCount(sessionId, itemId),
      quantity,
    });
    if (!result.ok) return;

    this.setItemCount(sessionId, itemId, result.inventoryCount);
    this.setWarehouseCount(sessionId, itemId, result.warehouseCount);
    saveWarehouseItems(this.db, characterId, this.playerWarehouse.get(sessionId) ?? {});
    this.scheduleDebouncedSave(sessionId);
  }

  private handleTeleport(
    sessionId: string,
    npcId: number,
    destinationId: string
  ): void {
    if (npcId !== ROXXY_NPC_ID) return;
    if (!this.isNearNpc(sessionId, npcId).ok) return;

    const player = this.state.players.get(sessionId);
    const stored = this.characters.get(sessionId);
    if (!player || !stored || player.hp <= 0) return;

    const dest = this.db
      .select()
      .from(teleportDestinations)
      .where(
        and(
          eq(teleportDestinations.npcId, npcId),
          eq(teleportDestinations.destinationId, destinationId)
        )
      )
      .get();
    if (!dest) return;
    if (player.adena < dest.feeAdena) return;

    player.adena -= dest.feeAdena;
    stored.adena = player.adena;
    player.x = dest.localX;
    player.z = dest.localZ;
    player.y = snapEntityY(dest.localX, dest.localZ);
    player.zoneId = getZoneAt(dest.localX, dest.localZ).zoneId;
    stored.x = player.x;
    stored.y = player.y;
    stored.z = player.z;

    const tickState = this.tickStates.get(sessionId);
    if (tickState) {
      tickState.x = player.x;
      tickState.y = player.y;
      tickState.z = player.z;
      tickState.targetX = null;
      tickState.targetZ = null;
      tickState.waypoints = [];
      tickState.waypointIndex = 0;
    }

    this.scheduleDebouncedSave(sessionId);
  }

  private handleClassTransfer(
    sessionId: string,
    npcId: number,
    targetClassId: number
  ): void {
    const masterKind =
      npcId === BITZ_NPC_ID ? 'fighter' : npcId === BIOTIN_NPC_ID ? 'priest' : null;
    if (!masterKind) return;
    if (!this.isNearNpc(sessionId, npcId).ok) return;

    const player = this.state.players.get(sessionId);
    const stored = this.characters.get(sessionId);
    const characterId = this.characterIds.get(sessionId);
    if (!player || !stored || !characterId) return;

    if (
      !canTransferClass({
        currentClassId: player.classId,
        targetClassId,
        level: player.level,
        masterKind,
      })
    ) {
      return;
    }

    const template =
      this.classTemplatesById.get(targetClassId) ??
      loadClassTemplate(this.db, targetClassId);
    if (!template) return;

    const vitals = loadClassVitalsAtLevel(this.db, targetClassId, player.level);
    const maxHp = vitals?.maxHp ?? player.maxHp;
    const maxMp = vitals?.maxMp ?? player.maxMp;

    stored.classId = targetClassId;
    player.classId = targetClassId;
    player.str = template.baseStr;
    player.dex = template.baseDex;
    player.con = template.baseCon;
    player.int = template.baseInt;
    player.wit = template.baseWit;
    player.men = template.baseMen;
    player.maxHp = maxHp;
    player.maxMp = maxMp;
    player.hp = maxHp;
    player.mp = maxMp;
    stored.maxHp = maxHp;
    stored.maxMp = maxMp;
    stored.hp = maxHp;
    stored.mp = maxMp;

    this.classTemplatesById.set(targetClassId, template);

    const existing = this.playerSkills.get(sessionId) ?? {};
    const autoSkills = grantAutoGetSkills(this.db, characterId, targetClassId);
    const merged = { ...existing, ...autoSkills };
    this.playerSkills.set(sessionId, merged);
    saveCharacterSkills(this.db, characterId, merged);
    this.syncPlayerSkillsToState(sessionId);
    this.scheduleDebouncedSave(sessionId);
  }

  private handleNpcAction(
    sessionId: string,
    npcId: number,
    action: 'heal' | 'starterKit' | 'resurrect' | 'bless' | 'restoreExp'
  ): void {
    if (!this.isNearNpc(sessionId, npcId).ok) return;

    const player = this.state.players.get(sessionId);
    const stored = this.characters.get(sessionId);
    if (!player || !stored) return;

    if (npcId === ROXXY_NPC_ID) {
      if (action === 'heal') {
        const result = applyHeal({ hp: player.hp, maxHp: player.maxHp });
        if (!result.ok) return;
        player.hp = result.hp;
        stored.hp = result.hp;
        this.scheduleDebouncedSave(sessionId);
        return;
      }
      if (action === 'starterKit') {
        const result = applyStarterKit({
          starterKitGranted: stored.starterKitGranted,
          itemCounts: this.playerItems.get(sessionId) ?? {},
        });
        if (!result.ok) return;
        stored.starterKitGranted = result.starterKitGranted;
        this.playerItems.set(sessionId, result.itemCounts);
        this.syncItemsToPlayerState(sessionId);
        this.scheduleDebouncedSave(sessionId);
      }
      return;
    }

    if (npcId !== BIOTIN_NPC_ID) return;

    if (action === 'resurrect') {
      if (player.hp > 0) return;
      player.hp = player.maxHp;
      stored.hp = player.maxHp;
      this.scheduleDebouncedSave(sessionId);
      return;
    }

    if (action === 'heal') {
      const result = applyHeal({ hp: player.hp, maxHp: player.maxHp });
      if (!result.ok) return;
      player.hp = result.hp;
      stored.hp = result.hp;
      this.scheduleDebouncedSave(sessionId);
      return;
    }

    if (action === 'bless') {
      if (player.hp <= 0) return;
      const skill = this.skillsById.get(1068);
      const combat = this.playerCombat.get(sessionId);
      if (!combat || !skill?.buffMultiplier) return;
      const durationSec = skill.abnormalTime > 0 ? skill.abnormalTime : 1200;
      applyBuffSelf(combat, 1068, skill.buffMultiplier, durationSec, this.nowMs());
      player.activeBuffSkillId = 1068;
      this.scheduleDebouncedSave(sessionId);
      return;
    }

    if (action === 'restoreExp') {
      const result = applyRestoreExp(
        {
          xp: player.xp,
          expBeforeDeath: player.expBeforeDeath,
          adena: player.adena,
        },
        { costPerXp: 10 }
      );
      if (!result.ok) return;
      player.xp = result.xp;
      player.adena = result.adena;
      player.expBeforeDeath = result.expBeforeDeath;
      stored.xp = result.xp;
      stored.adena = result.adena;
      stored.expBeforeDeath = result.expBeforeDeath;
      this.scheduleDebouncedSave(sessionId);
    }
  }

  private handleTogglePvp(sessionId: string): void {
    const player = this.state.players.get(sessionId);
    const stored = this.characters.get(sessionId);
    if (!player || !stored || player.hp <= 0) return;
    if (
      handleTogglePvpIntent(player, stored, player.x, player.z, this.nowMs())
    ) {
      this.scheduleDebouncedSave(sessionId);
    }
  }

  private handleSetTargetPlayer(sessionId: string, targetSessionId: string): void {
    const combat = this.playerCombat.get(sessionId);
    const target = this.state.players.get(targetSessionId);
    if (!combat || !target || target.hp <= 0) return;
    if (handleSetTargetPlayer(combat, targetSessionId, sessionId)) {
      combat.targetMobId = null;
    }
  }

  private handleAllocateStat(sessionId: string, stat: string): void {
    const player = this.state.players.get(sessionId);
    const stored = this.characters.get(sessionId);
    if (!player || !stored) return;
    if (handleAllocateStat(player, stored, stat)) {
      this.scheduleDebouncedSave(sessionId);
    }
  }

  private handleResetStats(sessionId: string): void {
    const player = this.state.players.get(sessionId);
    const stored = this.characters.get(sessionId);
    const combat = this.playerCombat.get(sessionId);
    if (!player || !stored || !combat) return;
    const trainerNpcId = combat.openTrainerNpcId;
    if (!trainerNpcId || !TRAINER_NPC_IDS.has(trainerNpcId)) return;
    if (!this.isNearNpc(sessionId, trainerNpcId).ok) return;
    if (handleResetStats(player, stored)) {
      this.scheduleDebouncedSave(sessionId);
    }
  }

  private applyLevelChangeRewards(
    sessionId: string,
    player: PlayerState,
    stored: Character,
    prevLevel: number
  ): void {
    if (player.level > prevLevel) {
      const statAward = awardStatPointOnLevelUp(
        {
          unspentStatPoints: player.unspentStatPoints,
          bonusStr: player.bonusStr,
          bonusDex: player.bonusDex,
          bonusCon: player.bonusCon,
          bonusInt: player.bonusInt,
          bonusWit: player.bonusWit,
          bonusMen: player.bonusMen,
        },
        prevLevel,
        player.level
      );
      player.unspentStatPoints = statAward.unspentStatPoints;
      stored.unspentStatPoints = statAward.unspentStatPoints;

      const curve = this.classVitalsByClassId.get(player.classId);
      if (curve) {
        const rewarded = applyClassLevelUpReward(
          prevLevel,
          player.level,
          {
            maxHp: player.maxHp,
            maxMp: player.maxMp,
            hp: player.hp,
            mp: player.mp,
          },
          curve
        );
        player.maxHp = rewarded.maxHp;
        player.maxMp = rewarded.maxMp;
        player.hp = rewarded.hp;
        player.mp = rewarded.mp;
        stored.maxHp = rewarded.maxHp;
        stored.maxMp = rewarded.maxMp;
        stored.hp = rewarded.hp;
        stored.mp = rewarded.mp;
      }
    }
  }

  private applyDelevelVitals(
    player: PlayerState,
    stored: Character,
    prevLevel: number,
    newLevel: number
  ): void {
    if (newLevel >= prevLevel) return;
    const curve = this.classVitalsByClassId.get(player.classId);
    if (!curve) return;
    const atLevel = classVitalsAtLevel(curve, newLevel);
    player.maxHp = atLevel.maxHp;
    player.maxMp = atLevel.maxMp;
    stored.maxHp = atLevel.maxHp;
    stored.maxMp = atLevel.maxMp;
  }

  private loadClassTemplateData(): void {
    ensureStatBonusesRegistered();
    this.classTemplatesById.clear();
    this.classVitalsByClassId.clear();
    for (const row of this.db.select().from(classTemplates).all()) {
      this.classTemplatesById.set(row.classId, row);
      const curve = loadClassVitalsCurve(this.db, row.classId).map((v) => ({
        level: v.level,
        hp: v.hp,
        mp: v.mp,
      }));
      this.classVitalsByClassId.set(row.classId, curve);
    }
  }

  private loadCombatData(): void {
    this.experienceCurve = this.db.select().from(experience).all();
    this.experienceLossTable = this.db.select().from(experienceLoss).all();
    this.dropsByNpcId.clear();
    for (const row of this.db.select().from(mobDrops).all()) {
      const list = this.dropsByNpcId.get(row.npcId) ?? [];
      list.push({
        itemId: row.itemId,
        minCount: row.minCount,
        maxCount: row.maxCount,
        chance: row.chance,
      });
      this.dropsByNpcId.set(row.npcId, list);
    }

    this.itemsById.clear();
    for (const row of this.db.select().from(items).all()) {
      this.itemsById.set(row.itemId, row);
    }

    this.skillsById.clear();
    for (const row of this.db.select().from(skills).all()) {
      this.skillsById.set(row.skillId, row);
    }

    this.recipesById.clear();
    for (const row of this.db.select().from(recipes).all()) {
      this.recipesById.set(row.recipeId, row);
    }

    const powerStrike = this.skillsById.get(3) ?? this.ensurePowerStrikeSeeded();
    if (!powerStrike) {
      throw new Error('Power Strike (skillId 3) not found in database');
    }
    this.powerStrikeSkill = {
      powerL1: powerStrike.powerL1,
      mpConsumeL1: powerStrike.mpConsumeL1,
      reuseDelay: powerStrike.reuseDelay,
      castRange: powerStrike.castRange,
    };
  }

  private ensurePowerStrikeSeeded() {
    seedSkills(this.db, FIXTURE_DATA_DIR);
    for (const row of this.db.select().from(skills).all()) {
      this.skillsById.set(row.skillId, row);
    }
    return this.skillsById.get(3);
  }

  private resolvePendingSkill(
    sessionId: string,
    player: PlayerState,
    combat: PlayerCombatState,
    now: number
  ): void {
    const skillId = combat.pendingSkillId || 3;
    if (!combat.skillPending) return;
    if (!combat.targetMobId && !combat.targetPlayerSessionId) return;

    const skill = this.skillsById.get(skillId);
    if (!skill) return;

    if (combat.targetPlayerSessionId) {
      this.resolvePendingPlayerSkill(sessionId, player, combat, skill, now);
      return;
    }

    const runtime = this.mobRuntime.get(combat.targetMobId!);
    if (!runtime) return;

    const mobEffect = this.mobEffects.get(runtime.id) ?? { activeEffect: null };
    this.mobEffects.set(runtime.id, mobEffect);

    const template = this.classTemplatesById.get(player.classId);
    const result = resolveSkillUse({
      sessionId,
      playerX: player.x,
      playerZ: player.z,
      playerMp: player.mp,
      playerMAtk: this.getSkillMAtk(player, skill),
      playerPAtk: this.getPlayerPAtk(sessionId, player),
      playerCritRate: template?.baseCritRate ?? STARTER_COMBAT.critRate,
      playerDex: player.dex,
      combat,
      mob: runtime,
      mobEffect,
      skill,
      nowMs: now,
      rng: this.combatRng,
    });

    combat.skillPending = false;
    combat.pendingSkillId = 0;

    if (result.mpCost > 0) {
      player.mp -= result.mpCost;
      this.emitPlayerAction(player, EntityAction.Cast);
      this.syncPlayerSkillsToState(sessionId);
      this.scheduleDebouncedSave(sessionId);
    }

    if (result.damage > 0) {
      const mobState = this.state.mobs.get(runtime.id);
      if (mobState) syncMobState(mobState, runtime);
      if (result.killed) {
        this.handleMobKill(sessionId, runtime);
      }
    }
  }

  private resolvePendingPlayerSkill(
    sessionId: string,
    player: PlayerState,
    combat: PlayerCombatState,
    skill: Skill,
    now: number
  ): void {
    const targetSessionId = combat.targetPlayerSessionId;
    if (!targetSessionId) return;
    const target = this.state.players.get(targetSessionId);
    if (!target || target.hp <= 0) return;

    const template = this.classTemplatesById.get(player.classId);
    const result = resolvePlayerVsPlayerSkillUse({
      sessionId,
      playerX: player.x,
      playerZ: player.z,
      playerMp: player.mp,
      playerMAtk: this.getSkillMAtk(player, skill),
      playerPAtk: this.getPlayerPAtk(sessionId, player),
      playerCritRate: template?.baseCritRate ?? STARTER_COMBAT.critRate,
      combat,
      attacker: { pvpFlag: player.pvpFlag, karma: player.karma },
      target: {
        sessionId: targetSessionId,
        pvpFlag: target.pvpFlag,
        karma: target.karma,
        pDef: this.getPlayerPDef(target),
        hp: target.hp,
        x: target.x,
        z: target.z,
      },
      skill,
      nowMs: now,
      rng: this.combatRng,
    });

    combat.skillPending = false;
    combat.pendingSkillId = 0;

    if (result.ok && result.mpCost > 0) {
      player.mp -= result.mpCost;
      this.emitPlayerAction(player, EntityAction.Cast);
      this.syncPlayerSkillsToState(sessionId);
      this.scheduleDebouncedSave(sessionId);
    }

    if (result.ok && result.damage > 0) {
      const attackerStored = this.characters.get(sessionId);
      if (attackerStored) {
        extendAttackerPvpFlag(player, attackerStored, now);
      }
      this.emitPlayerAction(player, EntityAction.Cast);
      target.hp = Math.max(0, target.hp - result.damage);
      if (result.killed) {
        this.pendingPlayerKiller.set(targetSessionId, sessionId);
      }
      this.scheduleDebouncedSave(sessionId);
      this.scheduleDebouncedSave(targetSessionId);
    }
  }

  private resolveCastingSkills(now: number): void {
    for (const [sessionId, combat] of this.playerCombat.entries()) {
      if (combat.castingSkillId === 0 || combat.castEndMs > now) continue;
      const player = this.state.players.get(sessionId);
      const skill = this.skillsById.get(combat.castingSkillId);
      if (!player || !skill) {
        cancelSkillCast(combat);
        continue;
      }

      const playerTargetId = combat.castTargetPlayerSessionId;
      if (playerTargetId) {
        const target = this.state.players.get(playerTargetId);
        if (!target || target.hp <= 0) {
          cancelSkillCast(combat);
          player.castingSkillId = 0;
          player.castEndMs = 0;
          continue;
        }

        const template = this.classTemplatesById.get(player.classId);
        const result = resolvePlayerVsPlayerSkillUse({
          sessionId,
          playerX: player.x,
          playerZ: player.z,
          playerMp: player.mp,
          playerMAtk: this.getSkillMAtk(player, skill),
          playerPAtk: this.getPlayerPAtk(sessionId, player),
          playerCritRate: template?.baseCritRate ?? STARTER_COMBAT.critRate,
          combat,
          attacker: { pvpFlag: player.pvpFlag, karma: player.karma },
          target: {
            sessionId: playerTargetId,
            pvpFlag: target.pvpFlag,
            karma: target.karma,
            pDef: this.getPlayerPDef(target),
            hp: target.hp,
            x: target.x,
            z: target.z,
          },
          skill,
          nowMs: now,
          rng: this.combatRng,
        });

        cancelSkillCast(combat);
        player.castingSkillId = 0;
        player.castEndMs = 0;

        if (result.ok && result.mpCost > 0) {
          player.mp -= result.mpCost;
          this.emitPlayerAction(player, EntityAction.Cast);
          this.syncPlayerSkillsToState(sessionId);
          this.scheduleDebouncedSave(sessionId);
        }

        if (result.ok && result.damage > 0) {
          const attackerStored = this.characters.get(sessionId);
          if (attackerStored) {
            extendAttackerPvpFlag(player, attackerStored, now);
          }
          this.emitPlayerAction(player, EntityAction.Cast);
          target.hp = Math.max(0, target.hp - result.damage);
          if (result.killed) {
            this.pendingPlayerKiller.set(playerTargetId, sessionId);
          }
          this.scheduleDebouncedSave(sessionId);
          this.scheduleDebouncedSave(playerTargetId);
        }
        continue;
      }

      const targetId = combat.castTargetMobId;
      if (!targetId) {
        cancelSkillCast(combat);
        continue;
      }
      const runtime = this.mobRuntime.get(targetId);
      if (!runtime || runtime.hp <= 0) {
        cancelSkillCast(combat);
        player.castingSkillId = 0;
        player.castEndMs = 0;
        continue;
      }

      const mobEffect = this.mobEffects.get(runtime.id) ?? { activeEffect: null };
      this.mobEffects.set(runtime.id, mobEffect);

      const template = this.classTemplatesById.get(player.classId);
      const result = resolveSkillUse({
        sessionId,
        playerX: player.x,
        playerZ: player.z,
        playerMp: player.mp,
        playerMAtk: this.getSkillMAtk(player, skill),
        playerPAtk: this.getPlayerPAtk(sessionId, player),
        playerCritRate: template?.baseCritRate ?? STARTER_COMBAT.critRate,
        playerDex: player.dex,
        combat,
        mob: runtime,
        mobEffect,
        skill,
        nowMs: now,
        rng: this.combatRng,
      });

      cancelSkillCast(combat);
      player.castingSkillId = 0;
      player.castEndMs = 0;

      if (result.mpCost > 0) {
        player.mp -= result.mpCost;
        this.emitPlayerAction(player, EntityAction.Cast);
        this.syncPlayerSkillsToState(sessionId);
        this.scheduleDebouncedSave(sessionId);
      }

      if (result.damage > 0) {
        const mobState = this.state.mobs.get(runtime.id);
        if (mobState) syncMobState(mobState, runtime);
        if (result.killed) {
          this.handleMobKill(sessionId, runtime);
        }
      }
    }
  }

  private simulate(deltaTimeMs: number): void {
    const dt = deltaTimeMs / 1000;
    const now = this.nowMs();

    for (const [sessionId, player] of this.state.players.entries()) {
      const intent = this.pendingIntents.get(sessionId) ?? null;
      this.pendingIntents.delete(sessionId);
      let tickState = this.tickStates.get(sessionId);
      if (!tickState) continue;

      const standAt = this.respawnStandAtMs.get(sessionId);
      if (standAt !== undefined) {
        // Post-death freeze: the player has already respawned at town with full
        // HP, but stays put in the death pose (ignoring queued moves) until the
        // die clip finishes, then stands back up. Prevents the "sliding corpse".
        if (now >= standAt) {
          this.respawnStandAtMs.delete(sessionId);
          this.emitPlayerAction(player, EntityAction.None);
        }
        continue;
      }

      if (intent !== null) {
        const snapped = snapToNearestWalkable(intent.targetX, intent.targetZ);
        if (snapped) {
          const path = findPath({ x: tickState.x, z: tickState.z }, snapped);
          tickState = {
            ...tickState,
            waypoints: path,
            waypointIndex: 0,
            targetX: snapped.x,
            targetZ: snapped.z,
          };
        }
      }

      const beforeX = tickState.x;
      const beforeZ = tickState.z;
      const next = stepAlongPath(tickState, null, dt);

      let newX = next.x;
      let newZ = next.z;
      if (!isWalkable({ x: beforeX, z: beforeZ }, { x: newX, z: newZ })) {
        newX = beforeX;
        newZ = beforeZ;
      }

      const newY = snapEntityY(newX, newZ);
      const merged: PathMoveState = { ...next, x: newX, z: newZ, y: newY };
      this.tickStates.set(sessionId, merged);
      player.x = newX;
      player.z = newZ;
      player.y = newY;
      player.zoneId = getZoneAt(newX, newZ).zoneId;

      if (player.x !== beforeX || player.z !== beforeZ) {
        this.scheduleDebouncedSave(sessionId);
      }
    }

    const aiPlayers = [...this.state.players.entries()].map(([sessionId, player]) => ({
      sessionId,
      x: player.x,
      z: player.z,
    }));

    const mobPeers = [...this.mobRuntime.values()];

    for (const runtime of this.mobRuntime.values()) {
      if (runtime.hp <= 0) continue;
      if (!shouldTickMobAi(runtime, aiPlayers)) continue;
      tickMobAi(runtime, aiPlayers, dt, this.combatRng, now, mobPeers);
      runtime.y = snapEntityY(runtime.x, runtime.z);
      const mobState = this.state.mobs.get(runtime.id);
      if (mobState) syncMobState(mobState, runtime);
    }

    for (const combat of this.playerCombat.values()) {
      tickCombatEffects(combat, this.mobEffects, now);
    }

    tickPvpFlagsForPlayers(this.state.players.values(), now);

    for (const [sessionId, combat] of this.playerCombat.entries()) {
      const player = this.state.players.get(sessionId);
      if (!player) continue;
      const buff = combat.activeEffect;
      player.activeBuffSkillId =
        buff && buff.kind === 'buff_self' ? buff.skillId : 0;
      this.syncActiveEffectsToPlayerState(sessionId);
    }

    this.resolveCastingSkills(now);

    for (const [sessionId, combat] of this.playerCombat.entries()) {
      if (!combat.skillPending) continue;
      if (!combat.targetMobId && !combat.targetPlayerSessionId) continue;
      const player = this.state.players.get(sessionId);
      if (!player) continue;
      this.resolvePendingSkill(sessionId, player, combat, now);
    }

    for (const [sessionId, combat] of this.playerCombat.entries()) {
      if (!combat.attackPending || !combat.targetMobId) continue;
      const player = this.state.players.get(sessionId);
      const runtime = this.mobRuntime.get(combat.targetMobId);
      if (!player || !runtime) continue;

      const mobEffect = this.mobEffects.get(runtime.id);
      const result = resolvePlayerAttack({
        sessionId,
        playerX: player.x,
        playerZ: player.z,
        combat,
        mob: runtime,
        mobEffect,
        nowMs: now,
        rng: this.combatRng,
        attackerPAtk: this.getPlayerPAtk(sessionId, player),
        attackerCritRate: this.classTemplatesById.get(player.classId)?.baseCritRate,
        attackerDex: player.dex,
      });

      if (result.damage > 0) {
        this.emitPlayerAction(player, EntityAction.Attack);
        const mobState = this.state.mobs.get(runtime.id);
        if (mobState) syncMobState(mobState, runtime);
        if (result.killed) {
          this.handleMobKill(sessionId, runtime);
        }
      }
    }

    for (const [sessionId, combat] of this.playerCombat.entries()) {
      if (!combat.attackPending || !combat.targetPlayerSessionId) continue;
      const player = this.state.players.get(sessionId);
      const target = this.state.players.get(combat.targetPlayerSessionId);
      if (!player || !target) continue;

      const result = resolvePlayerVsPlayerMeleeAttack({
        sessionId,
        playerX: player.x,
        playerZ: player.z,
        combat,
        attacker: {
          pvpFlag: player.pvpFlag,
          karma: player.karma,
          pAtk: this.getPlayerPAtk(sessionId, player),
        },
        target: {
          sessionId: combat.targetPlayerSessionId,
          pvpFlag: target.pvpFlag,
          karma: target.karma,
          pDef: this.getPlayerPDef(target),
          hp: target.hp,
          x: target.x,
          z: target.z,
        },
        nowMs: now,
        rng: this.combatRng,
      });

      if (result.damage > 0) {
        const attackerStored = this.characters.get(sessionId);
        if (attackerStored) {
          extendAttackerPvpFlag(player, attackerStored, now);
        }
        this.emitPlayerAction(player, EntityAction.Attack);
        target.hp = Math.max(0, target.hp - result.damage);
        if (result.killed) {
          this.pendingPlayerKiller.set(combat.targetPlayerSessionId!, sessionId);
        }
        this.scheduleDebouncedSave(sessionId);
        this.scheduleDebouncedSave(combat.targetPlayerSessionId!);
      }
    }

    for (const runtime of this.mobRuntime.values()) {
      if (!runtime.targetSessionId || runtime.hp <= 0) continue;
      const target = this.state.players.get(runtime.targetSessionId);
      if (!target) continue;

      const mobResult = resolveMobAttack({
        mob: runtime,
        mobEffect: this.mobEffects.get(runtime.id),
        targetSessionId: runtime.targetSessionId,
        targetX: target.x,
        targetZ: target.z,
        targetHp: target.hp,
        targetDex: target.dex,
        targetPDef: this.getPlayerPDef(target),
        nowMs: now,
        rng: this.combatRng,
      });

      if (mobResult.damage > 0) {
        const targetCombat = this.playerCombat.get(runtime.targetSessionId);
        if (targetCombat) {
          applyDamageToCastingPlayer(targetCombat, mobResult.damage);
          target.castingSkillId = targetCombat.castingSkillId;
          target.castEndMs = targetCombat.castEndMs;
        }
        const mobState = this.state.mobs.get(runtime.id);
        if (mobState) {
          this.emitMobAction(mobState, EntityAction.Attack);
        }
        target.hp = Math.max(0, target.hp - mobResult.damage);
        this.scheduleDebouncedSave(runtime.targetSessionId);
      }
    }

    for (const [sessionId, player] of this.state.players.entries()) {
      if (player.hp <= 0) {
        this.handlePlayerDeath(sessionId);
      }
    }

    this.processRespawns(now);
  }

  private emitPlayerAction(player: PlayerState, action: EntityAction): void {
    player.action = action;
    player.actionSeq = (player.actionSeq + 1) & 0xffff;
  }

  private emitMobAction(mob: MobState, action: EntityAction): void {
    mob.action = action;
    mob.actionSeq = (mob.actionSeq + 1) & 0xffff;
  }

  private handlePlayerDeath(sessionId: string): void {
    const player = this.state.players.get(sessionId);
    const stored = this.characters.get(sessionId);
    if (!player || !stored) return;

    const killerSessionId = this.pendingPlayerKiller.get(sessionId);
    this.pendingPlayerKiller.delete(sessionId);
    const killerKind = killerSessionId ? 'player' : 'mob';

    this.emitPlayerAction(player, EntityAction.Die);

    const prevLevel = player.level;
    const penalty = calcDeathXpLoss(
      {
        level: player.level,
        xp: player.xp,
        karma: player.karma,
        killerKind,
      },
      this.experienceCurve,
      this.experienceLossTable
    );

    player.xp = penalty.newXp;
    player.expBeforeDeath = penalty.expBeforeDeath;
    stored.xp = penalty.newXp;
    stored.expBeforeDeath = penalty.expBeforeDeath;

    let newLevel = levelFromCumulativeXp(penalty.newXp, this.experienceCurve);
    const delevelMin = 10;
    if (prevLevel >= delevelMin && newLevel < delevelMin) {
      newLevel = delevelMin;
    }
    player.level = newLevel;
    stored.level = newLevel;

    this.applyDelevelVitals(player, stored, prevLevel, newLevel);

    if (killerSessionId) {
      const killer = this.state.players.get(killerSessionId);
      const killerStored = this.characters.get(killerSessionId);
      if (killer && killerStored) {
        applyPlayerKillKarma(killer, killerStored, player);
      }
    }

    const death = resolvePlayerDeath({
      level: player.level,
      xp: player.xp,
      maxHp: player.maxHp,
      maxMp: player.maxMp,
    });

    player.x = death.x;
    player.y = death.y;
    player.z = death.z;
    player.hp = death.hp;
    player.mp = death.mp;

    stored.x = death.x;
    stored.y = death.y;
    stored.z = death.z;
    stored.hp = death.hp;
    stored.mp = death.mp;

    const combat = this.playerCombat.get(sessionId);
    if (combat) {
      combat.targetMobId = null;
      combat.targetPlayerSessionId = null;
      combat.attackPending = false;
      combat.skillPending = false;
    }

    for (const runtime of this.mobRuntime.values()) {
      if (runtime.targetSessionId === sessionId) {
        runtime.targetSessionId = null;
      }
    }

    const tickState = this.tickStates.get(sessionId);
    if (tickState) {
      tickState.x = death.x;
      tickState.y = death.y;
      tickState.z = death.z;
      tickState.targetX = null;
      tickState.targetZ = null;
      tickState.waypoints = [];
      tickState.waypointIndex = 0;
    }

    this.pendingIntents.delete(sessionId);
    this.respawnStandAtMs.set(sessionId, this.nowMs() + PLAYER_DEATH_FREEZE_MS);

    this.persistCharacter(sessionId);
  }

  private handleMobKill(killerSessionId: string, runtime: MobRuntime): void {
    const killer = this.state.players.get(killerSessionId);
    const killerStored = this.characters.get(killerSessionId);
    if (!killer || !killerStored) return;

    const dropRows = this.dropsByNpcId.get(runtime.npcId) ?? [];

    if (killer.partyId !== 0) {
      const party = this.state.parties.get(String(killer.partyId));
      if (party) {
        const members = party.memberSessionIds
          .map((sessionId) => {
            const player = this.state.players.get(sessionId);
            const stored = this.characters.get(sessionId);
            if (!player || !stored) return null;
            return {
              sessionId,
              player,
              stored,
              inRange:
                horizontalDistance(player.x, player.z, runtime.x, runtime.z) <=
                PARTY_KILL_RANGE,
            };
          })
          .filter((m): m is NonNullable<typeof m> => m !== null);

        const result = resolvePartyKillRewards({
          killerSessionId,
          mobX: runtime.x,
          mobZ: runtime.z,
          mobExp: runtime.exp,
          mobSp: runtime.sp,
          mobNpcId: runtime.npcId,
          mobId: runtime.id,
          members,
          experienceCurve: this.experienceCurve,
          dropRows,
          rng: this.combatRng,
          classVitalsByClassId: this.classVitalsByClassId,
        });

        if (result) {
          for (const member of members) {
            this.persistCharacter(member.sessionId);
          }
          for (const [sessionId, drops] of result.dropsBySession.entries()) {
            if (drops.length === 0) continue;
            const inventory = { ...(this.playerItems.get(sessionId) ?? {}) };
            for (const drop of drops) {
              inventory[drop.itemId] = (inventory[drop.itemId] ?? 0) + drop.count;
            }
            this.playerItems.set(sessionId, inventory);
            this.syncItemsToPlayerState(sessionId);
          }

          for (const member of members) {
            if (!member.inRange) continue;
            onMobKilledForQuests(this.createQuestContext(member.sessionId), runtime.npcId);
          }
        }
      }
    } else {
      const prevLevel = killer.level;
      const kill: KillEvent = {
        mobId: runtime.id,
        npcId: runtime.npcId,
        killerSessionId,
        exp: runtime.exp,
        sp: runtime.sp,
        drops: [],
      };

      applyKillRewards(killer, kill, this.experienceCurve, dropRows, this.combatRng);
      killerStored.sp = killer.sp;
      killerStored.karma = killer.karma;
      killerStored.level = killer.level;
      killerStored.xp = killer.xp;

      if (kill.drops.length > 0) {
        const inventory = { ...(this.playerItems.get(killerSessionId) ?? {}) };
        for (const drop of kill.drops) {
          inventory[drop.itemId] = (inventory[drop.itemId] ?? 0) + drop.count;
        }
        this.playerItems.set(killerSessionId, inventory);
        this.syncItemsToPlayerState(killerSessionId);
      }

      this.applyLevelChangeRewards(killerSessionId, killer, killerStored, prevLevel);

      this.persistCharacter(killerSessionId);
      onMobKilledForQuests(this.createQuestContext(killerSessionId), runtime.npcId);
    }

    const mobState = this.state.mobs.get(runtime.id);
    if (mobState) {
      this.emitMobAction(mobState, EntityAction.Die);
    }

    this.state.mobs.delete(runtime.id);
    this.mobRuntime.delete(runtime.id);

    this.pendingRespawns.set(runtime.id, {
      runtime: { ...runtime },
      respawnAtMs: this.nowMs() + runtime.respawnSec * 1000,
    });
  }

  private processRespawns(now: number): void {
    for (const [id, pending] of this.pendingRespawns.entries()) {
      if (now < pending.respawnAtMs) continue;

      const spawn = loadMobSpawnRow(this.db, pending.runtime.spawnRowId);
      const template = loadMonsterTemplate(this.db, pending.runtime.npcId);
      if (!spawn || !template) {
        this.pendingRespawns.delete(id);
        continue;
      }

      const runtime: MobRuntime = { ...pending.runtime };
      respawnMobRuntime(runtime, template, spawn);

      const mobState = new MobState();
      mobState.id = id;
      mobState.npcId = runtime.npcId;
      syncMobState(mobState, runtime);

      this.state.mobs.set(id, mobState);
      this.mobRuntime.set(id, runtime);
      this.pendingRespawns.delete(id);
    }
  }

  override onJoin(client: Client, options: TownJoinOptions = {}): void {
    let character: Character | undefined;

    if (options.characterId) {
      character = loadCharacter(this.db, options.characterId);
      if (!character) {
        client.leave(4004, 'character not found');
        return;
      }
      if (
        options.accountName &&
        character.accountName !== options.accountName
      ) {
        client.leave(4003, 'character does not belong to account');
        return;
      }
    } else if (options.create) {
      if (!isStarterClassId(options.create.classId) || !isValidSex(options.create.sex)) {
        client.leave(4000, 'invalid character create options');
        return;
      }
      try {
        character = createCharacter(this.db, {
          classId: options.create.classId,
          sex: options.create.sex,
          accountName: options.create.accountName,
          name: options.create.name,
        });
      } catch {
        client.leave(4000, 'invalid character create options');
        return;
      }
    } else {
      character = createCharacter(this.db);
    }

    this.evictStaleSessionsForCharacter(character.id, client.sessionId);

    this.characterIds.set(client.sessionId, character.id);
    this.characters.set(client.sessionId, character);
    client.userData = { characterId: character.id };

    const template = this.classTemplatesById.get(character.classId) ??
      loadClassTemplate(this.db, character.classId);

    const player = new PlayerState();
    player.classId = character.classId;
    player.sex = character.sex;
    if (template) {
      player.str = template.baseStr;
      player.dex = template.baseDex;
      player.con = template.baseCon;
      player.int = template.baseInt;
      player.wit = template.baseWit;
      player.men = template.baseMen;
    }
    player.x = character.x;
    player.y = character.y;
    player.z = character.z;
    player.zoneId = getZoneAt(character.x, character.z).zoneId;
    player.hp = character.hp;
    player.mp = character.mp;
    player.maxHp = character.maxHp;
    player.maxMp = character.maxMp;
    player.equippedWeaponItemId = character.equippedWeaponItemId ?? 0;
    player.xp = character.xp;
    player.level = character.level;
    player.adena = character.adena;
    player.connected = true;
    player.characterName = character.name;
    player.sp = character.sp;
    player.karma = character.karma;
    player.expBeforeDeath = character.expBeforeDeath;
    player.unspentStatPoints = character.unspentStatPoints;
    player.bonusStr = character.bonusStr;
    player.bonusDex = character.bonusDex;
    player.bonusCon = character.bonusCon;
    player.bonusInt = character.bonusInt;
    player.bonusWit = character.bonusWit;
    player.bonusMen = character.bonusMen;
    player.pvpFlagEndMs = character.pvpFlagEndMs;
    player.pvpFlag =
      character.pvpFlagEndMs > this.nowMs() && character.pvpFlagEndMs > 0 ? 1 : 0;
    migrateLegacyWeapon(this.db, character.id, character.equippedWeaponItemId);
    const equipmentRows = loadEquipment(this.db, character.id);
    this.playerEquipment.set(client.sessionId, equipmentRows);
    this.playerItems.set(client.sessionId, loadCharacterItems(this.db, character.id));
    this.playerWarehouse.set(
      client.sessionId,
      loadWarehouseItems(this.db, character.id)
    );
    this.playerSkills.set(client.sessionId, loadCharacterSkills(this.db, character.id));
    this.playerQuests.set(client.sessionId, loadCharacterQuests(this.db, character.id));
    this.state.players.set(client.sessionId, player);
    this.syncItemsToPlayerState(client.sessionId);
    this.syncEquipmentToPlayerState(client.sessionId);
    this.syncWarehouseToPlayerState(client.sessionId);
    this.syncQuestEntries(client.sessionId);
    ensureAutoStartQuests(this.createQuestContext(client.sessionId));
    this.tickStates.set(
      client.sessionId,
      createPathMoveState(character.x, character.y, character.z)
    );
    this.playerCombat.set(client.sessionId, createPlayerCombatState());
    this.syncPlayerSkillsToState(client.sessionId);

    this.connectedSessions.add(client.sessionId);
    registerCharacterSession(this.createFriendDeps(), client.sessionId, character.id);
    syncFriendsToPlayer(this.createFriendDeps(), client.sessionId);

    client.send('characterId', character.id);
  }

  override async onDrop(client: Client): Promise<void> {
    this.clearSaveTimer(client.sessionId);
    this.persistCharacter(client.sessionId);

    const player = this.state.players.get(client.sessionId);
    if (player) {
      player.connected = false;
    }

    const reconnection = this.allowReconnection(client, 30);
    this.pendingReconnections.set(client.sessionId, reconnection);
    try {
      await reconnection;
    } catch {
      // reconnection window expired or evicted by a newer session — onLeave handles cleanup
    } finally {
      this.pendingReconnections.delete(client.sessionId);
    }
  }

  override onReconnect(client: Client): void {
    const player = this.state.players.get(client.sessionId);
    if (player) {
      player.connected = true;
    }
  }

  override onLeave(client: Client): void {
    this.clearSaveTimer(client.sessionId);
    this.persistCharacter(client.sessionId);
    const characterId = this.characterIds.get(client.sessionId);
    this.connectedSessions.delete(client.sessionId);
    if (characterId) {
      unregisterCharacterSession(this.createFriendDeps(), client.sessionId, characterId);
    }
    cleanupPartyOnDisconnect(this.createPartyDeps(), client.sessionId);
    cleanupTradeOnDisconnect(this.createTradeDeps(), client.sessionId);
    this.chatRateBySession.delete(client.sessionId);
    this.removePlayer(client.sessionId);
  }

  /**
   * Enforce a single live session per character. A browser refresh joins with a
   * fresh sessionId while the previous session is still inside its 30s
   * reconnection window, which would otherwise leave a ghost avatar standing
   * where the player last was. Evict any stale session for this character: drop
   * its state immediately and route it through the normal leave cleanup.
   */
  private evictStaleSessionsForCharacter(characterId: string, keepSessionId: string): void {
    for (const [sessionId, existingCharacterId] of [...this.characterIds.entries()]) {
      if (sessionId === keepSessionId || existingCharacterId !== characterId) continue;

      const reconnection = this.pendingReconnections.get(sessionId);
      if (reconnection) {
        reconnection.reject(new Error('replaced by a newer session'));
      } else {
        this.clients.find((c) => c.sessionId === sessionId)?.leave(4005);
      }
      this.removePlayer(sessionId);
    }
  }

  private removePlayer(sessionId: string): void {
    this.state.players.delete(sessionId);
    this.tickStates.delete(sessionId);
    this.pendingIntents.delete(sessionId);
    this.respawnStandAtMs.delete(sessionId);
    this.characterIds.delete(sessionId);
    this.characters.delete(sessionId);
    this.saveTimers.delete(sessionId);
    this.playerCombat.delete(sessionId);
    this.playerItems.delete(sessionId);
    this.playerWarehouse.delete(sessionId);
    this.playerSkills.delete(sessionId);
    this.playerQuests.delete(sessionId);
    this.playerEquipment.delete(sessionId);

    for (const runtime of this.mobRuntime.values()) {
      if (runtime.targetSessionId === sessionId) {
        runtime.targetSessionId = null;
      }
      if (runtime.lastAttackerSessionId === sessionId) {
        runtime.lastAttackerSessionId = null;
      }
    }
  }

  private persistCharacter(sessionId: string): void {
    const characterId = this.characterIds.get(sessionId);
    const player = this.state.players.get(sessionId);
    const stored = this.characters.get(sessionId);
    if (!characterId || !player || !stored) return;

    saveCharacter(this.db, {
      ...stored,
      level: player.level,
      xp: player.xp,
      hp: player.hp,
      mp: player.mp,
      maxHp: player.maxHp,
      maxMp: player.maxMp,
      equippedWeaponItemId: stored.equippedWeaponItemId,
      adena: player.adena,
      starterKitGranted: stored.starterKitGranted,
      x: player.x,
      y: player.y,
      z: player.z,
      sp: player.sp,
      karma: player.karma,
      pvpKills: stored.pvpKills,
      pkKills: stored.pkKills,
      expBeforeDeath: player.expBeforeDeath,
      unspentStatPoints: player.unspentStatPoints,
      bonusStr: player.bonusStr,
      bonusDex: player.bonusDex,
      bonusCon: player.bonusCon,
      bonusInt: player.bonusInt,
      bonusWit: player.bonusWit,
      bonusMen: player.bonusMen,
      pvpFlagEndMs: player.pvpFlagEndMs,
    });
    saveCharacterItems(this.db, characterId, this.playerItems.get(sessionId) ?? {});
    saveAllEquipment(this.db, characterId, this.playerEquipment.get(sessionId) ?? []);
    saveCharacterSkills(this.db, characterId, this.playerSkills.get(sessionId) ?? {});
  }

  private scheduleDebouncedSave(sessionId: string): void {
    this.clearSaveTimer(sessionId);
    const timer = setTimeout(() => {
      this.persistCharacter(sessionId);
      this.saveTimers.delete(sessionId);
    }, this.saveDebounceMs);
    this.saveTimers.set(sessionId, timer);
  }

  private clearSaveTimer(sessionId: string): void {
    const timer = this.saveTimers.get(sessionId);
    if (timer) {
      clearTimeout(timer);
      this.saveTimers.delete(sessionId);
    }
  }
}

function hashRoomId(roomId: string): number {
  let hash = 0;
  for (let i = 0; i < roomId.length; i++) {
    hash = (hash * 31 + roomId.charCodeAt(i)) >>> 0;
  }
  return hash || 1;
}
