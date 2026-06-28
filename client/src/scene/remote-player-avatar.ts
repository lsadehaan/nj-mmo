import * as THREE from 'three';
import {
  EntityAction,
  ACTION_DURATION_MS,
  createAnimState,
  stepAnimation,
  type AnimationClip,
  type AnimState,
} from '@nj/game-core';
import { createMeshCharacter, type MeshCharacter } from './creature/mesh-character';
import { MOVE_THRESHOLD, MOVE_COAST_MS } from './player-avatar';
import {
  createWeaponVisualState,
  syncWeaponVisual,
  type WeaponVisualState,
} from './creature/weapon-visual';

const DEFAULT_CHARACTER = 'Rogue';
const MODEL_SCALE = 1;
const FEET_OFFSET_Y = 0.9;

export interface RemotePlayerAvatarSync {
  x: number;
  y: number;
  z: number;
  action?: EntityAction;
  actionSeq?: number;
  equippedWeaponItemId?: number;
}

export interface RemotePlayerAvatar {
  group: THREE.Group;
  sync: (p: RemotePlayerAvatarSync, nowMs?: number) => void;
  update: (dt: number, nowMs?: number) => AnimationClip;
  ready: Promise<void>;
}

function yawFromDirection(dx: number, dz: number): number {
  return Math.atan2(dx, dz);
}

export interface RemotePlayerAvatarOptions {
  character?: string;
  mesh?: MeshCharacter;
}

export function createRemotePlayerAvatar(
  options: RemotePlayerAvatarOptions = {}
): RemotePlayerAvatar {
  const group = new THREE.Group();
  group.name = 'remote-player-avatar';

  const mesh =
    options.mesh ??
    createMeshCharacter(`/models/characters/${options.character ?? DEFAULT_CHARACTER}.glb`, {
      scale: MODEL_SCALE,
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
  const weaponState: WeaponVisualState = createWeaponVisualState();

  const sync = (p: RemotePlayerAvatarSync, nowMs = performance.now()): void => {
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

    const weaponId = p.equippedWeaponItemId ?? 0;
    syncWeaponVisual(mesh.object, weaponId, weaponState);

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

    mesh.play(clip);
    mesh.update(dt);
    group.rotation.y = lastYaw;
    return clip;
  };

  return { group, sync, update, ready };
}

export { MOVE_THRESHOLD, MOVE_COAST_MS, ACTION_DURATION_MS };
