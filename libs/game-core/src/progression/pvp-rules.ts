export const PVP_NORMAL_TIME_MS = 120_000;
export const PVP_PVP_TIME_MS = 60_000;

export interface PvpFlagState {
  pvpFlag: number;
  pvpFlagEndMs: number;
}

export interface PvpCombatant {
  pvpFlag: number;
  karma: number;
}

export interface TogglePvpResult {
  ok: boolean;
  pvpFlag: number;
  pvpFlagEndMs: number;
}

export function applyTogglePvp(
  nowMs: number,
  zonePeace: boolean
): TogglePvpResult {
  if (zonePeace) {
    return { ok: false, pvpFlag: 0, pvpFlagEndMs: 0 };
  }
  return {
    ok: true,
    pvpFlag: 1,
    pvpFlagEndMs: nowMs + PVP_NORMAL_TIME_MS,
  };
}

export function tickPvpFlag(
  nowMs: number,
  flag: number,
  endMs: number
): number {
  if (flag === 0) return 0;
  if (endMs <= 0) return flag;
  if (nowMs >= endMs) return 0;
  return flag;
}

export function extendPvpFlagOnHit(nowMs: number): { pvpFlag: number; pvpFlagEndMs: number } {
  return {
    pvpFlag: 1,
    pvpFlagEndMs: nowMs + PVP_PVP_TIME_MS,
  };
}

export function applyPkKarma(karma: number): number {
  return karma - 720;
}

export function applyKarmaRelief(karma: number, xpGained: number): number {
  if (karma >= 0) return karma;
  const relief = Math.floor(xpGained / 300);
  return Math.min(0, karma + relief);
}

export function canAttackPlayer(
  attacker: PvpCombatant,
  target: PvpCombatant & { alive: boolean },
  zonePeace: boolean
): boolean {
  if (zonePeace) return false;
  if (!target.alive) return false;
  if (target.pvpFlag === 1) return true;
  if (attacker.karma < 0) return true;
  return false;
}

export function isInnocentKill(
  target: PvpCombatant
): boolean {
  return target.pvpFlag === 0 && target.karma >= 0;
}
