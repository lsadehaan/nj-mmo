import { Room, Client } from 'colyseus';
import {
  step,
  createInitialMoveState,
  isValidMoveIntent,
  createSeededRng,
  type MovementIntent,
  type PlayerMoveState,
  type DropRow,
  type ExperienceCurveRow,
  type SeededRng,
} from '@nj/game-core';
import { getDb, type AppDatabase } from '../db/client';
import {
  createCharacter,
  loadCharacter,
  saveCharacter,
} from '../db/character-repository';
import { experience, mobDrops, skills, type Character } from '../db/schema';
import { eq } from 'drizzle-orm';
import { FIXTURE_DATA_DIR } from '../seed/seed';
import { seedSkills } from '../seed/seeders/skills.seeder';
import { TownState, PlayerState } from './schema/TownState';
import { MobState } from './schema/MobState';
import { tickMobAi } from './mob-ai';
import {
  createPlayerCombatState,
  resolvePlayerAttack,
  resolvePowerStrike,
  resolveMobAttack,
  applyKillRewards,
  type PlayerCombatState,
  type KillEvent,
  type PowerStrikeSkill,
} from './combat-resolver';
import {
  initializeMobs,
  syncMobState,
  loadMobSpawnRow,
  loadMonsterTemplate,
  respawnMobRuntime,
  type MobRuntime,
} from './spawn-manager';

export interface TownRoomOptions {
  dbPath?: string;
  saveDebounceMs?: number;
  combatSeed?: number;
  combatRng?: SeededRng;
  nowMs?: () => number;
}

const DEFAULT_DB_PATH = process.env['NJ_DB_PATH'] ?? 'data/game.db';
const DEFAULT_SAVE_DEBOUNCE_MS = 5000;

interface PendingRespawn {
  runtime: MobRuntime;
  respawnAtMs: number;
}

export class TownRoom extends Room<{ state: TownState }> {
  declare state: TownState;

  private db!: AppDatabase;
  private saveDebounceMs = DEFAULT_SAVE_DEBOUNCE_MS;
  private tickStates = new Map<string, PlayerMoveState>();
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
  private powerStrikeSkill!: PowerStrikeSkill;
  private nowMs = () => Date.now();

  override onCreate(options: TownRoomOptions = {}): void {
    this.db = getDb(options.dbPath ?? DEFAULT_DB_PATH);
    this.saveDebounceMs = options.saveDebounceMs ?? DEFAULT_SAVE_DEBOUNCE_MS;
    this.nowMs = options.nowMs ?? (() => Date.now());
    this.combatRng =
      options.combatRng ??
      createSeededRng(options.combatSeed ?? hashRoomId(this.roomId));

    this.loadCombatData();
    this.setState(new TownState());
    this.mobRuntime = initializeMobs(this.db, this.state);
    this.autoDispose = true;
    this.setSimulationInterval((deltaTimeMs) => this.simulate(deltaTimeMs), 50);

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
      if (message.skillId !== 3) return;
      const combat = this.playerCombat.get(client.sessionId);
      if (!combat || !combat.targetMobId) return;
      const mob = this.mobRuntime.get(combat.targetMobId);
      if (!mob || mob.hp <= 0) return;
      combat.skillPending = true;
    });
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

    const powerStrike =
      this.db.select().from(skills).where(eq(skills.skillId, 3)).get() ??
      this.ensurePowerStrikeSeeded();
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
    return this.db.select().from(skills).where(eq(skills.skillId, 3)).get();
  }

  private simulate(deltaTimeMs: number): void {
    const dt = deltaTimeMs / 1000;
    const now = this.nowMs();

    for (const [sessionId, player] of this.state.players.entries()) {
      const intent = this.pendingIntents.get(sessionId) ?? null;
      this.pendingIntents.delete(sessionId);
      const tickState = this.tickStates.get(sessionId);
      if (!tickState) continue;

      const beforeX = player.x;
      const beforeZ = player.z;
      const next = step(tickState, intent, dt);
      this.tickStates.set(sessionId, next);
      player.x = next.x;
      player.z = next.z;

      if (player.x !== beforeX || player.z !== beforeZ) {
        this.scheduleDebouncedSave(sessionId);
      }
    }

    const aiPlayers = [...this.state.players.entries()].map(([sessionId, player]) => ({
      sessionId,
      x: player.x,
      z: player.z,
    }));

    for (const runtime of this.mobRuntime.values()) {
      if (runtime.hp <= 0) continue;
      tickMobAi(runtime, aiPlayers, dt, this.combatRng, now);
      const mobState = this.state.mobs.get(runtime.id);
      if (mobState) syncMobState(mobState, runtime);
    }

    for (const [sessionId, combat] of this.playerCombat.entries()) {
      if (!combat.skillPending || !combat.targetMobId) continue;
      const player = this.state.players.get(sessionId);
      const runtime = this.mobRuntime.get(combat.targetMobId);
      if (!player || !runtime) continue;

      const result = resolvePowerStrike({
        sessionId,
        playerX: player.x,
        playerZ: player.z,
        playerMp: player.mp,
        combat,
        mob: runtime,
        skill: this.powerStrikeSkill,
        nowMs: now,
        rng: this.combatRng,
      });

      if (result.mpCost > 0) {
        player.mp -= result.mpCost;
        player.powerStrikeCooldownEndMs = result.cooldownEndMs;
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

    for (const [sessionId, combat] of this.playerCombat.entries()) {
      if (!combat.attackPending || !combat.targetMobId) continue;
      const player = this.state.players.get(sessionId);
      const runtime = this.mobRuntime.get(combat.targetMobId);
      if (!player || !runtime) continue;

      const result = resolvePlayerAttack({
        sessionId,
        playerX: player.x,
        playerZ: player.z,
        combat,
        mob: runtime,
        nowMs: now,
        rng: this.combatRng,
      });

      if (result.damage > 0) {
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
        targetSessionId: runtime.targetSessionId,
        targetX: target.x,
        targetZ: target.z,
        targetHp: target.hp,
        nowMs: now,
        rng: this.combatRng,
      });

      if (mobResult.damage > 0) {
        target.hp = Math.max(0, target.hp - mobResult.damage);
      }
    }

    this.processRespawns(now);
  }

  private handleMobKill(killerSessionId: string, runtime: MobRuntime): void {
    const player = this.state.players.get(killerSessionId);
    if (!player) return;

    const kill: KillEvent = {
      mobId: runtime.id,
      npcId: runtime.npcId,
      killerSessionId,
      exp: runtime.exp,
      drops: [],
    };

    const dropRows = this.dropsByNpcId.get(runtime.npcId) ?? [];
    applyKillRewards(player, kill, this.experienceCurve, dropRows, this.combatRng);
    this.persistCharacter(killerSessionId);

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

  override onJoin(client: Client, options: { characterId?: string } = {}): void {
    let character: Character;
    if (options.characterId) {
      character = loadCharacter(this.db, options.characterId) ?? createCharacter(this.db);
    } else {
      character = createCharacter(this.db);
    }

    this.characterIds.set(client.sessionId, character.id);
    this.characters.set(client.sessionId, character);
    client.userData = { characterId: character.id };

    const player = new PlayerState();
    player.x = character.x;
    player.y = character.y;
    player.z = character.z;
    player.hp = character.hp;
    player.mp = character.mp;
    player.xp = character.xp;
    player.level = character.level;
    player.connected = true;
    this.state.players.set(client.sessionId, player);
    this.tickStates.set(
      client.sessionId,
      createInitialMoveState(character.x, character.y, character.z)
    );
    this.playerCombat.set(client.sessionId, createPlayerCombatState());

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
      x: player.x,
      y: player.y,
      z: player.z,
    });
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
