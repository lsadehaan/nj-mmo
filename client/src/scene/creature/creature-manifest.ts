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
 * Clip map for procedurally-generated biped GLBs (Gremlin, Goblin).
 * Animation names match the clips baked by scripts/gen-glb-assets.py:
 *   Idle (2 s loop), Walk (1 s loop), Attack (0.8 s), Death (1.5 s).
 */
export const PROCEDURAL_BIPED_CLIP_MAP: Record<AnimationClip, string> = {
  idle: 'Idle',
  move: 'Walk',
  attack: 'Attack',
  cast: 'Attack',  // no separate cast clip; fall back to attack
  die: 'Death',
};

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
 * Gremlin and Goblin use procedurally-generated GLBs (scripts/gen-glb-assets.py).
 * Wolf and BeardedKeltir use Quaternius CC0 animal packs.
 */
const CREATURE_MANIFEST: Record<number, CreatureEntry> = {
  20001: {
    model: '/models/monsters/Gremlin.glb',
    clipMap: PROCEDURAL_BIPED_CLIP_MAP,
    scale: 0.52,
    feetOffsetY: 0.47,
    hpBarYOffset: 1.45,
  },
  20003: {
    model: '/models/monsters/Goblin.glb',
    clipMap: PROCEDURAL_BIPED_CLIP_MAP,
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
