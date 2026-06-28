import type { AnimationClip } from '@nj/game-core';
import { KAYKIT_CLIP_MAP } from './mesh-character';

export interface CreatureEntry {
  model: string;
  clipMap: Record<AnimationClip, string>;
  scale: number;
  /** Subtract from server body-center y so feet sit on terrain. */
  feetOffsetY: number;
  /** Local Y for the billboard HP bar child. */
  hpBarYOffset: number;
}

/**
 * Clip map for Quaternius "Ultimate Monsters" rigged GLBs (Gremlin, Goblin).
 * Clips: Idle, Walk, Bite_Front, Death (+ cosmetic extras ignored).
 */
export const ULTIMATE_MONSTER_CLIP_MAP: Record<AnimationClip, string> = {
  idle: 'Idle',
  move: 'Walk',
  attack: 'Bite_Front',
  cast: 'Bite_Front',
  die: 'Death',
};

/** @deprecated Procedural bipeds replaced by Ultimate Monsters pack imports. */
export const PROCEDURAL_BIPED_CLIP_MAP = ULTIMATE_MONSTER_CLIP_MAP;

/** Quaternius Ultimate Animated Animals — Wolf (CC0). */
export const QUATERNIUS_WOLF_CLIP_MAP: Record<AnimationClip, string> = {
  idle: 'Idle',
  move: 'Walk',
  attack: 'Attack',
  cast: 'Attack',
  die: 'Death',
};

/** Quaternius Ultimate Animated Animals — Deer (CC0), used for Bearded Keltir. */
export const QUATERNIUS_DEER_CLIP_MAP: Record<AnimationClip, string> = {
  idle: 'Idle',
  move: 'Walk',
  attack: 'Attack_Headbutt',
  cast: 'Attack_Headbutt',
  die: 'Death',
};

/**
 * Visual config keyed by seeded npcId.
 * Gremlin and Goblin use Quaternius Ultimate Monsters GLBs (import-pack-assets.mjs).
 * Wolf and BeardedKeltir use Quaternius CC0 animal packs.
 */
const CREATURE_MANIFEST: Record<number, CreatureEntry> = {
  20001: {
    model: '/models/monsters/Gremlin.glb',
    clipMap: ULTIMATE_MONSTER_CLIP_MAP,
    scale: 0.52,
    feetOffsetY: 0.47,
    hpBarYOffset: 1.45,
  },
  20003: {
    model: '/models/monsters/Goblin.glb',
    clipMap: ULTIMATE_MONSTER_CLIP_MAP,
    scale: 0.61,
    feetOffsetY: 0.55,
    hpBarYOffset: 1.65,
  },
  20120: {
    model: '/models/monsters/Wolf.glb',
    clipMap: QUATERNIUS_WOLF_CLIP_MAP,
    scale: 1.15,
    feetOffsetY: 0,
    hpBarYOffset: 0.95,
  },
  20481: {
    model: '/models/monsters/BeardedKeltir.glb',
    clipMap: QUATERNIUS_DEER_CLIP_MAP,
    scale: 0.66,
    feetOffsetY: 0,
    hpBarYOffset: 1.05,
  },
};

export function getCreatureEntry(npcId: number): CreatureEntry | null {
  return CREATURE_MANIFEST[npcId] ?? null;
}
