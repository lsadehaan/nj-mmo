export type ZoneType = 'peace' | 'combat' | 'fishing' | 'water';

export interface TiZone {
  id: string;
  displayName: string;
  type: ZoneType;
  /** Convex polygon vertices in local XZ (metres), closed implicitly. */
  polygon: ReadonlyArray<{ x: number; z: number }>;
}

export interface ZoneHit {
  zoneId: string;
  displayName: string;
  type: ZoneType;
}

const WILDERNESS_HIT: ZoneHit = {
  zoneId: 'wilderness',
  displayName: 'Wilderness',
  type: 'combat',
};

/*
 * Radial Talking Island layout. The village peace zone sits at the local origin
 * and the combat fields fan out around it on different sides so the player is
 * surrounded rather than facing a wall of mobs on one edge. Difficulty climbs
 * with distance: the two low-level fields hug the village (east + north), the
 * high-level grounds sit far out (south, west) and the harbour holds the
 * mid/high fishing-coast pack to the south-west. The spawn generator assigns
 * each species to one of these zones by its level tier (see `zoneForLevel`).
 */
const TI_ZONES: readonly TiZone[] = [
  {
    id: 'ti_village',
    displayName: 'Talking Island Village',
    type: 'peace',
    polygon: [
      { x: -45, z: -40 },
      { x: 45, z: -40 },
      { x: 45, z: 40 },
      { x: -45, z: 40 },
    ],
  },
  {
    // EAST, near — newbie field (levels 1-4).
    id: 'eastern_fields',
    displayName: 'Eastern Fields',
    type: 'combat',
    polygon: [
      { x: 55, z: -70 },
      { x: 175, z: -70 },
      { x: 175, z: 70 },
      { x: 55, z: 70 },
    ],
  },
  {
    // NORTH, near — second-step field (levels 5-7).
    id: 'obelisk',
    displayName: 'Obelisk of Victory',
    type: 'combat',
    polygon: [
      { x: -75, z: -200 },
      { x: 45, z: -200 },
      { x: 45, z: -55 },
      { x: -75, z: -55 },
    ],
  },
  {
    // WEST, far — highest-level ruins (levels 14-17).
    id: 'elven_ruins',
    displayName: 'Elven Ruins',
    type: 'combat',
    polygon: [
      { x: -320, z: -80 },
      { x: -170, z: -80 },
      { x: -170, z: 80 },
      { x: -320, z: 80 },
    ],
  },
  {
    // SOUTH-WEST, far — fishing coast pack (levels 8-10).
    id: 'harbor',
    displayName: 'Talking Island Harbor',
    type: 'fishing',
    polygon: [
      { x: -280, z: 250 },
      { x: -170, z: 250 },
      { x: -170, z: 310 },
      { x: -280, z: 310 },
    ],
  },
  {
    id: 'harbor_water',
    displayName: 'Harbor Basin',
    type: 'water',
    polygon: [
      { x: -255, z: 265 },
      { x: -195, z: 265 },
      { x: -195, z: 285 },
      { x: -255, z: 285 },
    ],
  },
  {
    // SOUTH, far — high-level cave grounds (levels 11-13).
    id: 'cave_of_souls',
    displayName: 'Cave of Souls',
    type: 'combat',
    polygon: [
      { x: -70, z: 170 },
      { x: 70, z: 170 },
      { x: 70, z: 300 },
      { x: -70, z: 300 },
    ],
  },
] as const;

/** Harbour water sample for walkability / zone tests. */
export const HARBOR_WATER_SAMPLE = { x: -225, z: 275 } as const;

function pointInPolygon(
  x: number,
  z: number,
  polygon: ReadonlyArray<{ x: number; z: number }>
): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const zi = polygon[i].z;
    const xj = polygon[j].x;
    const zj = polygon[j].z;
    const intersect =
      zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function bboxArea(polygon: ReadonlyArray<{ x: number; z: number }>): number {
  const xs = polygon.map((p) => p.x);
  const zs = polygon.map((p) => p.z);
  return (Math.max(...xs) - Math.min(...xs)) * (Math.max(...zs) - Math.min(...zs));
}

export function listTiZones(): readonly TiZone[] {
  return TI_ZONES;
}

export function getZoneAt(x: number, z: number): ZoneHit {
  const hits: TiZone[] = [];
  for (const zone of TI_ZONES) {
    if (pointInPolygon(x, z, zone.polygon)) {
      hits.push(zone);
    }
  }
  if (hits.length === 0) return WILDERNESS_HIT;

  hits.sort((a, b) => {
    const areaDiff = bboxArea(a.polygon) - bboxArea(b.polygon);
    if (areaDiff !== 0) return areaDiff;
    return a.id.localeCompare(b.id);
  });

  const winner = hits[0];
  return {
    zoneId: winner.id === 'harbor_water' ? 'harbor' : winner.id,
    displayName: winner.displayName,
    type: winner.type,
  };
}

export function isWaterZone(x: number, z: number): boolean {
  const water = TI_ZONES.find((z) => z.id === 'harbor_water');
  return water ? pointInPolygon(x, z, water.polygon) : false;
}
