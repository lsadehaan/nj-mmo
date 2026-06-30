import { describe, it, expect } from 'vitest';
import { isMobNearAnyPlayer, shouldTickMobAi } from './mob-ai';
import type { MobRuntime } from './spawn-manager';

function stubMob(overrides: Partial<MobRuntime> = {}): MobRuntime {
  return {
    id: 'm1',
    npcId: 20001,
    spawnRowId: 1,
    x: 0,
    z: 0,
    y: 0,
    hp: 100,
    maxHp: 100,
    pAtk: 10,
    pDef: 5,
    attackSpeed: 1000,
    randomDamage: 5,
    attackRangeWorld: 2,
    aggroRangeWorld: 10,
    isAggressive: true,
    exp: 10,
    sp: 0,
    respawnSec: 27,
    aiType: null,
    clan: null,
    clanHelpRangeWorld: 0,
    preferredAttackRangeWorld: 2,
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

describe('mob AI wake distance', () => {
  it('isMobNearAnyPlayer returns true within wake radius', () => {
    expect(isMobNearAnyPlayer(0, 0, [{ sessionId: 'p1', x: 50, z: 0 }], 120)).toBe(true);
  });

  it('isMobNearAnyPlayer returns false beyond wake radius', () => {
    expect(isMobNearAnyPlayer(0, 0, [{ sessionId: 'p1', x: 200, z: 0 }], 120)).toBe(false);
  });

  it('shouldTickMobAi stays awake when mob has a live target', () => {
    const mob = stubMob({ x: 500, z: 500, targetSessionId: 'p1' });
    expect(shouldTickMobAi(mob, [{ sessionId: 'p1', x: 0, z: 0 }])).toBe(true);
  });

  it('shouldTickMobAi sleeps when far from all players and idle', () => {
    const mob = stubMob({ x: 500, z: 500 });
    expect(shouldTickMobAi(mob, [{ sessionId: 'p1', x: 0, z: 0 }])).toBe(false);
  });
});
