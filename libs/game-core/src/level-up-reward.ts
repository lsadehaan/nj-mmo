const HP_PER_LEVEL = 12;
const MP_PER_LEVEL = 5;

export interface FlatLevelUpVitals {
  maxHp: number;
  maxMp: number;
  hp: number;
  mp: number;
}

export function applyLevelUpReward(
  prevLevel: number,
  newLevel: number,
  vitals: FlatLevelUpVitals
): FlatLevelUpVitals {
  const levelsGained = Math.max(0, newLevel - prevLevel);
  if (levelsGained === 0) {
    return { ...vitals };
  }

  const maxHp = vitals.maxHp + HP_PER_LEVEL * levelsGained;
  const maxMp = vitals.maxMp + MP_PER_LEVEL * levelsGained;
  return { maxHp, maxMp, hp: maxHp, mp: maxMp };
}
