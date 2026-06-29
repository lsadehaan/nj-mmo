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
    id: 'eastern_fields',
    displayName: 'Eastern Fields',
    type: 'combat',
    polygon: [
      { x: -170, z: -10 },
      { x: -50, z: -10 },
      { x: -50, z: 70 },
      { x: -170, z: 70 },
    ],
  },
  {
    id: 'obelisk',
    displayName: 'Obelisk of Victory',
    type: 'combat',
    polygon: [
      { x: -190, z: 30 },
      { x: -120, z: 30 },
      { x: -120, z: 90 },
      { x: -190, z: 90 },
    ],
  },
  {
    id: 'elven_ruins',
    displayName: 'Elven Ruins',
    type: 'combat',
    polygon: [
      { x: -320, z: 50 },
      { x: -240, z: 50 },
      { x: -240, z: 130 },
      { x: -320, z: 130 },
    ],
  },
  {
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
    id: 'cave_of_souls',
    displayName: 'Cave of Souls',
    type: 'combat',
    polygon: [
      { x: -275, z: 230 },
      { x: -210, z: 230 },
      { x: -210, z: 280 },
      { x: -275, z: 280 },
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
