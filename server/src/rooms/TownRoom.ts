import { Room, Client } from 'colyseus';
import {
  step,
  createPathMoveState,
  isValidMoveIntent,
  createSeededRng,
  STARTER_COMBAT,
  effectivePAtk,
  calcClassBasePAtk,
  applyClassLevelUpReward,
  resolvePlayerDeath,
  stepAlongPath,
  snapEntityY,
  isWalkable,
  findPath,
  snapToNearestWalkable,
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
  type CharacterItemCounts,
  type CharacterSkillLevels,
} from '../db/character-repository';
import { loadQuestDefinitions } from '../db/quest-repository';
import {
  loadClassTemplate,
  loadClassVitalsCurve,
} from '../db/class-template-repository';
import { experience, mobDrops, skills, merchantItems, npcSpawns, npcs, items, classTemplates, classSkillTree, type Character, type MerchantItem, type Item, type ClassTemplate, type Skill } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { FIXTURE_DATA_DIR } from '../seed/seed';
import { seedSkills } from '../seed/seeders/skills.seeder';
import { TownState, PlayerState } from './schema/TownState';
import { MobState } from './schema/MobState';
import { NpcState } from './schema/NpcState';
import { ItemStackState } from './schema/ItemStackState';
import { tickMobAi } from './mob-ai';
import {
  createPlayerCombatState,
  resolvePlayerAttack,
  resolvePowerStrike,
  resolveSkillUse,
  resolveMobAttack,
  applyKillRewards,
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
import { validateEquip, applyEquip } from './equip-transaction';
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

const BITZ_NPC_ID = 30026;
const GWINTER_NPC_ID = 30027;
const BAULRO_NPC_ID = 30033;
const SOULSHOT_ITEM_ID = 1835;
const SPIRITSHOT_ITEM_ID = 2509;
const TRAINER_NPC_IDS = new Set([BITZ_NPC_ID, GWINTER_NPC_ID, BAULRO_NPC_ID]);

function questCompletedIds(entries: QuestRuntimeState[]): Set<number> {
  return new Set(entries.filter((e) => e.status === 'completed').map((e) => e.questId));
}

export interface TownJoinOptions {
  characterId?: string;
  create?: {
    classId: number;
    sex: 0 | 1;
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
  private dropsByNpcId = new Map<number, DropRow[]>();
  private itemsById = new Map<number, Item>();
  private powerStrikeSkill!: PowerStrikeSkill;
  private skillsById = new Map<number, Skill>();
  private playerSkills = new Map<string, CharacterSkillLevels>();
  private mobEffects = new Map<string, MobEffectState>();
  private nowMs = () => Date.now();
  private playerItems = new Map<string, CharacterItemCounts>();
  private playerQuests = new Map<string, QuestRuntimeState[]>();
  private questDefs = new Map<number, QuestDefinition>();
  private npcSpawnsById = new Map<number, { x: number; y: number; z: number }>();
  private classTemplatesById = new Map<number, ClassTemplate>();
  private classVitalsByClassId = new Map<number, ClassVitalsRow[]>();

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
      if (!combat || !combat.targetMobId) return;
      combat.attackPending = true;
    });

    this.onMessage('useSkill', (client, message: { skillId: number }) => {
      this.handleUseSkill(client.sessionId, message.skillId);
    });

    this.onMessage('learnSkill', (client, message: { skillId: number }) => {
      this.handleLearnSkill(client.sessionId, message.skillId);
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
      (client, message: { npcId: number; action: 'heal' | 'starterKit' }) => {
        this.handleNpcAction(client.sessionId, message.npcId, message.action);
      }
    );

    this.onMessage('equip', (client, message: { itemId: number }) => {
      this.handleEquip(client.sessionId, message.itemId);
    });

    this.onMessage('useItem', (client, message: { itemId: number }) => {
      this.handleUseItem(client.sessionId, message.itemId);
    });

    this.onMessage(
      'questAction',
      (client, message: { npcId: number; action: string }) => {
        this.handleQuestAction(client.sessionId, message.npcId, message.action);
      }
    );
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
  }

  private getItemCount(sessionId: string, itemId: number): number {
    return this.playerItems.get(sessionId)?.[itemId] ?? 0;
  }

  private getPlayerBasePAtk(player: PlayerState): number {
    const template = this.classTemplatesById.get(player.classId);
    if (!template) {
      return STARTER_COMBAT.pAtk;
    }
    return calcClassBasePAtk(
      { basePAtk: template.basePAtk, baseStr: template.baseStr },
      player.level
    );
  }

  private getPlayerPAtk(player: PlayerState): number {
    const weaponId = player.equippedWeaponItemId || null;
    const weapon = weaponId ? this.itemsById.get(weaponId) : undefined;
    return effectivePAtk(
      this.getPlayerBasePAtk(player),
      weaponId,
      weapon?.pAtk ?? undefined
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
  }

  private handleUseSkill(sessionId: string, skillId: number): void {
    const combat = this.playerCombat.get(sessionId);
    const player = this.state.players.get(sessionId);
    if (!combat || !player || !combat.targetMobId) return;

    const known = this.getKnownSkillSet(sessionId);
    if (!known.has(skillId)) return;

    const skill = this.skillsById.get(skillId);
    const mob = this.mobRuntime.get(combat.targetMobId);
    if (!skill || !mob || mob.hp <= 0) return;

    const now = this.nowMs();
    if (!canUseSkill(combat, skillId, known, now)) return;

    if (skill.hitTime > 0 && (skill.isMagic || skill.effectKind === 'buff_self' || skill.effectKind === 'debuff_enemy')) {
      if (player.mp < skill.mpConsumeL1) return;
      beginSkillCast(combat, skillId, combat.targetMobId, skill.hitTime, now);
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

    const updated = { ...learned, [skillId]: 1 };
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
    const currentEquipped = stored.equippedWeaponItemId;
    const result = validateEquip({
      itemId,
      itemType: item?.type,
      bodyPart: item?.bodyPart,
      ownedCount: this.getItemCount(sessionId, itemId),
      currentEquippedWeaponItemId: currentEquipped,
    });

    const equipped = applyEquip(currentEquipped, result);
    if (!result.ok) return;

    stored.equippedWeaponItemId = equipped;
    player.equippedWeaponItemId = equipped ?? 0;
    this.scheduleDebouncedSave(sessionId);
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
    if (!this.isNearNpc(sessionId, npcId).ok) return;
    const meta = this.db.select().from(npcs).where(eq(npcs.npcId, npcId)).get();
    if (!meta) return;
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

  private handleNpcAction(
    sessionId: string,
    npcId: number,
    action: 'heal' | 'starterKit'
  ): void {
    if (npcId !== 30006) return;
    if (!this.isNearNpc(sessionId, npcId).ok) return;

    const player = this.state.players.get(sessionId);
    const stored = this.characters.get(sessionId);
    if (!player || !stored) return;

    if (action === 'heal') {
      const result = applyHeal({ hp: player.hp, maxHp: player.maxHp });
      if (!result.ok) return;
      player.hp = result.hp;
      stored.hp = result.hp;
      this.scheduleDebouncedSave(sessionId);
      return;
    }

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

  private loadClassTemplateData(): void {
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
    if (!combat.skillPending || !combat.targetMobId) return;

    const skill = this.skillsById.get(skillId);
    const runtime = this.mobRuntime.get(combat.targetMobId);
    if (!skill || !runtime) return;

    const mobEffect = this.mobEffects.get(runtime.id) ?? { activeEffect: null };
    this.mobEffects.set(runtime.id, mobEffect);

    const template = this.classTemplatesById.get(player.classId);
    const result = resolveSkillUse({
      sessionId,
      playerX: player.x,
      playerZ: player.z,
      playerMp: player.mp,
      playerMAtk: this.getSkillMAtk(player, skill),
      playerPAtk: this.getPlayerPAtk(player),
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

  private resolveCastingSkills(now: number): void {
    for (const [sessionId, combat] of this.playerCombat.entries()) {
      if (combat.castingSkillId === 0 || combat.castEndMs > now) continue;
      const player = this.state.players.get(sessionId);
      const skill = this.skillsById.get(combat.castingSkillId);
      const targetId = combat.castTargetMobId;
      if (!player || !skill || !targetId) {
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
        playerPAtk: this.getPlayerPAtk(player),
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
      tickMobAi(runtime, aiPlayers, dt, this.combatRng, now, mobPeers);
      runtime.y = snapEntityY(runtime.x, runtime.z);
      const mobState = this.state.mobs.get(runtime.id);
      if (mobState) syncMobState(mobState, runtime);
    }

    for (const combat of this.playerCombat.values()) {
      tickCombatEffects(combat, this.mobEffects, now);
    }

    for (const [sessionId, combat] of this.playerCombat.entries()) {
      const player = this.state.players.get(sessionId);
      if (!player) continue;
      const buff = combat.activeEffect;
      player.activeBuffSkillId =
        buff && buff.kind === 'buff_self' ? buff.skillId : 0;
    }

    this.resolveCastingSkills(now);

    for (const [sessionId, combat] of this.playerCombat.entries()) {
      if (!combat.skillPending || !combat.targetMobId) continue;
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
        attackerPAtk: this.getPlayerPAtk(player),
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

    this.emitPlayerAction(player, EntityAction.Die);

    const death = resolvePlayerDeath({
      level: player.level,
      xp: player.xp,
      maxHp: player.maxHp,
      maxMp: player.maxMp,
    });

    player.xp = death.xp;
    player.x = death.x;
    player.y = death.y;
    player.z = death.z;
    player.hp = death.hp;
    player.mp = death.mp;

    stored.xp = death.xp;
    stored.x = death.x;
    stored.y = death.y;
    stored.z = death.z;
    stored.hp = death.hp;
    stored.mp = death.mp;

    const combat = this.playerCombat.get(sessionId);
    if (combat) {
      combat.targetMobId = null;
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

    this.persistCharacter(sessionId);
  }

  private handleMobKill(killerSessionId: string, runtime: MobRuntime): void {
    const player = this.state.players.get(killerSessionId);
    const stored = this.characters.get(killerSessionId);
    if (!player || !stored) return;

    const prevLevel = player.level;

    const kill: KillEvent = {
      mobId: runtime.id,
      npcId: runtime.npcId,
      killerSessionId,
      exp: runtime.exp,
      drops: [],
    };

    const dropRows = this.dropsByNpcId.get(runtime.npcId) ?? [];
    applyKillRewards(player, kill, this.experienceCurve, dropRows, this.combatRng);

    if (player.level > prevLevel) {
      const curve = this.classVitalsByClassId.get(player.classId);
      const rewarded = curve
        ? applyClassLevelUpReward(
            prevLevel,
            player.level,
            {
              maxHp: player.maxHp,
              maxMp: player.maxMp,
              hp: player.hp,
              mp: player.mp,
            },
            curve
          )
        : {
            maxHp: player.maxHp,
            maxMp: player.maxMp,
            hp: player.hp,
            mp: player.mp,
          };
      player.maxHp = rewarded.maxHp;
      player.maxMp = rewarded.maxMp;
      player.hp = rewarded.hp;
      player.mp = rewarded.mp;
      stored.maxHp = rewarded.maxHp;
      stored.maxMp = rewarded.maxMp;
      stored.hp = rewarded.hp;
      stored.mp = rewarded.mp;
    }

    this.persistCharacter(killerSessionId);

    onMobKilledForQuests(this.createQuestContext(killerSessionId), runtime.npcId);

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
    } else if (options.create) {
      if (!isStarterClassId(options.create.classId) || !isValidSex(options.create.sex)) {
        client.leave(4000, 'invalid character create options');
        return;
      }
      character = createCharacter(this.db, options.create);
    } else {
      character = createCharacter(this.db);
    }

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
    player.hp = character.hp;
    player.mp = character.mp;
    player.maxHp = character.maxHp;
    player.maxMp = character.maxMp;
    player.equippedWeaponItemId = character.equippedWeaponItemId ?? 0;
    player.xp = character.xp;
    player.level = character.level;
    player.adena = character.adena;
    player.connected = true;
    this.playerItems.set(client.sessionId, loadCharacterItems(this.db, character.id));
    this.playerSkills.set(client.sessionId, loadCharacterSkills(this.db, character.id));
    this.playerQuests.set(client.sessionId, loadCharacterQuests(this.db, character.id));
    this.state.players.set(client.sessionId, player);
    this.syncItemsToPlayerState(client.sessionId);
    this.syncQuestEntries(client.sessionId);
    ensureAutoStartQuests(this.createQuestContext(client.sessionId));
    this.tickStates.set(
      client.sessionId,
      createPathMoveState(character.x, character.y, character.z)
    );
    this.playerCombat.set(client.sessionId, createPlayerCombatState());
    this.syncPlayerSkillsToState(client.sessionId);

    client.send('characterId', character.id);
  }

  override async onDrop(client: Client): Promise<void> {
    this.clearSaveTimer(client.sessionId);
    this.persistCharacter(client.sessionId);

    const player = this.state.players.get(client.sessionId);
    if (player) {
      player.connected = false;
    }

    try {
      await this.allowReconnection(client, 30);
    } catch {
      // reconnection window expired — onLeave handles cleanup
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
    this.removePlayer(client.sessionId);
  }

  private removePlayer(sessionId: string): void {
    this.state.players.delete(sessionId);
    this.tickStates.delete(sessionId);
    this.pendingIntents.delete(sessionId);
    this.characterIds.delete(sessionId);
    this.characters.delete(sessionId);
    this.saveTimers.delete(sessionId);
    this.playerCombat.delete(sessionId);
    this.playerItems.delete(sessionId);
    this.playerSkills.delete(sessionId);
    this.playerQuests.delete(sessionId);

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
    });
    saveCharacterItems(this.db, characterId, this.playerItems.get(sessionId) ?? {});
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
