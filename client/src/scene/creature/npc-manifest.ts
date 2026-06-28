import type { AnimationClip } from '@nj/game-core';
import { KAYKIT_CLIP_MAP } from './mesh-character';

export interface NpcEntry {
  model: string;
  clipMap: Record<AnimationClip, string>;
  scale: number;
  /** Subtract from server body-center y so feet sit on terrain. */
  feetOffsetY: number;
  displayName: string;
}

/** KayKit Mage with greet mapped to the asset's Interact track (verified at ingest). */
export const KATERINA_CLIP_MAP: Record<AnimationClip, string> = {
  ...KAYKIT_CLIP_MAP,
  cast: 'Interact',
};

/** Quaternius Animated Woman rig (CC0) — track names from GLB inspect. */
export const ROXXY_CLIP_MAP: Record<AnimationClip, string> = {
  idle: 'CharacterArmature|Idle',
  move: 'CharacterArmature|Walk',
  attack: 'CharacterArmature|Punch_Left',
  cast: 'CharacterArmature|Interact',
  die: 'CharacterArmature|Death',
};

const NPC_MANIFEST: Record<number, NpcEntry> = {
  30004: {
    model: '/models/characters/Mage.glb',
    clipMap: KATERINA_CLIP_MAP,
    scale: 0.84,
    feetOffsetY: 0.75,
    displayName: 'Katerina',
  },
  30006: {
    model: '/models/npcs/Roxxy.glb',
    clipMap: ROXXY_CLIP_MAP,
    scale: 1.18,
    feetOffsetY: 0,
    displayName: 'Roxxy',
  },
};

export function getNpcEntry(npcId: number): NpcEntry | null {
  return NPC_MANIFEST[npcId] ?? null;
}
