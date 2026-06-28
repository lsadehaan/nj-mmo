import * as THREE from 'three';
import { EntityAction, type AnimationClip } from '@nj/game-core';
import { buildHumanoid } from './creature/humanoid';
import { createAnimator } from './creature/animator';
import { getGameState } from '../test-hook';

const MOVE_THRESHOLD = 0.02;
const IDLE_THRESHOLD = 0.015;

export interface PlayerAvatarSync {
  x: number;
  y: number;
  z: number;
  action?: EntityAction;
  actionSeq?: number;
}

export interface PlayerAvatar {
  group: THREE.Group;
  sync: (p: PlayerAvatarSync) => void;
  update: (dt: number, nowMs?: number) => AnimationClip;
}

function yawFromDirection(dx: number, dz: number): number {
  return Math.atan2(dx, dz);
}

export function createPlayerAvatar(options?: { hasWeapon?: boolean }): PlayerAvatar {
  const rig = buildHumanoid({ hasWeapon: options?.hasWeapon ?? false });
  const animator = createAnimator(rig);
  const group = rig.root;

  let prevX = 0;
  let prevZ = 0;
  let lastDx = 0;
  let lastDz = 0;
  let locomotion: 'idle' | 'move' = 'idle';
  let lastYaw = 0;
  let action = EntityAction.None;
  let actionSeq = 0;
  let initialized = false;

  const sync = (p: PlayerAvatarSync): void => {
    if (!initialized) {
      prevX = p.x;
      prevZ = p.z;
      initialized = true;
    }

    const dx = p.x - prevX;
    const dz = p.z - prevZ;
    lastDx = dx;
    lastDz = dz;
    const delta = Math.hypot(dx, dz);
    if (locomotion === 'move') {
      locomotion = delta > IDLE_THRESHOLD ? 'move' : 'idle';
    } else {
      locomotion = delta > MOVE_THRESHOLD ? 'move' : 'idle';
    }

    if (typeof p.action === 'number') {
      action = p.action;
    }
    if (typeof p.actionSeq === 'number') {
      actionSeq = p.actionSeq;
    }

    group.position.set(p.x, p.y, p.z);
    prevX = p.x;
    prevZ = p.z;
  };

  const update = (dt: number, nowMs = performance.now()): AnimationClip => {
    void dt;
    const clip = animator.update(
      { action, actionSeq, locomotion },
      nowMs
    );

    if (clip === 'attack' || clip === 'cast') {
      const state = getGameState();
      const mob = state.mobs.find((entry) => entry.id === state.targetMobId);
      if (mob) {
        lastYaw = yawFromDirection(mob.x - group.position.x, mob.z - group.position.z);
      }
    } else if (locomotion === 'move') {
      if (Math.hypot(lastDx, lastDz) > 0.0001) {
        lastYaw = yawFromDirection(lastDx, lastDz);
      }
    }

    group.rotation.y = lastYaw;
    return clip;
  };

  return { group, sync, update };
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

export { MOVE_THRESHOLD, IDLE_THRESHOLD };
