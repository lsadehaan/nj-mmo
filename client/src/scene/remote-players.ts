import * as THREE from 'three';
import type { AnimationClip } from '@nj/game-core';
import {
  createRemotePlayerAvatar,
  type RemotePlayerAvatar,
  type RemotePlayerAvatarSync,
} from './remote-player-avatar';

export interface OtherPlayerHookEntry {
  id: string;
  x: number;
  y: number;
  z: number;
  renderKind: 'mesh';
  action: AnimationClip;
  equippedWeaponId: number | null;
}

export type RemotePlayerMap = Map<string, RemotePlayerInstance>;

export interface RemotePlayerInstance {
  group: THREE.Group;
  avatar: RemotePlayerAvatar;
  lastClip: AnimationClip;
  equippedWeaponItemId: number;
  classId: number;
  sex: number;
}

function disposeRemoteInstance(instance: RemotePlayerInstance, scene: THREE.Scene): void {
  scene.remove(instance.group);
  disposeObject3D(instance.group);
}

export function upsertRemotePlayer(
  map: RemotePlayerMap,
  sessionId: string,
  sync: RemotePlayerAvatarSync,
  scene: THREE.Scene
): RemotePlayerInstance {
  const classId = sync.classId ?? 0;
  const sex = sync.sex ?? 0;
  let instance = map.get(sessionId);
  if (instance && (instance.classId !== classId || instance.sex !== sex)) {
    disposeRemoteInstance(instance, scene);
    map.delete(sessionId);
    instance = undefined;
  }

  if (!instance) {
    const avatar = createRemotePlayerAvatar({ classId, sex });
    instance = {
      group: avatar.group,
      avatar,
      lastClip: 'idle',
      equippedWeaponItemId: 0,
      classId,
      sex,
    };
    scene.add(avatar.group);
    map.set(sessionId, instance);
  }

  instance.avatar.sync(sync);
  instance.equippedWeaponItemId = sync.equippedWeaponItemId ?? 0;
  return instance;
}

function disposeObject3D(root: THREE.Object3D): void {
  root.traverse((node) => {
    if (node instanceof THREE.Mesh) {
      node.geometry?.dispose();
      const { material } = node;
      if (Array.isArray(material)) {
        material.forEach((m) => m.dispose());
      } else {
        material?.dispose();
      }
    }
  });
}

export function removeRemotePlayer(
  map: RemotePlayerMap,
  sessionId: string,
  scene: THREE.Scene
): void {
  const instance = map.get(sessionId);
  if (!instance) return;
  disposeRemoteInstance(instance, scene);
  map.delete(sessionId);
}

export function tickRemotePlayers(
  map: RemotePlayerMap,
  dt: number,
  nowMs = performance.now()
): Map<string, AnimationClip> {
  const clips = new Map<string, AnimationClip>();
  for (const [sessionId, instance] of map.entries()) {
    instance.lastClip = instance.avatar.update(dt, nowMs);
    clips.set(sessionId, instance.lastClip);
  }
  return clips;
}

export function listRemotePlayers(map: RemotePlayerMap): OtherPlayerHookEntry[] {
  return [...map.entries()].map(([id, instance]) => ({
    id,
    x: instance.group.position.x,
    y: instance.group.position.y + 0.9,
    z: instance.group.position.z,
    renderKind: 'mesh' as const,
    action: instance.lastClip,
    equippedWeaponId:
      instance.equippedWeaponItemId > 0 ? instance.equippedWeaponItemId : null,
  }));
}

export function usesCapsuleGeometry(group: THREE.Group): boolean {
  let found = false;
  group.traverse((node) => {
    if (node instanceof THREE.Mesh && node.geometry instanceof THREE.CapsuleGeometry) {
      found = true;
    }
  });
  return found;
}
