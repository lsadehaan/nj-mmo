import {
  STARTER_COMBAT,
  calcMeleeDamage,
  calcPhysicalSkillDamage,
  calculateAttackIntervalMs,
  isInMeleeRange,
  isInPeaceZone,
  grantXp,
  rollDrops,
  type DropRow,
  type ExperienceCurveRow,
  type SeededRng,
} from '@nj/game-core';
import type { MobRuntime } from './spawn-manager';

export interface PlayerCombatState {
  targetMobId: string | null;
  nextAttackAtMs: number;
  attackPending: boolean;
  skillPending: boolean;
  powerStrikeCooldownEndMs: number;
}

export interface PowerStrikeSkill {
  powerL1: number;
  mpConsumeL1: number;
  reuseDelay: number;
  castRange: number;
}

export interface PowerStrikeResult {
  damage: number;
  mpCost: number;
  killed: boolean;
  cooldownEndMs: number;
}

export interface KillEvent {
  mobId: string;
  npcId: number;
  killerSessionId: string;
  exp: number;
  drops: { itemId: number; count: number }[];
}

export interface PlayerAttackResult {
  damage: number;
  killed: boolean;
}

export interface MobAttackResult {
  damage: number;
}

export function createPlayerCombatState(): PlayerCombatState {
  return {
    targetMobId: null,
    nextAttackAtMs: 0,
    attackPending: false,
    skillPending: false,
    powerStrikeCooldownEndMs: 0,
  };
}

export function resolvePlayerAttack(params: {
  sessionId: string;
  playerX: number;
  playerZ: number;
  combat: PlayerCombatState;
  mob: MobRuntime;
  nowMs: number;
  rng: SeededRng;
  attackerPAtk?: number;
}): PlayerAttackResult {
  const {
    sessionId,
    playerX,
    playerZ,
    combat,
    mob,
    nowMs,
    rng,
    attackerPAtk = STARTER_COMBAT.pAtk,
  } = params;

  if (!combat.attackPending || combat.targetMobId !== mob.id || mob.hp <= 0) {
    return { damage: 0, killed: false };
  }

  combat.attackPending = false;

  if (isInPeaceZone(playerX, playerZ)) {
    return { damage: 0, killed: false };
  }

  if (nowMs < combat.nextAttackAtMs) {
    return { damage: 0, killed: false };
  }

  if (
    !isInMeleeRange(
      playerX,
      playerZ,
      mob.x,
      mob.z,
      STARTER_COMBAT.meleeRange
    )
  ) {
    return { damage: 0, killed: false };
  }

  const damage = calcMeleeDamage(
    {
      pAtk: attackerPAtk,
      randomDamage: STARTER_COMBAT.randomDamage,
    },
    { pDef: mob.pDef },
    { rng }
  );

  combat.nextAttackAtMs =
    nowMs + calculateAttackIntervalMs(STARTER_COMBAT.attackSpeed);

  mob.hp = Math.max(0, mob.hp - damage);
  mob.wasDamaged = true;
  mob.lastAttackerSessionId = sessionId;

  const killed = mob.hp <= 0;
  return { damage, killed };
}

export function resolvePowerStrike(params: {
  sessionId: string;
  playerX: number;
  playerZ: number;
  playerMp: number;
  combat: PlayerCombatState;
  mob: MobRuntime;
  skill: PowerStrikeSkill;
  nowMs: number;
  rng: SeededRng;
  attackerPAtk?: number;
}): PowerStrikeResult {
  const {
    sessionId,
    playerX,
    playerZ,
    playerMp,
    combat,
    mob,
    skill,
    nowMs,
    rng,
    attackerPAtk = STARTER_COMBAT.pAtk,
  } = params;

  const reject = (): PowerStrikeResult => ({
    damage: 0,
    mpCost: 0,
    killed: false,
    cooldownEndMs: combat.powerStrikeCooldownEndMs,
  });

  if (!combat.skillPending || combat.targetMobId !== mob.id || mob.hp <= 0) {
    return reject();
  }

  combat.skillPending = false;

  if (isInPeaceZone(playerX, playerZ)) {
    return reject();
  }

  if (nowMs < combat.powerStrikeCooldownEndMs) {
    return reject();
  }

  if (playerMp < skill.mpConsumeL1) {
    return reject();
  }

  const castRangeWorld = skill.castRange / 10;
  if (!isInMeleeRange(playerX, playerZ, mob.x, mob.z, castRangeWorld)) {
    return reject();
  }

  const damage = calcPhysicalSkillDamage(
    {
      pAtk: attackerPAtk,
      randomDamage: STARTER_COMBAT.randomDamage,
    },
    { pDef: mob.pDef },
    skill.powerL1,
    { rng }
  );

  const cooldownEndMs = nowMs + skill.reuseDelay;
  combat.powerStrikeCooldownEndMs = cooldownEndMs;

  mob.hp = Math.max(0, mob.hp - damage);
  mob.wasDamaged = true;
  mob.lastAttackerSessionId = sessionId;

  const killed = mob.hp <= 0;
  return {
    damage,
    mpCost: skill.mpConsumeL1,
    killed,
    cooldownEndMs,
  };
}

export function resolveMobAttack(params: {
  mob: MobRuntime;
  targetSessionId: string;
  targetX: number;
  targetZ: number;
  targetHp: number;
  nowMs: number;
  rng: SeededRng;
}): MobAttackResult {
  const { mob, targetSessionId, targetX, targetZ, nowMs, rng } = params;

  if (mob.hp <= 0 || mob.targetSessionId !== targetSessionId) {
    return { damage: 0 };
  }

  if (isInPeaceZone(targetX, targetZ)) {
    return { damage: 0 };
  }

  if (nowMs < mob.nextAttackAtMs) {
    return { damage: 0 };
  }

  if (
    !isInMeleeRange(mob.x, mob.z, targetX, targetZ, mob.attackRangeWorld)
  ) {
    return { damage: 0 };
  }

  const damage = calcMeleeDamage(
    { pAtk: mob.pAtk, randomDamage: mob.randomDamage },
    { pDef: STARTER_COMBAT.pDef },
    { rng }
  );

  mob.nextAttackAtMs = nowMs + calculateAttackIntervalMs(mob.attackSpeed);
  return { damage };
}

export function applyKillRewards(
  player: { level: number; xp: number },
  kill: KillEvent,
  curve: ExperienceCurveRow[],
  dropRows: DropRow[] = [],
  rng?: SeededRng
): void {
  const granted = grantXp(player.level, player.xp, kill.exp, curve);
  player.level = granted.level;
  player.xp = granted.xp;

  if (dropRows.length > 0 && rng) {
    kill.drops = rollDrops(dropRows, rng);
  }
}
