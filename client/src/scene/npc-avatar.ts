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
import type { NpcEntry } from './creature/npc-manifest';

export interface NpcAvatarSync {
  x: number;
  y: number;
  z: number;
}

export interface NpcAvatar {
  group: THREE.Group;
  sync: (p: NpcAvatarSync) => void;
  update: (dt: number, nowMs?: number) => AnimationClip;
  triggerGreet: (
    faceToward: { x: number; z: number },
    uiEpoch: number,
    nowMs?: number
  ) => void;
  ready: Promise<void>;
}

function yawFromDirection(dx: number, dz: number): number {
  return Math.atan2(dx, dz);
}

export function createNpcAvatar(entry: NpcEntry, mesh?: MeshCharacter): NpcAvatar {
  const group = new THREE.Group();
  group.name = 'npc-avatar';

  const character =
    mesh ??
    createMeshCharacter(entry.model, {
      clipMap: entry.clipMap,
      scale: entry.scale,
    });
  group.add(character.object);
  const ready = character.ready.catch(() => undefined);

  let animState: AnimState = createAnimState();
  let greetUntilMs = Number.NEGATIVE_INFINITY;
  let greetSeq = 0;
  let lastGreetUiEpoch = -1;
  let lastYaw = 0;
  let meshReady = Boolean(mesh);

  if (!mesh) {
    character.ready
      .then(() => {
        meshReady = true;
      })
      .catch(() => undefined);
  }

  const sync = (p: NpcAvatarSync): void => {
    group.position.set(p.x, p.y - entry.feetOffsetY, p.z);
  };

  const triggerGreet = (
    faceToward: { x: number; z: number },
    uiEpoch: number,
    nowMs = performance.now()
  ): void => {
    if (!meshReady) return;
    if (uiEpoch === lastGreetUiEpoch) return;
    if (nowMs < greetUntilMs) return;

    lastGreetUiEpoch = uiEpoch;
    greetUntilMs = nowMs + ACTION_DURATION_MS[EntityAction.Cast];
    greetSeq += 1;
    lastYaw = yawFromDirection(
      faceToward.x - group.position.x,
      faceToward.z - group.position.z
    );
  };

  const update = (dt: number, nowMs = performance.now()): AnimationClip => {
    const inGreet = nowMs < greetUntilMs;
    const action = inGreet ? EntityAction.Cast : EntityAction.None;
    const actionSeq = inGreet ? greetSeq : 0;
    const stepped = stepAnimation(animState, {
      action,
      actionSeq,
      locomotion: 'idle',
      nowMs,
    });
    animState = stepped.state;
    const clip = stepped.clip;

    character.play(clip);
    character.update(dt);
    group.rotation.y = lastYaw;
    return clip;
  };

  return { group, sync, update, triggerGreet, ready };
}
