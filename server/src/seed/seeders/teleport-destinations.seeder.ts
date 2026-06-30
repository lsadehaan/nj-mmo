import { l2ToLocal } from '@nj/game-core';
import type { AppDatabase } from '../../db/client';
import { teleportDestinations } from '../../db/schema';

const ROXXY_NPC_ID = 30006;

/** Roxxy TI destinations from L2J Roxxy.xml (Gludin excluded). */
const ROXXY_DESTINATIONS = [
  {
    destinationId: 'obelisk',
    displayName: 'Obelisk of Victory',
    l2x: -99843,
    l2y: 237583,
    feeAdena: 200,
  },
  {
    destinationId: 'northern_ti',
    displayName: 'Northern Territory of TI',
    l2x: -106696,
    l2y: 214691,
    feeAdena: 450,
  },
  {
    destinationId: 'southern_ti',
    displayName: 'Southern Territory of TI',
    l2x: -95336,
    l2y: 240478,
    feeAdena: 140,
  },
  {
    destinationId: 'elven_ruins',
    displayName: 'Elven Ruins',
    l2x: -112367,
    l2y: 234703,
    feeAdena: 590,
  },
  {
    destinationId: 'singing_waterfall',
    displayName: 'Singing Waterfall',
    l2x: -111728,
    l2y: 244330,
    feeAdena: 330,
  },
] as const;

export function seedTeleportDestinations(db: AppDatabase): number {
  const rows = ROXXY_DESTINATIONS.map((dest) => {
    const local = l2ToLocal(dest.l2x, dest.l2y);
    return {
      npcId: ROXXY_NPC_ID,
      destinationId: dest.destinationId,
      displayName: dest.displayName,
      localX: Math.round(local.x * 100) / 100,
      localZ: Math.round(local.z * 100) / 100,
      feeAdena: dest.feeAdena,
    };
  });
  db.insert(teleportDestinations).values(rows).run();
  return rows.length;
}

export { ROXXY_DESTINATIONS };
