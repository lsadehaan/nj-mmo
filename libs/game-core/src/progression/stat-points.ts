export type StatName = 'str' | 'dex' | 'con' | 'int' | 'wit' | 'men';

export interface StatBonusState {
  unspentStatPoints: number;
  bonusStr: number;
  bonusDex: number;
  bonusCon: number;
  bonusInt: number;
  bonusWit: number;
  bonusMen: number;
}

export interface StatResult {
  ok: boolean;
  state: StatBonusState;
}

const STAT_KEYS: Record<StatName, keyof StatBonusState> = {
  str: 'bonusStr',
  dex: 'bonusDex',
  con: 'bonusCon',
  int: 'bonusInt',
  wit: 'bonusWit',
  men: 'bonusMen',
};

export function statPointsEarnedByLevel(level: number): number {
  return Math.max(0, level - 1);
}

export function awardStatPointOnLevelUp(
  state: StatBonusState,
  prevLevel: number,
  newLevel: number
): StatBonusState {
  if (newLevel <= prevLevel) return state;
  const gained = newLevel - prevLevel;
  return {
    ...state,
    unspentStatPoints: state.unspentStatPoints + gained,
  };
}

export function allocateStatPoint(
  state: StatBonusState,
  stat: StatName
): StatResult {
  if (state.unspentStatPoints <= 0) {
    return { ok: false, state };
  }
  const key = STAT_KEYS[stat];
  return {
    ok: true,
    state: {
      ...state,
      [key]: (state[key] as number) + 1,
      unspentStatPoints: state.unspentStatPoints - 1,
    },
  };
}

export function isValidStatName(stat: string): stat is StatName {
  return stat in STAT_KEYS;
}

export function resetStatPoints(
  state: StatBonusState,
  level: number
): StatBonusState {
  return {
    unspentStatPoints: statPointsEarnedByLevel(level),
    bonusStr: 0,
    bonusDex: 0,
    bonusCon: 0,
    bonusInt: 0,
    bonusWit: 0,
    bonusMen: 0,
  };
}

export function effectiveStat(base: number, bonus: number): number {
  return base + bonus;
}

export function calcResetStatsCost(level: number): number {
  return level * 1000;
}
