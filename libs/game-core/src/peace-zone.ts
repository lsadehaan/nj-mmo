/** Axis-aligned village peace zone (40 m × 40 m at origin). */
export const PEACE_ZONE = {
  minX: -20,
  maxX: 20,
  minZ: -20,
  maxZ: 20,
} as const;

/** Proximity gate for NPC interact / shop messages (meters). */
export const NPC_INTERACT_RADIUS = 3.0;

export function isInPeaceZone(x: number, z: number): boolean {
  return (
    x >= PEACE_ZONE.minX &&
    x <= PEACE_ZONE.maxX &&
    z >= PEACE_ZONE.minZ &&
    z <= PEACE_ZONE.maxZ
  );
}
