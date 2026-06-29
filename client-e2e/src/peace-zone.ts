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

/** Nearest in-bounds point from which a mob on the peace-zone edge is in melee range. */
export function peaceZoneAttackPosition(
  mob: { x: number; z: number },
  range = 3.4
): { x: number; z: number } {
  const clampedX = Math.max(PEACE_ZONE_MIN, Math.min(PEACE_ZONE_MAX, mob.x));
  const clampedZ = Math.max(PEACE_ZONE_MIN, Math.min(PEACE_ZONE_MAX, mob.z));
  const dist = Math.hypot(mob.x - clampedX, mob.z - clampedZ);
  if (dist <= range) {
    return { x: clampedX, z: clampedZ };
  }
  const dx = clampedX - mob.x;
  const dz = clampedZ - mob.z;
  const len = dist || 1;
  return {
    x: Math.max(PEACE_ZONE_MIN, Math.min(PEACE_ZONE_MAX, mob.x + (dx / len) * range * 0.95)),
    z: Math.max(PEACE_ZONE_MIN, Math.min(PEACE_ZONE_MAX, mob.z + (dz / len) * range * 0.95)),
  };
}

export function isMobAttackableFromPeaceZone(
  mob: { x: number; z: number },
  range = 3.4
): boolean {
  const pos = peaceZoneAttackPosition(mob, range);
  if (isOutsidePeaceZone(pos.x, pos.z)) return false;
  return Math.hypot(mob.x - pos.x, mob.z - pos.z) <= range;
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
