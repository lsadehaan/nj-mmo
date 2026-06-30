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
  30027: {
    model: '/models/npcs/Gwinter.glb',
    clipMap: KAYKIT_NPC_CLIP_MAP,
    scale: 0.84,
    feetOffsetY: 0.75,
    displayName: 'Gwinter',
  },
  30028: {
    model: '/models/npcs/Pintage.glb',
    clipMap: KAYKIT_NPC_CLIP_MAP,
    scale: 0.84,
    feetOffsetY: 0.75,
    displayName: 'Pintage',
  },
  30029: {
    model: '/models/npcs/Minia.glb',
    clipMap: KAYKIT_NPC_CLIP_MAP,
    scale: 0.84,
    feetOffsetY: 0.75,
    displayName: 'Minia',
  },
  30030: {
    model: '/models/npcs/Vivyan.glb',
    clipMap: KATERINA_CLIP_MAP,
    scale: 0.84,
    feetOffsetY: 0.75,
    displayName: 'Vivyan',
  },
  30031: {
    model: '/models/npcs/Biotin.glb',
    clipMap: KATERINA_CLIP_MAP,
    scale: 0.86,
    feetOffsetY: 0.75,
    displayName: 'Biotin',
  },
  30032: {
    model: '/models/npcs/Yohanes.glb',
    clipMap: KAYKIT_NPC_CLIP_MAP,
    scale: 0.84,
    feetOffsetY: 0.75,
    displayName: 'Yohanes',
  },
  30033: {
    model: '/models/npcs/Baulro.glb',
    clipMap: KAYKIT_NPC_CLIP_MAP,
    scale: 0.84,
    feetOffsetY: 0.75,
    displayName: 'Baulro',
  },
  30034: {
    model: '/models/npcs/Iris.glb',
    clipMap: KAYKIT_NPC_CLIP_MAP,
    scale: 0.84,
    feetOffsetY: 0.75,
    displayName: 'Iris',
  },
  30035: {
    model: '/models/npcs/Harrys.glb',
    clipMap: KAYKIT_NPC_CLIP_MAP,
    scale: 0.84,
    feetOffsetY: 0.75,
    displayName: 'Harrys',
  },
  30036: {
    model: '/models/npcs/Petron.glb',
    clipMap: KAYKIT_NPC_CLIP_MAP,
    scale: 0.84,
    feetOffsetY: 0.75,
    displayName: 'Petron',
  },
  30039: {
    model: '/models/npcs/GuardKnightA.glb',
    clipMap: KAYKIT_NPC_CLIP_MAP,
    scale: 0.9,
    feetOffsetY: 0.75,
    displayName: 'Gilbert',
  },
  30040: {
    model: '/models/npcs/GuardKnightA.glb',
    clipMap: KAYKIT_NPC_CLIP_MAP,
    scale: 0.9,
    feetOffsetY: 0.75,
    displayName: 'Leon',
  },
  30041: {
    model: '/models/npcs/GuardKnightB.glb',
    clipMap: KAYKIT_NPC_CLIP_MAP,
    scale: 0.9,
    feetOffsetY: 0.75,
    displayName: 'Arnold',
  },
  30042: {
    model: '/models/npcs/GuardKnightB.glb',
    clipMap: KAYKIT_NPC_CLIP_MAP,
    scale: 0.9,
    feetOffsetY: 0.75,
    displayName: 'Abellos',
  },
  30043: {
    model: '/models/npcs/GuardKnightC.glb',
    clipMap: KAYKIT_NPC_CLIP_MAP,
    scale: 0.9,
    feetOffsetY: 0.75,
    displayName: 'Johnstone',
  },
  30044: {
    model: '/models/npcs/GuardKnightC.glb',
    clipMap: KAYKIT_NPC_CLIP_MAP,
    scale: 0.9,
    feetOffsetY: 0.75,
    displayName: 'Chiperan',
  },
  30045: {
    model: '/models/npcs/GuardKnightD.glb',
    clipMap: KAYKIT_NPC_CLIP_MAP,
    scale: 0.9,
    feetOffsetY: 0.75,
    displayName: 'Kenyos',
  },
  30046: {
    model: '/models/npcs/GuardKnightD.glb',
    clipMap: KAYKIT_NPC_CLIP_MAP,
    scale: 0.9,
    feetOffsetY: 0.75,
    displayName: 'Hanks',
  },
  30298: {
    model: '/models/npcs/Jackson.glb',
    clipMap: KAYKIT_NPC_CLIP_MAP,
    scale: 0.88,
    feetOffsetY: 0.75,
    displayName: 'Pinter',
  },
};

export function getNpcEntry(npcId: number): NpcEntry | null {
  return NPC_MANIFEST[npcId] ?? null;
}

export const TI_NPC_MANIFEST_IDS = [
  30001, 30002, 30003, 30004, 30005, 30006, 30026, 30027, 30028, 30029, 30030,
  30031, 30032, 30033, 30034, 30035, 30036, 30039, 30040, 30041, 30042, 30043,
  30044, 30045, 30046, 30298,
] as const;

/** Folk trainers that expose learnSkill (excludes Biotin 30031). */
export const FOLK_TRAINER_NPC_IDS = TI_NPC_MANIFEST_IDS.filter(
  (id) => id >= 30027 && id <= 30036 && id !== 30031
);

/** Bitz plus all folk trainers (learnSkill NPCs). */
export const TRAINER_NPC_IDS = [30026, ...FOLK_TRAINER_NPC_IDS] as const;
