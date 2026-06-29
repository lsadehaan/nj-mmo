import { getZoneAt } from './ti-zones';

/** Proximity gate for NPC interact / shop messages (meters). */
export const NPC_INTERACT_RADIUS = 3.0;

export function isInPeaceZone(x: number, z: number): boolean {
  return getZoneAt(x, z).type === 'peace';
}
