import type { AnimationClip } from '@nj/game-core';
import { KAYKIT_CLIP_MAP } from './mesh-character';

export interface PlayerManifestEntry {
  classId: number;
  displayName: string;
  model: string;
  clipMap: Record<AnimationClip, string>;
  scale: number;
  feetOffsetY: number;
}

export const PLAYER_MANIFEST: readonly PlayerManifestEntry[] = [
  {
    classId: 0,
    displayName: 'Human Fighter',
    model: '/models/characters/Knight.glb',
    clipMap: KAYKIT_CLIP_MAP,
    scale: 1.0,
    feetOffsetY: 0.9,
  },
  {
    classId: 10,
    displayName: 'Human Mystic',
    model: '/models/characters/Mage.glb',
    clipMap: KAYKIT_CLIP_MAP,
    scale: 1.0,
    feetOffsetY: 0.9,
  },
  {
    classId: 18,
    displayName: 'Elven Fighter',
    model: '/models/characters/Rogue.glb',
    clipMap: KAYKIT_CLIP_MAP,
    scale: 1.0,
    feetOffsetY: 0.9,
  },
  {
    classId: 25,
    displayName: 'Elven Mystic',
    model: '/models/characters/Mage.glb',
    clipMap: KAYKIT_CLIP_MAP,
    scale: 1.0,
    feetOffsetY: 0.9,
  },
  {
    classId: 31,
    displayName: 'Dark Fighter',
    model: '/models/characters/Rogue_Hooded.glb',
    clipMap: KAYKIT_CLIP_MAP,
    scale: 1.0,
    feetOffsetY: 0.9,
  },
  {
    classId: 38,
    displayName: 'Dark Mystic',
    model: '/models/characters/Mage.glb',
    clipMap: KAYKIT_CLIP_MAP,
    scale: 1.0,
    feetOffsetY: 0.9,
  },
  {
    classId: 44,
    displayName: 'Orc Fighter',
    model: '/models/characters/Barbarian.glb',
    clipMap: KAYKIT_CLIP_MAP,
    scale: 1.1,
    feetOffsetY: 0.9,
  },
  {
    classId: 49,
    displayName: 'Orc Mystic',
    model: '/models/characters/Barbarian.glb',
    clipMap: KAYKIT_CLIP_MAP,
    scale: 1.05,
    feetOffsetY: 0.9,
  },
  {
    classId: 53,
    displayName: 'Dwarf Fighter',
    model: '/models/characters/Barbarian.glb',
    clipMap: KAYKIT_CLIP_MAP,
    scale: 0.85,
    feetOffsetY: 0.9,
  },
];

const byClassId = new Map(PLAYER_MANIFEST.map((entry) => [entry.classId, entry]));

export function getPlayerManifestEntry(classId: number): PlayerManifestEntry {
  const entry = byClassId.get(classId);
  if (!entry) {
    return byClassId.get(0)!;
  }
  return entry;
}
