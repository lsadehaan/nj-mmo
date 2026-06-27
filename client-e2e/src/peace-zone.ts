/** Matches @nj/game-core PEACE_ZONE bounds for e2e target selection. */
export const PEACE_ZONE_MIN = -20;
export const PEACE_ZONE_MAX = 20;

export function isOutsidePeaceZone(x: number, z: number): boolean {
  return (
    x < PEACE_ZONE_MIN ||
    x > PEACE_ZONE_MAX ||
    z < PEACE_ZONE_MIN ||
    z > PEACE_ZONE_MAX
  );
}

export function pickNearestCombatMob(
  mobs: Array<{ id: string; x: number; z: number; hp?: number }>,
  player: { x: number; z: number }
): { id: string; x: number; z: number } {
  return pickNthNearestCombatMob(mobs, player, 0);
}

export function pickSecondNearestCombatMob(
  mobs: Array<{ id: string; x: number; z: number; hp?: number }>,
  player: { x: number; z: number }
): { id: string; x: number; z: number } {
  return pickNthNearestCombatMob(mobs, player, 1);
}

function pickNthNearestCombatMob(
  mobs: Array<{ id: string; x: number; z: number; hp?: number }>,
  player: { x: number; z: number },
  index: number
): { id: string; x: number; z: number } {
  const pool = mobs
    .filter(
      (mob) => isOutsidePeaceZone(mob.x, mob.z) && (mob.hp === undefined || mob.hp > 0)
    )
    .map((mob) => ({
      mob,
      dist: horizontalCombatDistance(player, mob),
    }))
    .sort((a, b) => a.dist - b.dist);

  if (pool.length === 0) {
    throw new Error('No mob spawns outside the village peace zone for combat e2e');
  }
  const pick = pool[Math.min(index, pool.length - 1)].mob;
  return { id: pick.id, x: pick.x, z: pick.z };
}

function horizontalCombatDistance(
  player: { x: number; z: number },
  mob: { x: number; z: number }
): number {
  return Math.hypot(mob.x - player.x, mob.z - player.z);
}
