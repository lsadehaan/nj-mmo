import type { ExperienceCurveRow } from '../experience';

export function xpForLevel(level: number, curve: ExperienceCurveRow[]): number {
  const row = curve.find((r) => r.level === level);
  return row?.xpToNextLevel ?? 0;
}

export function levelFromCumulativeXp(
  xp: number,
  curve: ExperienceCurveRow[]
): number {
  let level = 1;
  const thresholds = [...curve]
    .filter((row) => row.level > 1)
    .sort((a, b) => a.level - b.level);

  for (const row of thresholds) {
    if (xp >= row.xpToNextLevel) {
      level = row.level;
    }
  }

  return level;
}

export function currentLevelExp(level: number, curve: ExperienceCurveRow[]): number {
  return xpForLevel(level + 1, curve) - xpForLevel(level, curve);
}
