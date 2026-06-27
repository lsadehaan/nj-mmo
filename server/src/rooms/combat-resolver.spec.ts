import { describe, it, expect } from 'vitest';
import {
  STARTER_COMBAT,
  GREMLIN_COMBAT,
  createSeededRng,
  GOBLIN_ADENA_DROP_ROW,
  GOBLIN_ADENA_DROP_SEED,
  type DropRow,
  type ExperienceCurveRow,
} from '@nj/game-core';
import {
  createPlayerCombatState,
  resolvePlayerAttack,
  resolvePowerStrike,
  resolveMobAttack,
  applyKillRewards,
  type KillEvent,
} from './combat-resolver';
import type { MobRuntime } from './spawn-manager';

const OUT_OF_PEACE = { x: 30, z: -30 };

const TEST_CURVE: ExperienceCurveRow[] = [
  { level: 1, xpToNextLevel: 0 },
  { level: 2, xpToNextLevel: 68 },
  { level: 3, xpToNextLevel: 364 },
];

function gremlinMob(overrides: Partial<MobRuntime> = {}): MobRuntime {
  return {
    id: 'gremlin-1',
    npcId: 20001,
    spawnRowId: 1,
    x: OUT_OF_PEACE.x,
    y: 4.26,
    z: OUT_OF_PEACE.z,
    hp: 41.145,
    maxHp: 41.145,
    pAtk: 8.47458,
    pDef: GREMLIN_COMBAT.pDef,
    attackSpeed: 253,
    randomDamage: 30,
    attackRangeWorld: 4,
    aggroRangeWorld: 0,
    isAggressive: false,
    exp: 44,
    respawnSec: 27,
    spawnX: OUT_OF_PEACE.x,
    spawnZ: OUT_OF_PEACE.z,
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

const POWER_STRIKE_SKILL = {
  powerL1: 30,
  mpConsumeL1: 9,
  reuseDelay: 3000,
  castRange: 40,
};

const zeroRng = () => ({
  nextFloat: () => 0,
  nextInt: () => 0,
  nextDamageOffset: () => 0,
});

describe('combat-resolver', () => {
  it('player attack with RNG offset 0 reduces Gremlin HP by 17', () => {
    const mob = gremlinMob();
    const rng = {
      nextFloat: () => 0,
      nextInt: () => 0,
      nextDamageOffset: () => 0,
    };
    const combat = createPlayerCombatState();
    combat.targetMobId = mob.id;
    combat.attackPending = true;

    const result = resolvePlayerAttack({
      sessionId: 'p1',
      playerX: mob.x,
      playerZ: mob.z,
      combat,
      mob,
      nowMs: 1000,
      rng,
    });

    expect(result.damage).toBe(17);
    expect(mob.hp).toBeCloseTo(41.145 - 17, 3);
    expect(result.killed).toBe(false);
  });

  it('player attack out of melee range deals no damage', () => {
    const mob = gremlinMob();
    const rng = createSeededRng(42);
    const combat = createPlayerCombatState();
    combat.targetMobId = mob.id;
    combat.attackPending = true;

    const result = resolvePlayerAttack({
      sessionId: 'p1',
      playerX: mob.x + 10,
      playerZ: mob.z,
      combat,
      mob,
      nowMs: 1000,
      rng,
    });

    expect(result.damage).toBe(0);
    expect(mob.hp).toBeCloseTo(41.145, 3);
  });

  it('player attack respects attack interval', () => {
    const mob = gremlinMob();
    const rng = createSeededRng(42);
    const combat = createPlayerCombatState();
    combat.targetMobId = mob.id;
    combat.attackPending = true;

    resolvePlayerAttack({
      sessionId: 'p1',
      playerX: mob.x,
      playerZ: mob.z,
      combat,
      mob,
      nowMs: 1000,
      rng,
    });

    combat.attackPending = true;
    const second = resolvePlayerAttack({
      sessionId: 'p1',
      playerX: mob.x,
      playerZ: mob.z,
      combat,
      mob,
      nowMs: 1500,
      rng,
    });

    expect(second.damage).toBe(0);
  });

  it('kill event returns xp=44 for Gremlin solo kill', () => {
    const mob = gremlinMob({ hp: 1 });
    const rng = createSeededRng(42);
    const combat = createPlayerCombatState();
    combat.targetMobId = mob.id;
    combat.attackPending = true;

    const result = resolvePlayerAttack({
      sessionId: 'p1',
      playerX: mob.x,
      playerZ: mob.z,
      combat,
      mob,
      nowMs: 1000,
      rng,
    });

    expect(result.killed).toBe(true);
    const kill: KillEvent = {
      mobId: mob.id,
      npcId: mob.npcId,
      killerSessionId: 'p1',
      exp: mob.exp,
      drops: [],
    };
    expect(kill.exp).toBe(44);
  });

  it('applyKillRewards grants xp=44 then level 2 at xp=88', () => {
    const player = { level: 1, xp: 0 };
    const kill: KillEvent = {
      mobId: 'g1',
      npcId: 20001,
      killerSessionId: 'p1',
      exp: 44,
      drops: [],
    };

    applyKillRewards(player, kill, TEST_CURVE);
    expect(player).toEqual({ level: 1, xp: 44 });

    applyKillRewards(player, kill, TEST_CURVE);
    expect(player).toEqual({ level: 2, xp: 88 });
  });

  it('mob attack deals damage when in melee range', () => {
    const mob = gremlinMob({ targetSessionId: 'p1' });
    const rng = {
      nextFloat: () => 0,
      nextInt: () => 0,
      nextDamageOffset: () => 0,
    };
    mob.nextAttackAtMs = 0;

    const result = resolveMobAttack({
      mob,
      targetSessionId: 'p1',
      targetX: OUT_OF_PEACE.x + 2,
      targetZ: OUT_OF_PEACE.z,
      targetHp: 100,
      nowMs: 1000,
      rng,
    });

    expect(result.damage).toBeGreaterThan(0);
    expect(mob.wasDamaged).toBe(false);
  });

  it('player attack sets mob wasDamaged and lastAttacker on hit', () => {
    const mob = gremlinMob();
    const rng = createSeededRng(42);
    const combat = createPlayerCombatState();
    combat.targetMobId = mob.id;
    combat.attackPending = true;

    resolvePlayerAttack({
      sessionId: 'p1',
      playerX: mob.x,
      playerZ: mob.z,
      combat,
      mob,
      nowMs: 1000,
      rng,
    });

    expect(mob.wasDamaged).toBe(true);
    expect(mob.lastAttackerSessionId).toBe('p1');
  });

  it('rolls drops on Goblin kill with seeded RNG', () => {
    const drops: DropRow[] = [GOBLIN_ADENA_DROP_ROW];
    const rng = createSeededRng(GOBLIN_ADENA_DROP_SEED);
    const kill: KillEvent = {
      mobId: 'goblin-1',
      npcId: 20003,
      killerSessionId: 'p1',
      exp: 220,
      drops: [],
    };

    applyKillRewards({ level: 1, xp: 0 }, kill, TEST_CURVE, drops, rng);

    expect(kill.drops).toEqual([{ itemId: 57, count: 22 }]);
  });

  describe('resolvePowerStrike', () => {
    it('successful cast deals 69 damage, costs 9 MP, sets cooldown to nowMs+3000', () => {
      const mob = gremlinMob({ hp: 200, maxHp: 200 });
      const combat = createPlayerCombatState();
      combat.targetMobId = mob.id;
      combat.skillPending = true;

      const result = resolvePowerStrike({
        sessionId: 'p1',
        playerX: mob.x,
        playerZ: mob.z,
        playerMp: 50,
        combat,
        mob,
        skill: POWER_STRIKE_SKILL,
        nowMs: 1000,
        rng: zeroRng(),
      });

      expect(result.damage).toBe(69);
      expect(result.mpCost).toBe(9);
      expect(result.killed).toBe(false);
      expect(result.cooldownEndMs).toBe(4000);
      expect(combat.powerStrikeCooldownEndMs).toBe(4000);
      expect(mob.hp).toBeCloseTo(200 - 69, 3);
    });

    it('rejects when player MP is below mpConsumeL1', () => {
      const mob = gremlinMob();
      const combat = createPlayerCombatState();
      combat.targetMobId = mob.id;
      combat.skillPending = true;
      const hpBefore = mob.hp;

      const result = resolvePowerStrike({
        sessionId: 'p1',
        playerX: mob.x,
        playerZ: mob.z,
        playerMp: 8,
        combat,
        mob,
        skill: POWER_STRIKE_SKILL,
        nowMs: 1000,
        rng: zeroRng(),
      });

      expect(result.damage).toBe(0);
      expect(result.mpCost).toBe(0);
      expect(mob.hp).toBeCloseTo(hpBefore, 3);
    });

    it('rejects when target is out of cast range', () => {
      const mob = gremlinMob();
      const combat = createPlayerCombatState();
      combat.targetMobId = mob.id;
      combat.skillPending = true;
      const hpBefore = mob.hp;

      const result = resolvePowerStrike({
        sessionId: 'p1',
        playerX: mob.x + 4.1,
        playerZ: mob.z,
        playerMp: 50,
        combat,
        mob,
        skill: POWER_STRIKE_SKILL,
        nowMs: 1000,
        rng: zeroRng(),
      });

      expect(result.damage).toBe(0);
      expect(result.mpCost).toBe(0);
      expect(mob.hp).toBeCloseTo(hpBefore, 3);
    });

    it('rejects at t+2999 ms after a successful cast', () => {
      const mob = gremlinMob({ hp: 200, maxHp: 200 });
      const combat = createPlayerCombatState();
      combat.targetMobId = mob.id;
      combat.skillPending = true;

      resolvePowerStrike({
        sessionId: 'p1',
        playerX: mob.x,
        playerZ: mob.z,
        playerMp: 50,
        combat,
        mob,
        skill: POWER_STRIKE_SKILL,
        nowMs: 1000,
        rng: zeroRng(),
      });

      const hpAfterFirst = mob.hp;
      combat.skillPending = true;
      const second = resolvePowerStrike({
        sessionId: 'p1',
        playerX: mob.x,
        playerZ: mob.z,
        playerMp: 41,
        combat,
        mob,
        skill: POWER_STRIKE_SKILL,
        nowMs: 3999,
        rng: zeroRng(),
      });

      expect(second.damage).toBe(0);
      expect(second.mpCost).toBe(0);
      expect(mob.hp).toBeCloseTo(hpAfterFirst, 3);
    });

    it('succeeds at t+3000 ms after a successful cast', () => {
      const mob = gremlinMob({ hp: 200, maxHp: 200 });
      const combat = createPlayerCombatState();
      combat.targetMobId = mob.id;
      combat.skillPending = true;

      resolvePowerStrike({
        sessionId: 'p1',
        playerX: mob.x,
        playerZ: mob.z,
        playerMp: 50,
        combat,
        mob,
        skill: POWER_STRIKE_SKILL,
        nowMs: 1000,
        rng: zeroRng(),
      });

      const hpAfterFirst = mob.hp;
      combat.skillPending = true;
      const second = resolvePowerStrike({
        sessionId: 'p1',
        playerX: mob.x,
        playerZ: mob.z,
        playerMp: 41,
        combat,
        mob,
        skill: POWER_STRIKE_SKILL,
        nowMs: 4000,
        rng: zeroRng(),
      });

      expect(second.damage).toBe(69);
      expect(second.mpCost).toBe(9);
      expect(mob.hp).toBeCloseTo(hpAfterFirst - 69, 3);
    });

    it('rejects when skillPending is false', () => {
      const mob = gremlinMob();
      const combat = createPlayerCombatState();
      combat.targetMobId = mob.id;
      const hpBefore = mob.hp;

      const result = resolvePowerStrike({
        sessionId: 'p1',
        playerX: mob.x,
        playerZ: mob.z,
        playerMp: 50,
        combat,
        mob,
        skill: POWER_STRIKE_SKILL,
        nowMs: 1000,
        rng: zeroRng(),
      });

      expect(result.damage).toBe(0);
      expect(result.mpCost).toBe(0);
      expect(mob.hp).toBeCloseTo(hpBefore, 3);
    });
  });

  describe('peace zone guards', () => {
    it('resolvePlayerAttack at (0,0) returns damage 0', () => {
      const mob = gremlinMob();
      const combat = createPlayerCombatState();
      combat.targetMobId = mob.id;
      combat.attackPending = true;
      const hpBefore = mob.hp;

      const result = resolvePlayerAttack({
        sessionId: 'p1',
        playerX: 0,
        playerZ: 0,
        combat,
        mob,
        nowMs: 1000,
        rng: zeroRng(),
      });

      expect(result.damage).toBe(0);
      expect(mob.hp).toBeCloseTo(hpBefore, 3);
    });

    it('resolvePlayerAttack outside peace zone still deals damage', () => {
      const mob = gremlinMob({ x: 30, z: 30 });
      const combat = createPlayerCombatState();
      combat.targetMobId = mob.id;
      combat.attackPending = true;

      const result = resolvePlayerAttack({
        sessionId: 'p1',
        playerX: 30,
        playerZ: 30,
        combat,
        mob,
        nowMs: 1000,
        rng: zeroRng(),
      });

      expect(result.damage).toBe(17);
    });

    it('resolvePowerStrike at (0,0) returns damage 0 and mpCost 0', () => {
      const mob = gremlinMob();
      const combat = createPlayerCombatState();
      combat.targetMobId = mob.id;
      combat.skillPending = true;
      const hpBefore = mob.hp;

      const result = resolvePowerStrike({
        sessionId: 'p1',
        playerX: 0,
        playerZ: 0,
        playerMp: 50,
        combat,
        mob,
        skill: POWER_STRIKE_SKILL,
        nowMs: 1000,
        rng: zeroRng(),
      });

      expect(result.damage).toBe(0);
      expect(result.mpCost).toBe(0);
      expect(mob.hp).toBeCloseTo(hpBefore, 3);
    });

    it('resolvePowerStrike outside peace zone still deals damage', () => {
      const mob = gremlinMob({ x: 30, z: 30, hp: 200, maxHp: 200 });
      const combat = createPlayerCombatState();
      combat.targetMobId = mob.id;
      combat.skillPending = true;

      const result = resolvePowerStrike({
        sessionId: 'p1',
        playerX: 30,
        playerZ: 30,
        playerMp: 50,
        combat,
        mob,
        skill: POWER_STRIKE_SKILL,
        nowMs: 1000,
        rng: zeroRng(),
      });

      expect(result.damage).toBe(69);
      expect(result.mpCost).toBe(9);
    });

    it('resolveMobAttack vs target at (0,0) returns damage 0', () => {
      const mob = gremlinMob({ targetSessionId: 'p1', x: 0, z: 0 });
      mob.nextAttackAtMs = 0;

      const result = resolveMobAttack({
        mob,
        targetSessionId: 'p1',
        targetX: 0,
        targetZ: 0,
        targetHp: 100,
        nowMs: 1000,
        rng: zeroRng(),
      });

      expect(result.damage).toBe(0);
    });

    it('resolveMobAttack vs target outside peace zone deals damage', () => {
      const mob = gremlinMob({ targetSessionId: 'p1', x: 30, z: 30 });
      mob.nextAttackAtMs = 0;

      const result = resolveMobAttack({
        mob,
        targetSessionId: 'p1',
        targetX: 30,
        targetZ: 30,
        targetHp: 100,
        nowMs: 1000,
        rng: zeroRng(),
      });

      expect(result.damage).toBeGreaterThan(0);
    });
  });
});
