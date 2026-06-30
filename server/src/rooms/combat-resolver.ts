import {
  STARTER_COMBAT,
  calcMeleeDamage,
  calcPhysicalSkillDamage,
  calcMagicSkillDamage,
  calcClassBaseMAtk,
  applyShotMultiplier,
  calculateAttackIntervalMs,
  horizontalDistance,
  isInMeleeRange,
  isInPeaceZone,
  grantXp,
  rollDrops,
  rollCrit,
  applyCritMultiplier,
  rollHitMiss,
  applyBuffSelf,
  applyDebuffEnemy,
  tickActiveEffects,
  getPatkMultiplier,
  type ActiveEffect,
  type DropRow,
  type ExperienceCurveRow,
  type SeededRng,
} from '@nj/game-core';
import type { Skill } from '../db/schema';
import type { MobRuntime } from './spawn-manager';

export type ArmedShotKind = 'soul' | 'spirit';

export interface PlayerCombatState {
  targetMobId: string | null;
  nextAttackAtMs: number;
  attackPending: boolean;
  skillPending: boolean;
  pendingSkillId: number;
  skillCooldownEndMs: Record<number, number>;
  castingSkillId: number;
  castEndMs: number;
  castTargetMobId: string | null;
  armedShot: ArmedShotKind | null;
  activeEffect: ActiveEffect | null;
  openTrainerNpcId: number | null;
}

export interface SkillUseResult {
  ok: boolean;
  damage: number;
  mpCost: number;
  killed: boolean;
  cooldownEndMs: number;
  consumedShot: boolean;
}

/** @deprecated use Skill from DB */
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

export interface MobEffectState {
  activeEffect: ActiveEffect | null;
}

export function createPlayerCombatState(): PlayerCombatState {
  return {
    targetMobId: null,
    nextAttackAtMs: 0,
    attackPending: false,
    skillPending: false,
    pendingSkillId: 0,
    skillCooldownEndMs: {},
    castingSkillId: 0,
    castEndMs: 0,
    castTargetMobId: null,
    armedShot: null,
    activeEffect: null,
    openTrainerNpcId: null,
  };
}

export function getSkillCooldownEnd(
  combat: PlayerCombatState,
  skillId: number
): number {
  return combat.skillCooldownEndMs[skillId] ?? 0;
}

export function canUseSkill(
  combat: PlayerCombatState,
  skillId: number,
  knownSkillIds: Set<number>,
  nowMs: number
): boolean {
  if (!knownSkillIds.has(skillId)) return false;
  if (nowMs < getSkillCooldownEnd(combat, skillId)) return false;
  if (combat.castingSkillId !== 0) return false;
  return true;
}

export function beginSkillCast(
  combat: PlayerCombatState,
  skillId: number,
  targetMobId: string,
  hitTime: number,
  nowMs: number
): void {
  combat.castingSkillId = skillId;
  combat.castEndMs = nowMs + hitTime;
  combat.castTargetMobId = targetMobId;
  combat.skillPending = false;
  combat.pendingSkillId = 0;
}

export function cancelSkillCast(combat: PlayerCombatState): void {
  combat.castingSkillId = 0;
  combat.castEndMs = 0;
  combat.castTargetMobId = null;
}

export function resolveSkillUse(params: {
  sessionId: string;
  playerX: number;
  playerZ: number;
  playerMp: number;
  playerMAtk: number;
  playerPAtk: number;
  playerCritRate: number;
  playerDex: number;
  combat: PlayerCombatState;
  mob: MobRuntime;
  mobEffect?: MobEffectState;
  skill: Skill;
  nowMs: number;
  rng: SeededRng;
}): SkillUseResult {
  const {
    sessionId,
    playerX,
    playerZ,
    playerMp,
    playerMAtk,
    playerPAtk,
    playerCritRate,
    combat,
    mob,
    mobEffect,
    skill,
    nowMs,
    rng,
  } = params;

  const reject = (): SkillUseResult => ({
    ok: false,
    damage: 0,
    mpCost: 0,
    killed: false,
    cooldownEndMs: getSkillCooldownEnd(combat, skill.skillId),
    consumedShot: false,
  });

  if (isInPeaceZone(playerX, playerZ)) return reject();
  if (nowMs < getSkillCooldownEnd(combat, skill.skillId)) return reject();
  if (playerMp < skill.mpConsumeL1) return reject();

  const castRangeWorld = skill.castRange / 10;
  if (!isInMeleeRange(playerX, playerZ, mob.x, mob.z, castRangeWorld)) {
    return reject();
  }

  const mobDef = mob.pDef;
  const patkMult = getPatkMultiplier(combat);
  let damage = 0;
  let consumedShot = false;

  if (skill.effectKind === 'physical_damage') {
    const effectivePAtk = playerPAtk * patkMult;
    damage = calcPhysicalSkillDamage(
      { pAtk: effectivePAtk, randomDamage: STARTER_COMBAT.randomDamage },
      { pDef: mobDef },
      skill.powerL1,
      { rng }
    );
    const isCrit = rollCrit({ critRate: playerCritRate }, rng);
    damage = applyCritMultiplier(damage, isCrit);
    if (combat.armedShot === 'soul') {
      damage = applyShotMultiplier(damage, 2);
      combat.armedShot = null;
      consumedShot = true;
    }
  } else if (skill.effectKind === 'magic_damage') {
    damage = calcMagicSkillDamage(
      { mAtk: playerMAtk },
      { mDef: mobDef },
      skill.powerL1,
      { rng }
    );
    const isCrit = rollCrit({ critRate: playerCritRate }, rng);
    damage = applyCritMultiplier(damage, isCrit);
    if (combat.armedShot === 'spirit') {
      damage = applyShotMultiplier(damage, 2);
      combat.armedShot = null;
      consumedShot = true;
    }
  } else if (skill.effectKind === 'buff_self' && skill.buffMultiplier) {
    applyBuffSelf(
      combat,
      skill.skillId,
      skill.buffMultiplier,
      skill.abnormalTime,
      nowMs
    );
  } else if (skill.effectKind === 'debuff_enemy' && skill.debuffMultiplier && mobEffect) {
    applyDebuffEnemy(
      mobEffect,
      skill.skillId,
      skill.debuffMultiplier,
      skill.abnormalTime,
      nowMs
    );
  } else {
    return reject();
  }

  const cooldownEndMs = nowMs + skill.reuseDelay;
  combat.skillCooldownEndMs[skill.skillId] = cooldownEndMs;

  if (skill.effectKind === 'physical_damage' || skill.effectKind === 'magic_damage') {
    mob.hp = Math.max(0, mob.hp - damage);
    mob.wasDamaged = true;
    mob.lastAttackerSessionId = sessionId;
  }

  const killed = mob.hp <= 0;
  return {
    ok: true,
    damage,
    mpCost: skill.mpConsumeL1,
    killed,
    cooldownEndMs,
    consumedShot,
  };
}

export function resolvePlayerAttack(params: {
  sessionId: string;
  playerX: number;
  playerZ: number;
  combat: PlayerCombatState;
  mob: MobRuntime;
  mobEffect?: MobEffectState;
  nowMs: number;
  rng: SeededRng;
  attackerPAtk?: number;
  attackerCritRate?: number;
  attackerDex?: number;
}): PlayerAttackResult {
  const {
    sessionId,
    playerX,
    playerZ,
    combat,
    mob,
    mobEffect,
    nowMs,
    rng,
    attackerPAtk = STARTER_COMBAT.pAtk,
    attackerCritRate = STARTER_COMBAT.critRate,
    attackerDex = 30,
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

  let patkMult = getPatkMultiplier(combat);
  if (mobEffect) {
    patkMult *= getPatkMultiplier(mobEffect);
  }

  let damage = calcMeleeDamage(
    {
      pAtk: attackerPAtk * patkMult,
      randomDamage: STARTER_COMBAT.randomDamage,
    },
    { pDef: mob.pDef },
    { rng }
  );

  const isCrit = rollCrit({ critRate: attackerCritRate }, rng);
  damage = applyCritMultiplier(damage, isCrit);

  if (combat.armedShot === 'soul') {
    damage = applyShotMultiplier(damage, 2);
    combat.armedShot = null;
  }

  combat.nextAttackAtMs =
    nowMs + calculateAttackIntervalMs(STARTER_COMBAT.attackSpeed);

  mob.hp = Math.max(0, mob.hp - damage);
  mob.wasDamaged = true;
  mob.lastAttackerSessionId = sessionId;

  const killed = mob.hp <= 0;
  return { damage, killed };
}

/** @deprecated use resolveSkillUse */
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
  if (!params.combat.skillPending) {
    return {
      damage: 0,
      mpCost: 0,
      killed: false,
      cooldownEndMs: getSkillCooldownEnd(params.combat, 3),
    };
  }
  const skill: Skill = {
    skillId: 3,
    name: 'Power Strike',
    maxLevel: 9,
    operateType: 'A1',
    targetType: 'ENEMY',
    castRange: params.skill.castRange,
    reuseDelay: params.skill.reuseDelay,
    mpConsumeL1: params.skill.mpConsumeL1,
    powerL1: params.skill.powerL1,
    hitTime: 1080,
    isMagic: false,
    effectKind: 'physical_damage',
    abnormalTime: 0,
    buffMultiplier: null,
    debuffMultiplier: null,
  };
  const result = resolveSkillUse({
    ...params,
    playerMAtk: 0,
    playerPAtk: params.attackerPAtk ?? STARTER_COMBAT.pAtk,
    playerCritRate: STARTER_COMBAT.critRate,
    playerDex: 30,
    skill,
  });
  return {
    damage: result.damage,
    mpCost: result.mpCost,
    killed: result.killed,
    cooldownEndMs: result.cooldownEndMs,
  };
}

export function resolveMobAttack(params: {
  mob: MobRuntime;
  mobEffect?: MobEffectState;
  targetSessionId: string;
  targetX: number;
  targetZ: number;
  targetHp: number;
  targetDex: number;
  targetPDef?: number;
  nowMs: number;
  rng: SeededRng;
}): MobAttackResult {
  const { mob, mobEffect, targetSessionId, targetX, targetZ, targetDex, nowMs, rng } = params;
  const targetPDef = params.targetPDef ?? STARTER_COMBAT.pDef;

  if (mob.hp <= 0 || mob.targetSessionId !== targetSessionId) {
    return { damage: 0 };
  }

  if (isInPeaceZone(targetX, targetZ)) {
    return { damage: 0 };
  }

  if (nowMs < mob.nextAttackAtMs) {
    return { damage: 0 };
  }

  const dist = horizontalDistance(mob.x, mob.z, targetX, targetZ);
  if (mob.aiType === 'ARCHER') {
    if (dist < mob.attackRangeWorld || dist > mob.preferredAttackRangeWorld) {
      return { damage: 0 };
    }
  } else if (!isInMeleeRange(mob.x, mob.z, targetX, targetZ, mob.attackRangeWorld)) {
    return { damage: 0 };
  }

  if (rollHitMiss({ accuracy: 4.75 }, { dex: targetDex }, rng)) {
    mob.nextAttackAtMs = nowMs + calculateAttackIntervalMs(mob.attackSpeed);
    return { damage: 0 };
  }

  let mobPatk = mob.pAtk;
  if (mobEffect) {
    mobPatk *= getPatkMultiplier(mobEffect);
  }

  const damage = calcMeleeDamage(
    { pAtk: mobPatk, randomDamage: mob.randomDamage },
    { pDef: targetPDef },
    { rng }
  );

  mob.nextAttackAtMs = nowMs + calculateAttackIntervalMs(mob.attackSpeed);
  return { damage };
}

export function applyDamageToCastingPlayer(
  combat: PlayerCombatState,
  damage: number
): boolean {
  if (damage > 0 && combat.castingSkillId !== 0) {
    cancelSkillCast(combat);
    return true;
  }
  return false;
}

export function tickCombatEffects(
  combat: PlayerCombatState,
  mobEffects: Map<string, MobEffectState>,
  nowMs: number
): void {
  tickActiveEffects(combat, nowMs);
  for (const effect of mobEffects.values()) {
    tickActiveEffects(effect, nowMs);
  }
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

export function calcPlayerMAtk(
  baseMAtk: number,
  baseInt: number,
  level: number
): number {
  return calcClassBaseMAtk(
    { basePAtk: 0, baseStr: 22, baseMAtk, baseInt },
    level
  );
}
