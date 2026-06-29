import { describe, it, expect } from 'vitest';
import { freezeMobWander } from './mob-placement';
import type { MobRuntime } from './spawn-manager';

function stubRuntime(overrides: Partial<MobRuntime> = {}): MobRuntime {
  return {
    id: 'mob-1',
    npcId: 20001,
    spawnRowId: 1,
    x: 10,
    y: 0,
    z: 20,
    hp: 100,
    maxHp: 100,
    pAtk: 10,
    pDef: 5,
    attackSpeed: 1000,
    randomDamage: 5,
    attackRangeWorld: 2,
    aggroRangeWorld: 5,
    isAggressive: true,
    exp: 10,
    respawnSec: 30,
    spawnX: 10,
    spawnZ: 20,
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

describe('freezeMobWander', () => {
  it('pins wander target to current position and sets max cooldown', () => {
    const runtime = stubRuntime({ x: 30, z: -30, wanderCooldownMs: 0 });
    freezeMobWander(runtime);
    expect(runtime.wanderTargetX).toBe(30);
    expect(runtime.wanderTargetZ).toBe(-30);
    expect(runtime.wanderCooldownMs).toBe(Number.MAX_SAFE_INTEGER);
  });
});
