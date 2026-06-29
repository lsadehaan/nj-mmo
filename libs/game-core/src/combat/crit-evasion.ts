import type { SeededRng } from '../seeded-rng';
import { lookupDexBonus } from '../class/stat-bonus';

export interface CritAttacker {
  critRate: number;
}

export interface EvasionDefender {
  dex: number;
}

export interface AccuracyAttacker {
  accuracy: number;
}

export function rollCrit(attacker: CritAttacker, rng: SeededRng): boolean {
  return rng.nextFloat() < attacker.critRate / 100;
}

export function applyCritMultiplier(damage: number, isCrit: boolean): number {
  return isCrit ? damage * 2 : damage;
}

export function rollHitMiss(
  attacker: AccuracyAttacker,
  defender: EvasionDefender,
  rng: SeededRng
): boolean {
  const evasion = lookupDexBonus(defender.dex) * 10;
  const missChance = evasion / (evasion + attacker.accuracy);
  return rng.nextFloat() < missChance;
}
