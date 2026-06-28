import * as THREE from 'three';
import { EntityAction } from '@nj/game-core';
import type { AnimationClip } from '@nj/game-core';
import { getCreatureEntry } from './creature/creature-manifest';
import { loadGltfTemplate } from './creature/mesh-character';
import { createMobAvatar, type MobAvatar } from './mob-avatar';
import { GOBLIN_CLUB_ATTACHMENT } from './creature/weapon-manifest';
import { attachToBone } from './creature/attachment';

export interface MobVisualState {
  id: string;
  npcId: number;
  x: number;
  y: number;
  z: number;
  hp: number;
  maxHp: number;
  action?: EntityAction;
  actionSeq?: number;
}

export type MobMeshMap = Map<string, THREE.Group>;

interface MobInstance {
  group: THREE.Group;
  avatar: MobAvatar | null;
  usesCapsule: boolean;
  hpBarYOffset: number;
  pendingRemovalAtMs: number | null;
  currentClip: string;
  lastAction?: EntityAction;
  lastActionSeq?: number;
  clubProp: THREE.Object3D | null;
}

const MOB_BODY_COLOR = 0x884422;
const HP_BAR_WIDTH = 1.2;
const HP_BAR_HEIGHT = 0.12;
const DEFAULT_HP_BAR_Y_OFFSET = 1.6;

const templateLoads = new Map<string, ReturnType<typeof loadGltfTemplate>>();

function clipFromServerAction(action?: EntityAction): AnimationClip {
  switch (action) {
    case EntityAction.Attack:
      return 'attack';
    case EntityAction.Cast:
      return 'cast';
    case EntityAction.Die:
      return 'die';
    default:
      return 'idle';
  }
}

export function mobStateToVisual(state: {
  id: string;
  npcId: number;
  x: number;
  y: number;
  z: number;
  hp: number;
  maxHp: number;
  action?: EntityAction;
  actionSeq?: number;
}): MobVisualState {
  return {
    id: state.id,
    npcId: state.npcId,
    x: state.x,
    y: state.y,
    z: state.z,
    hp: state.hp,
    maxHp: state.maxHp,
    action: state.action,
    actionSeq: state.actionSeq,
  };
}

export function hpBarFillRatio(hp: number, maxHp: number): number {
  if (maxHp <= 0) return 0;
  return Math.max(0, Math.min(1, hp / maxHp));
}

function createHpBar(yOffset: number): { group: THREE.Group; fill: THREE.Mesh } {
  const group = new THREE.Group();
  group.position.y = yOffset;

  const bg = new THREE.Mesh(
    new THREE.PlaneGeometry(HP_BAR_WIDTH, HP_BAR_HEIGHT),
    new THREE.MeshBasicMaterial({ color: 0x440000, side: THREE.DoubleSide })
  );
  group.add(bg);

  const fill = new THREE.Mesh(
    new THREE.PlaneGeometry(HP_BAR_WIDTH, HP_BAR_HEIGHT),
    new THREE.MeshBasicMaterial({ color: 0x22cc22, side: THREE.DoubleSide })
  );
  fill.position.x = -HP_BAR_WIDTH / 2;
  fill.geometry.translate(HP_BAR_WIDTH / 2, 0, 0);
  group.add(fill);

  return { group, fill };
}

function createCapsuleBody(): THREE.Mesh {
  return new THREE.Mesh(
    new THREE.CapsuleGeometry(0.4, 1, 4, 8),
    new THREE.MeshLambertMaterial({ color: MOB_BODY_COLOR, flatShading: true })
  );
}

export function createMobGroup(mobId: string, hpBarYOffset = DEFAULT_HP_BAR_Y_OFFSET): THREE.Group {
  const group = new THREE.Group();
  group.userData.mobId = mobId;

  const body = createCapsuleBody();
  body.name = 'capsuleBody';
  group.add(body);

  const { group: hpBar, fill } = createHpBar(hpBarYOffset);
  hpBar.name = 'hpBar';
  fill.name = 'hpFill';
  group.add(hpBar);

  return group;
}

function getOrLoadTemplate(model: string) {
  let pending = templateLoads.get(model);
  if (!pending) {
    pending = loadGltfTemplate(model);
    templateLoads.set(model, pending);
  }
  return pending;
}

function hasCapsuleBody(group: THREE.Group): boolean {
  return group.getObjectByName('capsuleBody') !== null;
}

function attachGoblinClub(
  instances: Map<string, MobInstance>,
  mobId: string,
  npcId: number,
  avatar: MobAvatar
): void {
  if (npcId !== 20003) return;

  loadGltfTemplate(GOBLIN_CLUB_ATTACHMENT.model)
    .then((clubTemplate) => {
      if (!instances.has(mobId)) return;
      const live = instances.get(mobId)!;
      if (live.clubProp) return;
      const club = clubTemplate.scene.clone(true);
      club.name = 'goblin-club';
      if (
        attachToBone(
          avatar.group,
          club,
          GOBLIN_CLUB_ATTACHMENT.bone,
          GOBLIN_CLUB_ATTACHMENT.transform
        )
      ) {
        live.clubProp = club;
      }
    })
    .catch(() => undefined);
}

function ensureMobInstance(
  map: MobMeshMap,
  instances: Map<string, MobInstance>,
  state: MobVisualState,
  scene: THREE.Scene
): MobInstance {
  let instance = instances.get(state.id);
  if (instance) return instance;

  const entry = getCreatureEntry(state.npcId);
  const hpBarYOffset = entry?.hpBarYOffset ?? DEFAULT_HP_BAR_Y_OFFSET;
  const group = createMobGroup(state.id, hpBarYOffset);
  scene.add(group);
  map.set(state.id, group);

  instance = {
    group,
    avatar: null,
    usesCapsule: true,
    hpBarYOffset,
    pendingRemovalAtMs: null,
    currentClip: 'idle',
    clubProp: null,
  };
  instances.set(state.id, instance);

  if (entry) {
    getOrLoadTemplate(entry.model)
      .then((template) => {
        if (!instances.has(state.id)) return;
        const current = instances.get(state.id)!;
        if (!hasCapsuleBody(current.group)) return;

        const avatar = createMobAvatar({ entry, template });
        const capsule = current.group.getObjectByName('capsuleBody');
        if (capsule) current.group.remove(capsule);
        current.group.add(avatar.group);
        current.avatar = avatar;
        current.usesCapsule = false;
        attachGoblinClub(instances, state.id, state.npcId, avatar);
      })
      .catch(() => {
        /* keep capsule fallback */
      });
  }

  return instance;
}

export function updateHpBarFill(fill: THREE.Mesh, hp: number, maxHp: number): void {
  const ratio = hpBarFillRatio(hp, maxHp);
  fill.scale.x = ratio;
  fill.visible = ratio > 0;
}

export function applyMobVisual(
  instance: MobInstance,
  state: MobVisualState,
  nowMs = performance.now()
): void {
  const syncPayload = {
    x: state.x,
    y: state.y,
    z: state.z,
    action: state.action,
    actionSeq: state.actionSeq,
  };

  if (instance.avatar) {
    instance.group.position.set(state.x, state.y, state.z);
    instance.avatar.sync(syncPayload, nowMs);
  } else {
    instance.group.position.set(state.x, state.y, state.z);
  }

  const fill = instance.group.getObjectByName('hpFill') as THREE.Mesh | null;
  if (fill) {
    updateHpBarFill(fill, state.hp, state.maxHp);
  }

  if (!instance.avatar) {
    instance.lastAction = state.action;
    instance.lastActionSeq = state.actionSeq;
    if (state.action !== undefined && state.action !== EntityAction.None) {
      instance.currentClip = clipFromServerAction(state.action);
    }
  }
}

export function syncMobVisual(
  map: MobMeshMap,
  instances: Map<string, MobInstance>,
  state: MobVisualState,
  scene: THREE.Scene,
  nowMs = performance.now()
): THREE.Group {
  const instance = ensureMobInstance(map, instances, state, scene);
  applyMobVisual(instance, state, nowMs);
  return instance.group;
}

export function tickMobVisuals(
  instances: Map<string, MobInstance>,
  dt: number,
  nowMs = performance.now()
): Map<string, AnimationClip> {
  const clips = new Map<string, AnimationClip>();
  for (const [mobId, instance] of instances.entries()) {
    if (instance.avatar) {
      instance.currentClip = instance.avatar.update(dt, nowMs);
      clips.set(mobId, instance.currentClip as AnimationClip);
    } else {
      clips.set(mobId, instance.currentClip as AnimationClip);
    }
  }
  return clips;
}

export function removeMob(
  map: MobMeshMap,
  instances: Map<string, MobInstance>,
  mobId: string,
  scene: THREE.Scene,
  nowMs = performance.now()
): boolean {
  const instance = instances.get(mobId);
  if (!instance) return true;

  if (instance.avatar && !instance.avatar.isDiePlaying(nowMs)) {
    instance.avatar.latchDie(nowMs);
  } else if (!instance.avatar) {
    instance.currentClip = 'die';
  }

  if (instance.avatar?.isDiePlaying(nowMs)) {
    instance.pendingRemovalAtMs = nowMs + 1200;
    return false;
  }

  const group = map.get(mobId);
  if (group) {
    scene.remove(group);
    map.delete(mobId);
  }
  instances.delete(mobId);
  return true;
}

export function flushPendingMobRemovals(
  map: MobMeshMap,
  instances: Map<string, MobInstance>,
  scene: THREE.Scene,
  nowMs = performance.now()
): string[] {
  const removed: string[] = [];
  for (const [mobId, instance] of [...instances.entries()]) {
    if (instance.pendingRemovalAtMs === null) continue;
    if (nowMs < instance.pendingRemovalAtMs) continue;
    if (instance.avatar?.isDiePlaying(nowMs)) continue;

    const group = map.get(mobId);
    if (group) {
      scene.remove(group);
      map.delete(mobId);
    }
    instances.delete(mobId);
    removed.push(mobId);
  }
  return removed;
}

export function listMobMeshes(map: MobMeshMap): THREE.Group[] {
  return [...map.values()];
}

export function faceHpBarsToCamera(map: MobMeshMap, camera: THREE.Camera): void {
  for (const group of map.values()) {
    const hpBar = group.getObjectByName('hpBar');
    if (hpBar) {
      hpBar.quaternion.copy(camera.quaternion);
    }
  }
}

export function createMobInstanceMap(): Map<string, MobInstance> {
  return new Map();
}

export function mobUsesCapsule(instances: Map<string, MobInstance>, mobId: string): boolean {
  return instances.get(mobId)?.usesCapsule ?? true;
}

export function getMobHpBarYOffset(instances: Map<string, MobInstance>, mobId: string): number {
  return instances.get(mobId)?.hpBarYOffset ?? DEFAULT_HP_BAR_Y_OFFSET;
}

/** @internal test helper */
export function attachGoblinClubForTest(
  instances: Map<string, MobInstance>,
  mobId: string,
  npcId: number,
  avatar: MobAvatar
): void {
  attachGoblinClub(instances, mobId, npcId, avatar);
}

/** @internal test helper */
export function clearMobTemplateLoadsForTest(): void {
  templateLoads.clear();
}

/** @internal test helper */
export function _getMobInstancesForTest(
  instances: Map<string, MobInstance>
): Map<string, MobInstance> {
  return instances;
}
