import * as THREE from 'three';
import {
  EntityAction,
  createAnimState,
  stepAnimation,
  type AnimationClip,
  type AnimState,
} from '@nj/game-core';
import { createMeshCharacter, type MeshCharacter } from './creature/mesh-character';
import { getGameState } from '../test-hook';

/** Min server-step displacement (per sync) that counts as movement. */
const MOVE_THRESHOLD = 0.02;
/**
 * How long locomotion stays 'move' after the last movement sync. Must exceed the
 * server's movement broadcast interval so we don't flicker between syncs, but be
 * short enough to feel responsive when the player stops. The server stops
 * broadcasting position once stationary, so this timeout — not a zero-delta sync
 * — is what returns us to 'idle'.
 */
const MOVE_COAST_MS = 200;

/** Beginner look: leather-only Rogue (green tunic + straps), not the plate Knight. */
const DEFAULT_CHARACTER = 'Rogue';
/** KayKit bbox is ~2.69u tall at scale 1; keep it hero-readable in the follow cam. */
const MODEL_SCALE = 1;
/** Server y is the body-center height (legacy capsule); drop the mesh so its feet sit on the ground. */
const FEET_OFFSET_Y = 0.9;

export interface PlayerAvatarSync {
  x: number;
  y: number;
  z: number;
  action?: EntityAction;
  actionSeq?: number;
}

export interface PlayerAvatar {
  group: THREE.Group;
  sync: (p: PlayerAvatarSync, nowMs?: number) => void;
  update: (dt: number, nowMs?: number) => AnimationClip;
  ready: Promise<void>;
}

function yawFromDirection(dx: number, dz: number): number {
  return Math.atan2(dx, dz);
}

export interface PlayerAvatarOptions {
  character?: string;
  mesh?: MeshCharacter;
}

export function createPlayerAvatar(options: PlayerAvatarOptions = {}): PlayerAvatar {
  const group = new THREE.Group();
  group.name = 'player-avatar';

  const character =
    options.mesh ??
    createMeshCharacter(`/models/characters/${options.character ?? DEFAULT_CHARACTER}.glb`, {
      scale: MODEL_SCALE,
    });
  group.add(character.object);
  const ready = character.ready.catch(() => {
    /* mesh load failure is non-fatal for logic (e.g. unit tests with no server) */
  });

  let animState: AnimState = createAnimState();
  let prevX = 0;
  let prevZ = 0;
  let lastMoveMs = Number.NEGATIVE_INFINITY;
  let lastYaw = 0;
  let action = EntityAction.None;
  let actionSeq = 0;
  let initialized = false;

  const sync = (p: PlayerAvatarSync, nowMs = performance.now()): void => {
    if (!initialized) {
      prevX = p.x;
      prevZ = p.z;
      initialized = true;
    }

    const dx = p.x - prevX;
    const dz = p.z - prevZ;
    const delta = Math.hypot(dx, dz);

    // Locomotion is derived from server position steps and held alive by a coast
    // timer (see MOVE_COAST_MS): a real movement step refreshes the timer; the
    // absence of further steps lets it expire to idle.
    if (delta > MOVE_THRESHOLD) {
      lastMoveMs = nowMs;
      lastYaw = yawFromDirection(dx, dz);
    }

    if (typeof p.action === 'number') action = p.action;
    if (typeof p.actionSeq === 'number') actionSeq = p.actionSeq;

    group.position.set(p.x, p.y - FEET_OFFSET_Y, p.z);
    prevX = p.x;
    prevZ = p.z;
  };

  const update = (dt: number, nowMs = performance.now()): AnimationClip => {
    const locomotion: 'idle' | 'move' =
      nowMs - lastMoveMs <= MOVE_COAST_MS ? 'move' : 'idle';
    const stepped = stepAnimation(animState, { action, actionSeq, locomotion, nowMs });
    animState = stepped.state;
    const clip = stepped.clip;

    character.play(clip);
    character.update(dt);

    if ((clip === 'attack' || clip === 'cast')) {
      const state = getGameState();
      const mob = state.mobs.find((entry) => entry.id === state.targetMobId);
      if (mob) {
        lastYaw = yawFromDirection(mob.x - group.position.x, mob.z - group.position.z);
      }
    }

    group.rotation.y = lastYaw;
    return clip;
  };

  return { group, sync, update, ready };
}

export function computeFacingYaw(
  dx: number,
  dz: number,
  targetDx?: number,
  targetDz?: number,
  faceTarget = false
): number {
  if (faceTarget && targetDx !== undefined && targetDz !== undefined) {
    return yawFromDirection(targetDx, targetDz);
  }
  return yawFromDirection(dx, dz);
}

export { MOVE_THRESHOLD, MOVE_COAST_MS };
