import {
  applyTogglePvp,
  tickPvpFlag,
  extendPvpFlagOnHit,
  applyPkKarma,
  isInnocentKill,
  isInPeaceZone,
  type StatName,
} from '@nj/game-core';
import type { PlayerState } from './schema/TownState';
import type { PlayerCombatState } from './combat-resolver';
import type { Character } from '../db/schema';

export function handleTogglePvpIntent(
  player: PlayerState,
  stored: Character,
  playerX: number,
  playerZ: number,
  nowMs: number
): boolean {
  const peace = isInPeaceZone(playerX, playerZ);
  const result = applyTogglePvp(nowMs, peace);
  if (!result.ok) return false;
  player.pvpFlag = result.pvpFlag;
  player.pvpFlagEndMs = result.pvpFlagEndMs;
  stored.pvpFlagEndMs = result.pvpFlagEndMs;
  return true;
}

export function tickPvpFlagsForPlayers(
  players: Iterable<PlayerState>,
  nowMs: number
): void {
  for (const player of players) {
    player.pvpFlag = tickPvpFlag(nowMs, player.pvpFlag, player.pvpFlagEndMs);
    if (player.pvpFlag === 0) {
      player.pvpFlagEndMs = 0;
    }
  }
}

export function extendAttackerPvpFlag(
  attacker: PlayerState,
  stored: Character,
  nowMs: number
): void {
  const extended = extendPvpFlagOnHit(nowMs);
  attacker.pvpFlag = extended.pvpFlag;
  attacker.pvpFlagEndMs = extended.pvpFlagEndMs;
  stored.pvpFlagEndMs = extended.pvpFlagEndMs;
}

export function applyPlayerKillKarma(
  attacker: PlayerState,
  stored: Character,
  victim: PlayerState
): void {
  if (isInnocentKill(victim)) {
    attacker.karma = applyPkKarma(attacker.karma);
    stored.pkKills += 1;
  } else if (victim.pvpFlag === 1) {
    stored.pvpKills += 1;
  }
}

export function handleSetTargetPlayer(
  combat: PlayerCombatState,
  targetSessionId: string | null,
  selfSessionId: string
): boolean {
  if (targetSessionId === selfSessionId) return false;
  combat.targetPlayerSessionId = targetSessionId;
  combat.targetMobId = null;
  return true;
}
