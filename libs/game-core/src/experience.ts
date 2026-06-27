export interface ExperienceCurveRow {
  level: number;
  xpToNextLevel: number;
}

export interface XpGrantResult {
  level: number;
  xp: number;
}

export function grantXp(
  currentLevel: number,
  currentXp: number,
  addXp: number,
  curve: ExperienceCurveRow[]
): XpGrantResult {
  const newXp = currentXp + addXp;
  const level = levelFromCumulativeXp(newXp, curve);
  return { level, xp: newXp };
}

function levelFromCumulativeXp(xp: number, curve: ExperienceCurveRow[]): number {
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
