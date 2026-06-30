export interface LandmarkEntry {
  name: string;
  model: string;
  x: number;
  z: number;
  scale: number;
  yRotation: number;
}

const LANDMARK_BASE = '/models/props/landmarks';

/** Canonical landmark props — anchors from Phase 23 design (local metres). */
export const LANDMARK_ENTRIES: readonly LandmarkEntry[] = [
  { name: 'Obelisk', model: `${LANDMARK_BASE}/Obelisk.glb`, x: -155, z: 58, scale: 1, yRotation: 0 },
  { name: 'ElvenRuins', model: `${LANDMARK_BASE}/ElvenRuins.glb`, x: -281, z: 87, scale: 1, yRotation: 0 },
  { name: 'RuinsArch', model: `${LANDMARK_BASE}/RuinsArch.glb`, x: -270, z: 90, scale: 1, yRotation: 0.4 },
  { name: 'HarborDock', model: `${LANDMARK_BASE}/HarborDock.glb`, x: -224, z: 287, scale: 1, yRotation: 0 },
  { name: 'CaveEntrance', model: `${LANDMARK_BASE}/CaveEntrance.glb`, x: -242, z: 254, scale: 1, yRotation: 0 },
  { name: 'FieldShrine', model: `${LANDMARK_BASE}/FieldShrine.glb`, x: -110, z: 29, scale: 1, yRotation: 0 },
] as const;

export function listLandmarkEntries(): readonly LandmarkEntry[] {
  return LANDMARK_ENTRIES;
}

export function listLandmarkModelPaths(): string[] {
  return LANDMARK_ENTRIES.map((entry) => entry.model);
}
