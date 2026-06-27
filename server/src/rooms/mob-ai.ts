import {
  DEFAULT_MOVE_SPEED,
  horizontalDistance,
  isInPeaceZone,
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

export function tickMobAi(
  mob: MobRuntime,
  players: MobAiPlayer[],
  dt: number,
  rng: SeededRng,
  nowMs: number
): void {
  if (mob.hp <= 0) return;

  if (!mob.targetSessionId) {
    if (mob.isAggressive) {
      acquireAggressiveTarget(mob, players);
    } else if (mob.wasDamaged && mob.lastAttackerSessionId) {
      mob.targetSessionId = mob.lastAttackerSessionId;
    }
  }

  if (mob.targetSessionId) {
    const target = players.find((p) => p.sessionId === mob.targetSessionId);
    if (!target) {
      mob.targetSessionId = null;
    } else if (isInPeaceZone(target.x, target.z)) {
      mob.targetSessionId = null;
    } else {
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

  const step = Math.min(speed * dt, dist);
  mob.x += (dx / dist) * step;
  mob.z += (dz / dist) * step;
}
