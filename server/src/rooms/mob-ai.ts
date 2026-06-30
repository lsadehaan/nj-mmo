import {
  DEFAULT_MOVE_SPEED,
  horizontalDistance,
  isInPeaceZone,
  isWalkable,
  isInRangedAttackBand,
  shouldRangedMobAdvance,
  MOB_AI_WAKE_DISTANCE,
  type SeededRng,
} from '@nj/game-core';
import type { MobRuntime } from './spawn-manager';

export const WANDER_RADIUS = 5;
export const WANDER_SPEED_FACTOR = 0.3;
const WANDER_REPICK_MS = 3000;
const CHASE_SPEED = DEFAULT_MOVE_SPEED * 0.5;

export interface MobAiPlayer {
  sessionId: string;
  x: number;
  z: number;
}

export function isMobNearAnyPlayer(
  mobX: number,
  mobZ: number,
  players: MobAiPlayer[],
  wakeDistance = MOB_AI_WAKE_DISTANCE
): boolean {
  const r2 = wakeDistance * wakeDistance;
  for (const p of players) {
    const dx = mobX - p.x;
    const dz = mobZ - p.z;
    if (dx * dx + dz * dz <= r2) return true;
  }
  return false;
}

/** Skip AI for distant idle mobs — major server CPU + schema bandwidth saver. */
export function shouldTickMobAi(
  mob: MobRuntime,
  players: MobAiPlayer[],
  wakeDistance = MOB_AI_WAKE_DISTANCE
): boolean {
  if (mob.targetSessionId && players.some((p) => p.sessionId === mob.targetSessionId)) {
    return true;
  }
  return isMobNearAnyPlayer(mob.x, mob.z, players, wakeDistance);
}

export function findClanAssistTargets(
  source: MobRuntime,
  peers: MobRuntime[],
  clanHelpRangeWorld: number
): MobRuntime[] {
  if (!source.clan || !source.targetSessionId) return [];
  if (source.clan !== 'WEREWOLF') return [];
  return peers.filter(
    (p) =>
      p.id !== source.id &&
      p.hp > 0 &&
      p.clan === source.clan &&
      !p.targetSessionId &&
      horizontalDistance(source.x, source.z, p.x, p.z) <= clanHelpRangeWorld
  );
}

export function applyClanAssist(
  source: MobRuntime,
  peers: MobRuntime[],
  clanHelpRangeWorld: number
): void {
  if (!source.targetSessionId) return;
  for (const peer of findClanAssistTargets(source, peers, clanHelpRangeWorld)) {
    peer.targetSessionId = source.targetSessionId;
  }
}

export function tickMobAi(
  mob: MobRuntime,
  players: MobAiPlayer[],
  dt: number,
  rng: SeededRng,
  nowMs: number,
  peers: MobRuntime[] = []
): void {
  if (mob.hp <= 0) return;

  const hadTarget = mob.targetSessionId;

  if (!mob.targetSessionId) {
    if (mob.isAggressive) {
      acquireAggressiveTarget(mob, players);
    } else if (mob.wasDamaged && mob.lastAttackerSessionId) {
      mob.targetSessionId = mob.lastAttackerSessionId;
    }
  }

  if (!hadTarget && mob.targetSessionId) {
    applyClanAssist(mob, peers, mob.clanHelpRangeWorld);
  }

  if (mob.targetSessionId) {
    const target = players.find((p) => p.sessionId === mob.targetSessionId);
    if (!target) {
      mob.targetSessionId = null;
    } else if (isInPeaceZone(target.x, target.z)) {
      mob.targetSessionId = null;
    } else {
      const dist = horizontalDistance(mob.x, mob.z, target.x, target.z);
      if (
        mob.aiType === 'ARCHER' &&
        isInRangedAttackBand(dist, mob.attackRangeWorld, mob.preferredAttackRangeWorld)
      ) {
        return;
      }
      if (
        mob.aiType === 'ARCHER' &&
        !shouldRangedMobAdvance(dist, mob.attackRangeWorld, mob.preferredAttackRangeWorld) &&
        dist >= mob.attackRangeWorld
      ) {
        return;
      }
      moveToward(mob, target.x, target.z, CHASE_SPEED, dt);
      return;
    }
  }

  tickWander(mob, dt, rng, nowMs);
}

function acquireAggressiveTarget(mob: MobRuntime, players: MobAiPlayer[]): void {
  let nearest: MobAiPlayer | null = null;
  let nearestDist = Infinity;

  for (const player of players) {
    if (isInPeaceZone(player.x, player.z)) continue;
    const dist = horizontalDistance(mob.x, mob.z, player.x, player.z);
    if (dist <= mob.aggroRangeWorld && dist < nearestDist) {
      nearest = player;
      nearestDist = dist;
    }
  }

  if (nearest) {
    mob.targetSessionId = nearest.sessionId;
  }
}

function tickWander(
  mob: MobRuntime,
  dt: number,
  rng: SeededRng,
  nowMs: number
): void {
  if (mob.wanderCooldownMs >= Number.MAX_SAFE_INTEGER) return;

  if (mob.wanderCooldownMs <= nowMs || mob.wanderTargetX === null) {
    pickWanderTarget(mob, rng);
    mob.wanderCooldownMs = nowMs + WANDER_REPICK_MS;
  }

  if (mob.wanderTargetX !== null && mob.wanderTargetZ !== null) {
    moveToward(
      mob,
      mob.wanderTargetX,
      mob.wanderTargetZ,
      DEFAULT_MOVE_SPEED * WANDER_SPEED_FACTOR,
      dt
    );

    if (
      horizontalDistance(mob.x, mob.z, mob.wanderTargetX, mob.wanderTargetZ) <=
      0.05
    ) {
      mob.wanderTargetX = null;
      mob.wanderTargetZ = null;
    }
  }
}

function pickWanderTarget(mob: MobRuntime, rng: SeededRng): void {
  const angle = rng.nextFloat() * Math.PI * 2;
  const radius = rng.nextFloat() * WANDER_RADIUS;
  mob.wanderTargetX = mob.spawnX + Math.cos(angle) * radius;
  mob.wanderTargetZ = mob.spawnZ + Math.sin(angle) * radius;
}

function moveToward(
  mob: MobRuntime,
  targetX: number,
  targetZ: number,
  speed: number,
  dt: number
): void {
  const dx = targetX - mob.x;
  const dz = targetZ - mob.z;
  const dist = Math.hypot(dx, dz);
  if (dist <= 0.05) return;

  const stepDist = Math.min(speed * dt, dist);
  if (dist - stepDist <= 0.05) return;

  const newX = mob.x + (dx / dist) * stepDist;
  const newZ = mob.z + (dz / dist) * stepDist;

  if (!isWalkable({ x: mob.x, z: mob.z }, { x: newX, z: newZ })) {
    return;
  }

  mob.x = newX;
  mob.z = newZ;
}
