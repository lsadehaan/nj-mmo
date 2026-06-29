export interface ClassVitalsRow {
  level: number;
  hp: number;
  mp: number;
}

export interface PlayerVitals {
  maxHp: number;
  maxMp: number;
  hp: number;
  mp: number;
}

export function classVitalsAtLevel(
  curve: readonly ClassVitalsRow[],
  level: number
): { maxHp: number; maxMp: number } {
  const row = curve.find((r) => r.level === level);
  if (!row) {
    throw new Error(`No vitals row for level ${level}`);
  }
  return { maxHp: row.hp, maxMp: row.mp };
}

export function applyClassLevelUpReward(
  prevLevel: number,
  newLevel: number,
  vitals: PlayerVitals,
  curve: readonly ClassVitalsRow[]
): PlayerVitals {
  if (newLevel <= prevLevel) {
    return { ...vitals };
  }
  const atLevel = classVitalsAtLevel(curve, newLevel);
  return {
    maxHp: atLevel.maxHp,
    maxMp: atLevel.maxMp,
    hp: atLevel.maxHp,
    mp: atLevel.maxMp,
  };
}
