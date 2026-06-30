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
import { getPlayerManifestEntry } from './creature/player-manifest';
import { createNameplate, type Nameplate } from './nameplate';
import { MOVE_THRESHOLD, MOVE_COAST_MS } from './player-avatar';
import {
  createWeaponVisualState,
  syncWeaponVisual,
  type WeaponVisualState,
} from './creature/weapon-visual';

export interface RemotePlayerAvatarSync {
  x: number;
  y: number;
  z: number;
  action?: EntityAction;
  actionSeq?: number;
  equippedWeaponItemId?: number;
  classId?: number;
  sex?: number;
  name?: string;
}

export interface RemotePlayerAvatar {
  group: THREE.Group;
  sync: (p: RemotePlayerAvatarSync, nowMs?: number) => void;
  update: (dt: number, nowMs?: number) => AnimationClip;
  setName: (name: string) => void;
  ready: Promise<void>;
}

function yawFromDirection(dx: number, dz: number): number {
  return Math.atan2(dx, dz);
}

export interface RemotePlayerAvatarOptions {
  classId?: number;
  sex?: number;
  mesh?: MeshCharacter;
}

export function createRemotePlayerAvatar(
  options: RemotePlayerAvatarOptions = {}
): RemotePlayerAvatar {
  const group = new THREE.Group();
  group.name = 'remote-player-avatar';

  const classId = options.classId ?? 0;
  const entry = getPlayerManifestEntry(classId);
  const sexScale = options.sex === 1 ? 0.97 : 1.0;
  const feetOffsetY = entry.feetOffsetY;

  const mesh =
    options.mesh ??
    createMeshCharacter(entry.model, {
      scale: entry.scale * sexScale,
      clipMap: entry.clipMap,
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

  let nameplate: Nameplate | null = null;
  const setName = (name: string): void => {
    const trimmed = (name ?? '').trim();
    if (!trimmed) return;
    if (!nameplate) {
      nameplate = createNameplate(trimmed);
      group.add(nameplate.sprite);
    } else {
      nameplate.setText(trimmed);
    }
  };

  const sync = (p: RemotePlayerAvatarSync, nowMs = performance.now()): void => {
    if (p.name) setName(p.name);
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

    group.position.set(p.x, p.y - feetOffsetY, p.z);
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

  return { group, sync, update, setName, ready };
}

export { MOVE_THRESHOLD, MOVE_COAST_MS, ACTION_DURATION_MS };
