import * as THREE from 'three';
import {
  EntityAction,
  ACTION_DURATION_MS,
  createAnimState,
  stepAnimation,
  type AnimationClip,
  type AnimState,
} from '@nj/game-core';
import {
  createMeshCharacterInstance,
  type GLTFTemplate,
  type MeshCharacter,
} from './creature/mesh-character';
import type { CreatureEntry } from './creature/creature-manifest';
import { MOVE_THRESHOLD, MOVE_COAST_MS } from './player-avatar';

export interface MobAvatarSync {
  x: number;
  y: number;
  z: number;
  action?: EntityAction;
  actionSeq?: number;
  faceToward?: { x: number; z: number };
}

export interface MobAvatar {
  group: THREE.Group;
  sync: (p: MobAvatarSync, nowMs?: number) => void;
  update: (dt: number, nowMs?: number) => AnimationClip;
  ready: Promise<void>;
  latchDie: (nowMs?: number) => void;
  isDiePlaying: (nowMs?: number) => boolean;
}

function yawFromDirection(dx: number, dz: number): number {
  return Math.atan2(dx, dz);
}

export function computeMobFacingYaw(
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

export interface MobAvatarOptions {
  entry: CreatureEntry;
  template: GLTFTemplate;
  mesh?: MeshCharacter;
}

export function createMobAvatar(options: MobAvatarOptions): MobAvatar {
  const { entry } = options;
  const group = new THREE.Group();
  group.name = 'mob-avatar';

  const mesh =
    options.mesh ??
    createMeshCharacterInstance(options.template, {
      clipMap: entry.clipMap,
      scale: entry.scale,
    });
  group.add(mesh.object);
  const ready = mesh.ready.catch(() => undefined);

  let animState: AnimState = createAnimState();
  let prevX = 0;
  let prevZ = 0;
  let lastMoveMs = Number.NEGATIVE_INFINITY;
  let lastYaw = 0;
  let action = EntityAction.None;
  let actionSeq = 0;
  let initialized = false;
  let latchedDie = false;
  let dieLatchStartMs = Number.NEGATIVE_INFINITY;

  const sync = (p: MobAvatarSync, nowMs = performance.now()): void => {
    if (!initialized) {
      prevX = p.x;
      prevZ = p.z;
      initialized = true;
    }

    const dx = p.x - prevX;
    const dz = p.z - prevZ;
    const delta = Math.hypot(dx, dz);

    if (delta > MOVE_THRESHOLD) {
      lastMoveMs = nowMs;
      lastYaw = yawFromDirection(dx, dz);
    }

    if (typeof p.action === 'number') action = p.action;
    if (typeof p.actionSeq === 'number') actionSeq = p.actionSeq;

    if (action === EntityAction.Die && actionSeq !== animState.lastSeq) {
      latchedDie = true;
      dieLatchStartMs = nowMs;
    }

    group.position.set(0, -entry.feetOffsetY, 0);
    prevX = p.x;
    prevZ = p.z;

    if (p.faceToward) {
      lastYaw = yawFromDirection(p.faceToward.x - p.x, p.faceToward.z - p.z);
    }
  };

  const latchDie = (nowMs = performance.now()): void => {
    latchedDie = true;
    if (dieLatchStartMs === Number.NEGATIVE_INFINITY) {
      dieLatchStartMs = nowMs;
    }
    action = EntityAction.Die;
    actionSeq = animState.lastSeq + 1;
  };

  const isDiePlaying = (nowMs = performance.now()): boolean => {
    if (!latchedDie) return false;
    return nowMs - dieLatchStartMs < ACTION_DURATION_MS[EntityAction.Die];
  };

  const update = (dt: number, nowMs = performance.now()): AnimationClip => {
    const locomotion: 'idle' | 'move' =
      nowMs - lastMoveMs <= MOVE_COAST_MS ? 'move' : 'idle';
    const stepped = stepAnimation(animState, { action, actionSeq, locomotion, nowMs });
    animState = stepped.state;
    const clip = latchedDie ? 'die' : stepped.clip;

    mesh.play(clip);
    mesh.update(dt);
    group.rotation.y = lastYaw;
    return clip;
  };

  return { group, sync, update, ready, latchDie, isDiePlaying };
}

export { MOVE_THRESHOLD, MOVE_COAST_MS };
