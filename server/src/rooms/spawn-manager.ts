import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { snapEntityY } from '@nj/game-core';
import type { AppDatabase } from '../db/client';
import { monsters, mobSpawns } from '../db/schema';
import { MobState } from './schema/MobState';
import type { TownState } from './schema/TownState';

/** L2 range units → local world metres (÷10 per AD-013). */
export function l2RangeToWorld(l2Units: number): number {
  return l2Units / 10;
}

export interface MobRuntime {
  id: string;
  npcId: number;
  spawnRowId: number;
  x: number;
  y: number;
  z: number;
  hp: number;
  maxHp: number;
  pAtk: number;
  pDef: number;
  attackSpeed: number;
  randomDamage: number;
  attackRangeWorld: number;
  aggroRangeWorld: number;
  isAggressive: boolean;
  exp: number;
  sp: number;
  respawnSec: number;
  aiType: string | null;
  clan: string | null;
  clanHelpRangeWorld: number;
  preferredAttackRangeWorld: number;
  spawnX: number;
  spawnZ: number;
  targetSessionId: string | null;
  lastAttackerSessionId: string | null;
  nextAttackAtMs: number;
  wasDamaged: boolean;
  wanderTargetX: number | null;
  wanderTargetZ: number | null;
  wanderCooldownMs: number;
}

export interface InitializeMobsOptions {
  createId?: () => string;
}

export function initializeMobs(
  db: AppDatabase,
  state: TownState,
  options: InitializeMobsOptions = {}
): Map<string, MobRuntime> {
  const createId = options.createId ?? randomUUID;
  const runtime = new Map<string, MobRuntime>();
  const spawnRows = db.select().from(mobSpawns).all();

  for (const spawn of spawnRows) {
    const template = db
      .select()
      .from(monsters)
      .where(eq(monsters.npcId, spawn.npcId))
      .get();

    if (!template) continue;

    const id = createId();
    const mobState = new MobState();
    mobState.id = id;
    mobState.npcId = spawn.npcId;
    mobState.name = template.name;
    mobState.level = template.level;
    const spawnY = snapEntityY(spawn.x, spawn.z);
    mobState.x = spawn.x;
    mobState.y = spawnY;
    mobState.z = spawn.z;
    mobState.hp = template.hp;
    mobState.maxHp = template.hp;

    state.mobs.set(id, mobState);

    runtime.set(id, {
      id,
      npcId: spawn.npcId,
      spawnRowId: spawn.id,
      x: spawn.x,
      y: spawnY,
      z: spawn.z,
      hp: template.hp,
      maxHp: template.hp,
      pAtk: template.pAtk,
      pDef: template.pDef,
      attackSpeed: template.attackSpeed,
      randomDamage: template.random,
      attackRangeWorld: l2RangeToWorld(template.attackRange),
      aggroRangeWorld: l2RangeToWorld(template.aggroRange),
      isAggressive: template.isAggressive,
      exp: template.exp,
      sp: template.sp,
      respawnSec: spawn.respawnSec,
      aiType: template.aiType ?? null,
      clan: template.clan ?? null,
      clanHelpRangeWorld: l2RangeToWorld(template.clanHelpRange ?? 0),
      preferredAttackRangeWorld: l2RangeToWorld(
        template.preferredAttackRange ?? template.attackRange
      ),
      spawnX: spawn.x,
      spawnZ: spawn.z,
      targetSessionId: null,
      lastAttackerSessionId: null,
      nextAttackAtMs: 0,
      wasDamaged: false,
      wanderTargetX: null,
      wanderTargetZ: null,
      wanderCooldownMs: 0,
    });
  }

  return runtime;
}

export function syncMobState(mobState: MobState, runtime: MobRuntime): void {
  if (mobState.x !== runtime.x) mobState.x = runtime.x;
  if (mobState.y !== runtime.y) mobState.y = runtime.y;
  if (mobState.z !== runtime.z) mobState.z = runtime.z;
  if (mobState.hp !== runtime.hp) mobState.hp = runtime.hp;
  if (mobState.maxHp !== runtime.maxHp) mobState.maxHp = runtime.maxHp;
  const aggro = runtime.targetSessionId ?? '';
  if (mobState.aggroTargetSessionId !== aggro) mobState.aggroTargetSessionId = aggro;
}

export function loadMobSpawnRow(
  db: AppDatabase,
  spawnRowId: number
): (typeof mobSpawns.$inferSelect) | undefined {
  return db.select().from(mobSpawns).where(eq(mobSpawns.id, spawnRowId)).get();
}

export function loadMonsterTemplate(
  db: AppDatabase,
  npcId: number
): (typeof monsters.$inferSelect) | undefined {
  return db.select().from(monsters).where(eq(monsters.npcId, npcId)).get();
}

export function respawnMobRuntime(
  runtime: MobRuntime,
  template: typeof monsters.$inferSelect,
  spawn: typeof mobSpawns.$inferSelect
): void {
  const spawnY = snapEntityY(spawn.x, spawn.z);
  runtime.x = spawn.x;
  runtime.y = spawnY;
  runtime.z = spawn.z;
  runtime.hp = template.hp;
  runtime.maxHp = template.hp;
  runtime.targetSessionId = null;
  runtime.lastAttackerSessionId = null;
  runtime.nextAttackAtMs = 0;
  runtime.wasDamaged = false;
  runtime.wanderTargetX = null;
  runtime.wanderTargetZ = null;
  runtime.wanderCooldownMs = 0;
  runtime.spawnX = spawn.x;
  runtime.spawnZ = spawn.z;
}
