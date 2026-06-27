import type { SeededRng } from '../seeded-rng';

const MELEE_WEAPON_MODIFIER = 77;

export interface MeleeAttacker {
  pAtk: number;
  randomDamage?: number;
}

export interface MeleeDefender {
  pDef: number;
}

export interface MeleeDamageOptions {
  rngOffset?: number;
  rng?: SeededRng;
}

export function calcMeleeDamage(
  attacker: MeleeAttacker,
  defender: MeleeDefender,
  options: MeleeDamageOptions = {}
): number {
  const randomDamage = attacker.randomDamage ?? 0;
  const rngOffset =
    options.rngOffset ?? options.rng?.nextDamageOffset(randomDamage) ?? 0;
  const randomMod = 1 + rngOffset / 100;
  const attackPower = attacker.pAtk * randomMod * MELEE_WEAPON_MODIFIER;
  return Math.max(1, Math.floor(attackPower / defender.pDef));
}

export function calcPhysicalSkillDamage(
  attacker: MeleeAttacker,
  defender: MeleeDefender,
  power: number,
  options: MeleeDamageOptions = {}
): number {
  const randomDamage = attacker.randomDamage ?? 0;
  const rngOffset =
    options.rngOffset ?? options.rng?.nextDamageOffset(randomDamage) ?? 0;
  const randomMod = 1 + rngOffset / 100;
  const attackPower =
    ((attacker.pAtk + power) / defender.pDef) * MELEE_WEAPON_MODIFIER * randomMod;
  return Math.max(1, Math.floor(attackPower));
}
