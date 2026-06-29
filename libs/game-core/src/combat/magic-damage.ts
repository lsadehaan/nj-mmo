import type { SeededRng } from '../seeded-rng';

const MAGIC_DAMAGE_CONSTANT = 91;

export interface MagicAttacker {
  mAtk: number;
}

export interface MagicDefender {
  mDef: number;
}

export interface MagicDamageOptions {
  rngOffset?: number;
  rng?: SeededRng;
}

export function calcMagicSkillDamage(
  attacker: MagicAttacker,
  defender: MagicDefender,
  power: number,
  options: MagicDamageOptions = {}
): number {
  const rngOffset =
    options.rngOffset ?? options.rng?.nextDamageOffset(0) ?? 0;
  const randomMod = 1 + rngOffset / 100;
  const attackPower =
    (MAGIC_DAMAGE_CONSTANT * (attacker.mAtk + power)) / defender.mDef * randomMod;
  return Math.max(1, Math.floor(attackPower));
}

export function applyShotMultiplier(damage: number, shotMultiplier: number): number {
  return Math.max(1, Math.floor(damage * shotMultiplier));
}
