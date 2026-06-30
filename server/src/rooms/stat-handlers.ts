import {
  allocateStatPoint,
  resetStatPoints,
  calcResetStatsCost,
  isValidStatName,
  type StatName,
} from '@nj/game-core';
import type { PlayerState } from './schema/TownState';
import type { Character } from '../db/schema';

export function handleAllocateStat(
  player: PlayerState,
  stored: Character,
  stat: string
): boolean {
  if (!isValidStatName(stat)) return false;
  const result = allocateStatPoint(
    {
      unspentStatPoints: player.unspentStatPoints,
      bonusStr: player.bonusStr,
      bonusDex: player.bonusDex,
      bonusCon: player.bonusCon,
      bonusInt: player.bonusInt,
      bonusWit: player.bonusWit,
      bonusMen: player.bonusMen,
    },
    stat as StatName
  );
  if (!result.ok) return false;
  player.unspentStatPoints = result.state.unspentStatPoints;
  player.bonusStr = result.state.bonusStr;
  player.bonusDex = result.state.bonusDex;
  player.bonusCon = result.state.bonusCon;
  player.bonusInt = result.state.bonusInt;
  player.bonusWit = result.state.bonusWit;
  player.bonusMen = result.state.bonusMen;
  stored.unspentStatPoints = result.state.unspentStatPoints;
  stored.bonusStr = result.state.bonusStr;
  stored.bonusDex = result.state.bonusDex;
  stored.bonusCon = result.state.bonusCon;
  stored.bonusInt = result.state.bonusInt;
  stored.bonusWit = result.state.bonusWit;
  stored.bonusMen = result.state.bonusMen;
  return true;
}

export function handleResetStats(
  player: PlayerState,
  stored: Character
): boolean {
  const cost = calcResetStatsCost(player.level);
  if (player.adena < cost) return false;
  const reset = resetStatPoints(
    {
      unspentStatPoints: player.unspentStatPoints,
      bonusStr: player.bonusStr,
      bonusDex: player.bonusDex,
      bonusCon: player.bonusCon,
      bonusInt: player.bonusInt,
      bonusWit: player.bonusWit,
      bonusMen: player.bonusMen,
    },
    player.level
  );
  player.adena -= cost;
  player.unspentStatPoints = reset.unspentStatPoints;
  player.bonusStr = reset.bonusStr;
  player.bonusDex = reset.bonusDex;
  player.bonusCon = reset.bonusCon;
  player.bonusInt = reset.bonusInt;
  player.bonusWit = reset.bonusWit;
  player.bonusMen = reset.bonusMen;
  stored.adena = player.adena;
  stored.unspentStatPoints = reset.unspentStatPoints;
  stored.bonusStr = reset.bonusStr;
  stored.bonusDex = reset.bonusDex;
  stored.bonusCon = reset.bonusCon;
  stored.bonusInt = reset.bonusInt;
  stored.bonusWit = reset.bonusWit;
  stored.bonusMen = reset.bonusMen;
  return true;
}
