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

/** KayKit universal rig — greet via Interact track. */
export const KAYKIT_NPC_CLIP_MAP: Record<AnimationClip, string> = {
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

/** Three.js Xbot sample rig — track names from GLB inspect. */
export const WILFORD_CLIP_MAP: Record<AnimationClip, string> = {
  idle: 'idle',
  move: 'walk',
  attack: 'sad_pose',
  cast: 'agree',
  die: 'sad_pose',
};

const NPC_MANIFEST: Record<number, NpcEntry> = {
  30001: {
    model: '/models/npcs/Lector.glb',
    clipMap: KAYKIT_NPC_CLIP_MAP,
    scale: 0.84,
    feetOffsetY: 0.75,
    displayName: 'Lector',
  },
  30002: {
    model: '/models/npcs/Jackson.glb',
    clipMap: KAYKIT_NPC_CLIP_MAP,
    scale: 0.88,
    feetOffsetY: 0.75,
    displayName: 'Jackson',
  },
  30003: {
    model: '/models/npcs/Silvia.glb',
    clipMap: KAYKIT_NPC_CLIP_MAP,
    scale: 0.84,
    feetOffsetY: 0.75,
    displayName: 'Silvia',
  },
  30004: {
    model: '/models/characters/Mage.glb',
    clipMap: KATERINA_CLIP_MAP,
    scale: 0.84,
    feetOffsetY: 0.75,
    displayName: 'Katerina',
  },
  30005: {
    model: '/models/npcs/Wilford.glb',
    clipMap: WILFORD_CLIP_MAP,
    scale: 0.9,
    feetOffsetY: 0,
    displayName: 'Wilford',
  },
  30006: {
    model: '/models/npcs/Roxxy.glb',
    clipMap: ROXXY_CLIP_MAP,
    scale: 1.18,
    feetOffsetY: 0,
    displayName: 'Roxxy',
  },
  30026: {
    model: '/models/npcs/Bitz.glb',
    clipMap: KAYKIT_NPC_CLIP_MAP,
    scale: 0.84,
    feetOffsetY: 0.75,
    displayName: 'Bitz',
  },
};

export function getNpcEntry(npcId: number): NpcEntry | null {
  return NPC_MANIFEST[npcId] ?? null;
}

export const TI_NPC_MANIFEST_IDS = [30001, 30002, 30003, 30004, 30005, 30006, 30026] as const;
