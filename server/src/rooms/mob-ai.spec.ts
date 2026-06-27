import { describe, it, expect } from 'vitest';
import {
  DEFAULT_MOVE_SPEED,
  horizontalDistance,
  type SeededRng,
} from '@nj/game-core';
import { tickMobAi, WANDER_RADIUS, WANDER_SPEED_FACTOR } from './mob-ai';
import type { MobRuntime } from './spawn-manager';

const OUT_OF_PEACE = { x: 30, z: -30 };

function makeRng(sequence: number[]): SeededRng {
  let i = 0;
  return {
    nextFloat: () => sequence[i++] ?? 0.5,
    nextInt: (min: number) => min,
    nextDamageOffset: () => 0,
  };
}

function baseMob(overrides: Partial<MobRuntime> = {}): MobRuntime {
  return {
    id: 'mob-1',
    npcId: 20001,
    spawnRowId: 1,
    x: 0,
    y: 4.26,
    z: 0,
    hp: 41.145,
    maxHp: 41.145,
    pAtk: 8.47,
    pDef: 44.44,
    attackSpeed: 253,
    randomDamage: 30,
    attackRangeWorld: 4,
    aggroRangeWorld: 45,
    isAggressive: false,
    exp: 44,
    respawnSec: 27,
    spawnX: 0,
    spawnZ: 0,
    targetSessionId: null,
    lastAttackerSessionId: null,
    nextAttackAtMs: 0,
    wasDamaged: false,
    wanderTargetX: null,
    wanderTargetZ: null,
    wanderCooldownMs: 0,
    ...overrides,
  };
}

describe('tickMobAi', () => {
  it('aggressive Goblin acquires a player within 45 world units', () => {
    const mob = baseMob({
      npcId: 20003,
      isAggressive: true,
      x: 0,
      z: 0,
      aggroRangeWorld: 45,
    });
    const players = [{ sessionId: 'p1', x: 40, z: 0 }];

    tickMobAi(mob, players, 0.05, makeRng([0.5]), 0);

    expect(mob.targetSessionId).toBe('p1');
  });

  it('aggressive mob does not acquire a player beyond aggro range', () => {
    const mob = baseMob({
      isAggressive: true,
      aggroRangeWorld: 45,
      x: 0,
      z: 0,
    });
    const players = [{ sessionId: 'p1', x: 50, z: 0 }];

    tickMobAi(mob, players, 0.05, makeRng([0.5]), 0);

    expect(mob.targetSessionId).toBeNull();
  });

  it('passive Gremlin does not aggro until damaged', () => {
    const mob = baseMob({ isAggressive: false, x: 0, z: 0 });
    const players = [{ sessionId: 'p1', x: 5, z: 0 }];

    tickMobAi(mob, players, 0.05, makeRng([0.5]), 0);

    expect(mob.targetSessionId).toBeNull();
  });

  it('passive Gremlin retaliates against last attacker after being damaged', () => {
    const mob = baseMob({
      isAggressive: false,
      wasDamaged: true,
      lastAttackerSessionId: 'p1',
      x: OUT_OF_PEACE.x,
      z: OUT_OF_PEACE.z,
    });
    const players = [{ sessionId: 'p1', x: OUT_OF_PEACE.x + 5, z: OUT_OF_PEACE.z }];

    tickMobAi(mob, players, 0.05, makeRng([0.5]), 0);

    expect(mob.targetSessionId).toBe('p1');
  });

  it('wander keeps mob within 5 units of spawn', () => {
    const mob = baseMob({ spawnX: 10, spawnZ: -5, x: 10, z: -5 });
    const rng = makeRng([0.99, 0.99]);

    for (let t = 0; t < 600; t += 50) {
      tickMobAi(mob, [], 0.05, rng, t);
    }

    expect(
      horizontalDistance(mob.x, mob.z, mob.spawnX, mob.spawnZ)
    ).toBeLessThanOrEqual(WANDER_RADIUS + 0.01);
  });

  it('wander moves mob at most 30% of player speed over 3 seconds', () => {
    const mob = baseMob({ spawnX: 0, spawnZ: 0, x: 0, z: 0 });
    const startX = mob.x;
    const startZ = mob.z;
    const rng = makeRng([0.0, 0.0, 0.0, 0.0]);

    for (let i = 0; i < 60; i++) {
      tickMobAi(mob, [], 0.05, rng, i * 50);
    }

    const moved = horizontalDistance(startX, startZ, mob.x, mob.z);
    const maxDistance = DEFAULT_MOVE_SPEED * WANDER_SPEED_FACTOR * 3;
    expect(moved).toBeLessThanOrEqual(maxDistance + 0.5);
    expect(moved).toBeGreaterThan(0);
  });

  it('chase moves aggressive mob toward its target', () => {
    const mob = baseMob({
      isAggressive: true,
      x: OUT_OF_PEACE.x,
      z: OUT_OF_PEACE.z,
      targetSessionId: 'p1',
    });
    const players = [{ sessionId: 'p1', x: OUT_OF_PEACE.x + 20, z: OUT_OF_PEACE.z }];
    const startDist = horizontalDistance(mob.x, mob.z, OUT_OF_PEACE.x + 20, OUT_OF_PEACE.z);

    for (let i = 0; i < 20; i++) {
      tickMobAi(mob, players, 0.05, makeRng([0.5]), i * 50);
    }

    const endDist = horizontalDistance(mob.x, mob.z, OUT_OF_PEACE.x + 20, OUT_OF_PEACE.z);
    expect(endDist).toBeLessThan(startDist);
  });

  it('does not acquire a player standing inside the peace zone', () => {
    const mob = baseMob({
      isAggressive: true,
      x: 0,
      z: 0,
      aggroRangeWorld: 45,
    });
    const players = [{ sessionId: 'p1', x: 0, z: 0 }];

    tickMobAi(mob, players, 0.05, makeRng([0.5]), 0);

    expect(mob.targetSessionId).toBeNull();
  });

  it('clears target when player enters the peace zone', () => {
    const mob = baseMob({
      isAggressive: true,
      x: 0,
      z: 0,
      targetSessionId: 'p1',
    });
    const players = [{ sessionId: 'p1', x: 0, z: 0 }];

    tickMobAi(mob, players, 0.05, makeRng([0.5]), 0);

    expect(mob.targetSessionId).toBeNull();
  });
});
