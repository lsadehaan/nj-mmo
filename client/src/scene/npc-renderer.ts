import * as THREE from 'three';
import type { AnimationClip } from '@nj/game-core';
import { getNpcEntry } from './creature/npc-manifest';
import { createNpcAvatar, type NpcAvatar } from './npc-avatar';

export type NpcVisualRole = 'Merchant' | 'Helper';

export interface NpcVisualState {
  id: string;
  npcId: number;
  role: NpcVisualRole;
  x: number;
  y: number;
  z: number;
}

export type NpcMeshMap = Map<string, THREE.Group>;

const MERCHANT_BODY_COLOR = 0xcc8844;
const HELPER_BODY_COLOR = 0x44aa66;

export interface NpcInstance {
  group: THREE.Group;
  avatar: NpcAvatar | null;
  usesCapsule: boolean;
  npcId: number;
  currentClip: AnimationClip;
}

export function npcRoleFromType(type: string, npcId: number): NpcVisualRole {
  if (type === 'Merchant' || npcId === 30004) return 'Merchant';
  return 'Helper';
}

export function npcStateToVisual(state: {
  id: string;
  npcId: number;
  type: string;
  x: number;
  y: number;
  z: number;
}): NpcVisualState {
  return {
    id: state.id,
    npcId: state.npcId,
    role: npcRoleFromType(state.type, state.npcId),
    x: state.x,
    y: state.y,
    z: state.z,
  };
}

export function buildNpcMesh(role: NpcVisualRole): THREE.Group {
  const group = new THREE.Group();
  const bodyColor = role === 'Merchant' ? MERCHANT_BODY_COLOR : HELPER_BODY_COLOR;

  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.35, 0.9, 4, 8),
    new THREE.MeshLambertMaterial({ color: bodyColor, flatShading: true })
  );
  body.name = 'body';
  group.add(body);

  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.35, 0.35, 0.35),
    new THREE.MeshLambertMaterial({ color: 0xffddbb, flatShading: true })
  );
  head.position.y = 0.85;
  head.name = 'head';
  group.add(head);

  group.userData.renderKind = 'capsule';
  return group;
}

function removeCapsuleParts(group: THREE.Group): void {
  const body = group.getObjectByName('body');
  const head = group.getObjectByName('head');
  if (body) group.remove(body);
  if (head) group.remove(head);
}

function ensureNpcInstance(
  map: NpcMeshMap,
  instances: Map<string, NpcInstance>,
  state: NpcVisualState,
  scene: THREE.Scene
): NpcInstance {
  let instance = instances.get(state.id);
  if (instance) return instance;

  const entry = getNpcEntry(state.npcId);
  let group = map.get(state.id);
  if (!group) {
    group = entry ? new THREE.Group() : buildNpcMesh(state.role);
    group.userData.npcKey = state.id;
    scene.add(group);
    map.set(state.id, group);
  }

  instance = {
    group,
    avatar: null,
    usesCapsule: !entry,
    npcId: state.npcId,
    currentClip: 'idle',
  };
  instances.set(state.id, instance);

  if (entry && !instance.avatar) {
    const avatar = createNpcAvatar(entry);
    removeCapsuleParts(group);
    group.add(avatar.group);
    group.userData.renderKind = 'mesh';
    instance.avatar = avatar;
    instance.usesCapsule = false;
    avatar.ready.catch(() => {
      if (!instances.has(state.id)) return;
      const live = instances.get(state.id);
      if (!live || live.avatar !== avatar) return;
      live.avatar = null;
      live.usesCapsule = true;
      group.remove(avatar.group);
      const fallback = buildNpcMesh(state.role);
      for (const child of fallback.children) {
        group.add(child.clone());
      }
      group.userData.renderKind = 'capsule';
    });
  }

  return instance;
}

export function applyNpcVisual(instance: NpcInstance, state: NpcVisualState): void {
  instance.npcId = state.npcId;
  instance.group.userData.npcId = state.npcId;

  if (instance.avatar) {
    instance.avatar.sync({ x: state.x, y: state.y, z: state.z });
  } else {
    instance.group.position.set(state.x, state.y, state.z);
  }
}

export function syncNpcVisual(
  map: NpcMeshMap,
  instances: Map<string, NpcInstance>,
  state: NpcVisualState,
  scene: THREE.Scene
): THREE.Group {
  const instance = ensureNpcInstance(map, instances, state, scene);
  applyNpcVisual(instance, state);
  return instance.group;
}

export function tickNpcVisuals(
  instances: Map<string, NpcInstance>,
  dt: number,
  nowMs = performance.now()
): Map<string, AnimationClip> {
  const clips = new Map<string, AnimationClip>();
  for (const [npcKey, instance] of instances.entries()) {
    if (instance.avatar) {
      instance.currentClip = instance.avatar.update(dt, nowMs);
    }
    clips.set(npcKey, instance.currentClip);
  }
  return clips;
}

export function triggerNpcGreet(
  instances: Map<string, NpcInstance>,
  npcId: number,
  playerPos: { x: number; z: number },
  uiEpoch: number,
  nowMs = performance.now()
): void {
  for (const instance of instances.values()) {
    if (instance.npcId !== npcId || !instance.avatar) continue;
    instance.avatar.triggerGreet(playerPos, uiEpoch, nowMs);
    break;
  }
}

export function removeNpc(
  map: NpcMeshMap,
  instances: Map<string, NpcInstance>,
  npcKey: string,
  scene: THREE.Scene
): void {
  const group = map.get(npcKey);
  if (!group) return;
  scene.remove(group);
  map.delete(npcKey);
  instances.delete(npcKey);
}

export function createNpcInstanceMap(): Map<string, NpcInstance> {
  return new Map();
}

export function getNpcHookEntries(
  instances: Map<string, NpcInstance>,
  snapshots: Map<string, NpcVisualState>
): Array<{
  npcKey: string;
  npcId: number;
  renderKind: 'mesh' | 'capsule';
  action: AnimationClip;
}> {
  return [...snapshots.entries()].map(([npcKey, snapshot]) => {
    const instance = instances.get(npcKey);
    return {
      npcKey,
      npcId: snapshot.npcId,
      renderKind: instance?.usesCapsule ? 'capsule' : 'mesh',
      action: instance?.currentClip ?? 'idle',
    };
  });
}
