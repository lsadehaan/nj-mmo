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
  canUseSkill,
  resolvePlayerAttack,
  resolvePowerStrike,
  resolveSkillUse,
  resolveMobAttack,
  applyKillRewards,
  type KillEvent,
} from './combat-resolver';
import type { Skill } from '../db/schema';
import type { MobRuntime } from './spawn-manager';

const OUT_OF_PEACE = { x: -150, z: 55 };

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

const POWER_STRIKE_DB_SKILL: Skill = {
  skillId: 3,
  name: 'Power Strike',
  maxLevel: 9,
  operateType: 'A1',
  targetType: 'ENEMY',
  castRange: 40,
  reuseDelay: 3000,
  mpConsumeL1: 9,
  powerL1: 30,
  hitTime: 1080,
  isMagic: false,
  effectKind: 'physical_damage',
  abnormalTime: 0,
  buffMultiplier: null,
  debuffMultiplier: null,
};

const zeroRng = () => ({
  nextFloat: () => 1,
  nextInt: () => 0,
  nextDamageOffset: () => 0,
});

describe('combat-resolver', () => {
  it('player attack with RNG offset 0 reduces Gremlin HP by 17', () => {
    const mob = gremlinMob();
    const rng = {
      nextFloat: () => 1,
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
      nextFloat: () => 1,
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
      targetDex: 30,
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

  describe('canUseSkill', () => {
    // SKILL20-14
    it('rejects when skill is not in knownSkillIds', () => {
      const combat = createPlayerCombatState();
      const known = new Set<number>([3]);
      expect(canUseSkill(combat, 3, known, 1000)).toBe(true);
      expect(canUseSkill(combat, 1177, known, 1000)).toBe(false);
    });

    it('rejects when skill is on cooldown', () => {
      const combat = createPlayerCombatState();
      combat.skillCooldownEndMs[3] = 5000;
      const known = new Set<number>([3]);
      expect(canUseSkill(combat, 3, known, 4000)).toBe(false);
      expect(canUseSkill(combat, 3, known, 5000)).toBe(true);
    });
  });

  describe('resolveSkillUse', () => {
    // SKILL20-26
    it('physical skill sets per-skill cooldown and deals class sword anchor damage', () => {
      const mob = gremlinMob({ hp: 500, maxHp: 500 });
      const combat = createPlayerCombatState();
      combat.targetMobId = mob.id;

      const result = resolveSkillUse({
        sessionId: 'p1',
        playerX: mob.x,
        playerZ: mob.z,
        playerMp: 50,
        playerMAtk: 8,
        playerPAtk: 11,
        playerCritRate: 4,
        playerDex: 30,
        combat,
        mob,
        skill: POWER_STRIKE_DB_SKILL,
        nowMs: 1000,
        rng: zeroRng(),
      });

      expect(result.ok).toBe(true);
      expect(result.damage).toBe(71);
      expect(result.mpCost).toBe(9);
      expect(result.cooldownEndMs).toBe(4000);
      expect(combat.skillCooldownEndMs[3]).toBe(4000);
      expect(mob.hp).toBeCloseTo(500 - 71, 3);
    });
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
      expect(combat.skillCooldownEndMs[3]).toBe(4000);
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

  describe('effective pAtk (Squire\'s Sword equipped)', () => {
    const EQUIPPED_P_ATK = 16;

    it('attackerPAtk=16 deals 27 melee damage vs Gremlin', () => {
      const mob = gremlinMob();
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
        rng: zeroRng(),
        attackerPAtk: EQUIPPED_P_ATK,
      });

      expect(result.damage).toBe(27);
      expect(mob.hp).toBeCloseTo(41.145 - 27, 3);
    });

    it('attackerPAtk=16 Power Strike deals 79 damage vs Gremlin', () => {
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
        attackerPAtk: EQUIPPED_P_ATK,
      });

      expect(result.damage).toBe(79);
      expect(mob.hp).toBeCloseTo(200 - 79, 3);
    });

    it('attackerPAtk=10 keeps unarmed anchors at 17 melee and 69 Power Strike', () => {
      const mob = gremlinMob({ hp: 200, maxHp: 200 });
      const combat = createPlayerCombatState();
      combat.targetMobId = mob.id;
      combat.attackPending = true;

      const melee = resolvePlayerAttack({
        sessionId: 'p1',
        playerX: mob.x,
        playerZ: mob.z,
        combat,
        mob,
        nowMs: 1000,
        rng: zeroRng(),
        attackerPAtk: STARTER_COMBAT.pAtk,
      });

      expect(melee.damage).toBe(17);

      combat.skillPending = true;
      const skill = resolvePowerStrike({
        sessionId: 'p1',
        playerX: mob.x,
        playerZ: mob.z,
        playerMp: 50,
        combat,
        mob,
        skill: POWER_STRIKE_SKILL,
        nowMs: 2000,
        rng: zeroRng(),
        attackerPAtk: STARTER_COMBAT.pAtk,
      });

      expect(skill.damage).toBe(69);
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
      const mob = gremlinMob();
      const combat = createPlayerCombatState();
      combat.targetMobId = mob.id;
      combat.attackPending = true;

      const result = resolvePlayerAttack({
        sessionId: 'p1',
        playerX: OUT_OF_PEACE.x,
        playerZ: OUT_OF_PEACE.z,
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
      const mob = gremlinMob({ hp: 200, maxHp: 200 });
      const combat = createPlayerCombatState();
      combat.targetMobId = mob.id;
      combat.skillPending = true;

      const result = resolvePowerStrike({
        sessionId: 'p1',
        playerX: OUT_OF_PEACE.x,
        playerZ: OUT_OF_PEACE.z,
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
        targetDex: 30,
        nowMs: 1000,
        rng: zeroRng(),
      });

      expect(result.damage).toBe(0);
    });

    it('resolveMobAttack vs target outside peace zone deals damage', () => {
      const mob = gremlinMob({ targetSessionId: 'p1' });
      mob.nextAttackAtMs = 0;

      const result = resolveMobAttack({
        mob,
        targetSessionId: 'p1',
        targetX: OUT_OF_PEACE.x,
        targetZ: OUT_OF_PEACE.z,
        targetHp: 100,
        targetDex: 30,
        nowMs: 1000,
        rng: zeroRng(),
      });

      expect(result.damage).toBeGreaterThan(0);
    });
  });
});
