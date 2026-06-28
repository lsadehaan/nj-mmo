export interface BuildingPropEntry {
  model: string;
  scale: number;
  yOffset: number;
  yRotation: number;
}

export interface ScatterPropEntry {
  model: string;
  scaleMultiplier: number;
}

export interface PeaceZonePropEntry {
  model: string;
  scale: number;
  yOffset: number;
}

const ENV_BASE = '/models/props/environment';

/**
 * Indices align with BUILDING_LAYOUT order in world-blockers / village.ts.
 * GLBs are hand-authored, real-world-sized closed houses (scripts/build-houses.mjs)
 * already aligned to their plot footprints, so scale 1.0 and no rotation.
 */
const BUILDING_PROPS: readonly BuildingPropEntry[] = [
  { model: `${ENV_BASE}/Building_0.glb`, scale: 1.0, yOffset: 0, yRotation: 0 },
  { model: `${ENV_BASE}/Building_1.glb`, scale: 1.0, yOffset: 0, yRotation: 0 },
  { model: `${ENV_BASE}/Building_2.glb`, scale: 1.0, yOffset: 0, yRotation: 0 },
  { model: `${ENV_BASE}/Building_3.glb`, scale: 1.0, yOffset: 0, yRotation: 0 },
  { model: `${ENV_BASE}/Building_4.glb`, scale: 1.0, yOffset: 0, yRotation: 0 },
] as const;

const SCATTER_PROPS: Record<'tree' | 'rock', ScatterPropEntry> = {
  tree: { model: `${ENV_BASE}/Tree.glb`, scaleMultiplier: 0.6 },
  rock: { model: `${ENV_BASE}/Rock.glb`, scaleMultiplier: 0.8 },
};

const PEACE_ZONE_MARKER: PeaceZonePropEntry = {
  model: `${ENV_BASE}/PeaceMarker.glb`,
  scale: 1.0,
  yOffset: 0,
};

export type BuildingPropIndex = 0 | 1 | 2 | 3 | 4;

export function getBuildingPropEntry(index: BuildingPropIndex): BuildingPropEntry {
  const entry = BUILDING_PROPS[index];
  if (!entry) {
    throw new RangeError(`building prop index out of range: ${index}`);
  }
  return entry;
}

export function getScatterPropEntry(kind: 'tree' | 'rock'): ScatterPropEntry {
  return SCATTER_PROPS[kind];
}

export function getPeaceZoneMarkerEntry(): PeaceZonePropEntry {
  return PEACE_ZONE_MARKER;
}

export function listEnvironmentModelPaths(): string[] {
  const buildingPaths = BUILDING_PROPS.map((entry) => entry.model);
  return [
    ...buildingPaths,
    SCATTER_PROPS.tree.model,
    SCATTER_PROPS.rock.model,
    PEACE_ZONE_MARKER.model,
  ];
}
