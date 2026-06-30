import { grantXp, type ExperienceCurveRow, type XpGrantResult } from '../experience';
import { levelFromCumulativeXp, xpForLevel } from './xp-curve';

export const TI_LEVEL_CAP = 20;

export interface RemoveXpOptions {
  delevelMin?: number;
}

export function grantXpCapped(
  currentLevel: number,
  currentXp: number,
  addXp: number,
  curve: ExperienceCurveRow[],
  cap: number = TI_LEVEL_CAP
): XpGrantResult {
  const raw = grantXp(currentLevel, currentXp, addXp, curve);
  if (raw.level >= cap) {
    if (currentLevel < cap) {
      return { level: cap, xp: xpForLevel(cap, curve) };
    }
    return { level: cap, xp: raw.xp };
  }
  return raw;
}

export function removeXp(
  level: number,
  xp: number,
  amount: number,
  curve: ExperienceCurveRow[],
  opts: RemoveXpOptions = {}
): XpGrantResult {
  const delevelMin = opts.delevelMin ?? 10;
  const minXp = xpForLevel(delevelMin, curve);
  const newXp = Math.max(minXp, xp - amount);
  const newLevel = levelFromCumulativeXp(newXp, curve);

  if (newLevel < delevelMin) {
    return { level: delevelMin, xp: minXp };
  }

  return { level: newLevel, xp: newXp };
}
