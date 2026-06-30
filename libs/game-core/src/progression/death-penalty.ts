import type { ExperienceCurveRow } from '../experience';
import { currentLevelExp } from './xp-curve';

export const NEWBIE_XP_PROTECTION_MAX_LEVEL = 9;
export const KARMA_EXP_LOST_MULT = 1.0;

export interface ExperienceLossRow {
  level: number;
  percentLost: number;
}

export interface DeathPenaltyInput {
  level: number;
  xp: number;
  karma: number;
  killerKind: 'mob' | 'player';
}

export interface DeathPenaltyResult {
  lostExp: number;
  newXp: number;
  expBeforeDeath: number;
}

export function lookupPercentLost(
  level: number,
  lossTable: ExperienceLossRow[]
): number {
  const exact = lossTable.find((r) => r.level === level);
  if (exact) return exact.percentLost;
  const below = lossTable
    .filter((r) => r.level <= level)
    .sort((a, b) => b.level - a.level);
  return below[0]?.percentLost ?? 0;
}

export function calcDeathXpLoss(
  input: DeathPenaltyInput,
  curve: ExperienceCurveRow[],
  lossTable: ExperienceLossRow[],
  opts?: { karmaExpLostMult?: number }
): DeathPenaltyResult {
  const expBeforeDeath = input.xp;

  if (input.level <= NEWBIE_XP_PROTECTION_MAX_LEVEL) {
    return { lostExp: 0, newXp: input.xp, expBeforeDeath };
  }

  let percentLost = lookupPercentLost(input.level, lossTable);
  if (input.karma < 0) {
    percentLost *= opts?.karmaExpLostMult ?? KARMA_EXP_LOST_MULT;
  }

  const cle = currentLevelExp(input.level, curve);
  let lostExp = Math.round((cle * percentLost) / 100);
  const cap = Math.floor(cle / 10);
  lostExp = Math.min(lostExp, cap);

  const newXp = Math.max(0, input.xp - lostExp);
  return { lostExp, newXp, expBeforeDeath };
}
