import * as THREE from 'three';
import { generateTerrain, createTerrainMesh } from './terrain';
import { buildVillage, type SceneObjectSpec } from './village';
import { scatterProps } from './scatter';
import { type MovementIntent, TERRAIN_CONFIG } from '@nj/game-core';
import { buildPathPreviewPoints } from './path-preview';
import { applyTo, DEFAULT_CAMERA_OFFSET } from '../camera/follow-camera';
import { ndcFromPointer, toMovementIntent, type RaycastInput } from '../input/click-to-move';
import { getGameState, setPlayer, setTarget, setMobs, setOthers } from '../test-hook';
import { createVfxManager, type VfxManager } from './vfx/vfx-manager';
import { EntityAction } from '@nj/game-core';
import {
  listRemotePlayers,
  removeRemotePlayer,
  tickRemotePlayers,
  upsertRemotePlayer,
  type RemotePlayerMap,
  type OtherPlayerHookEntry,
} from './remote-players';
import type { RemotePlayerAvatarSync } from './remote-player-avatar';
import {
  createMobInstanceMap,
  faceHpBarsToCamera,
  flushPendingMobRemovals,
  listMobMeshes,
  mobStateToVisual,
  removeMob,
  syncMobVisual,
  tickMobVisuals,
  type MobMeshMap,
} from './mobs';
import {
  npcStateToVisual,
  removeNpc,
  syncNpcVisual,
  tickNpcVisuals,
  triggerNpcGreet,
  createNpcInstanceMap,
  getNpcHookEntries,
  type NpcMeshMap,
} from './npc-renderer';
import { createPlayerAvatar } from './player-avatar';
import type { AnimationClip } from '@nj/game-core';
import { EntityAction } from '@nj/game-core';

const WORLD_SEED = TERRAIN_CONFIG.seed;
const TERRAIN_OPTS = TERRAIN_CONFIG;

export interface GameRenderer {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  terrainMesh: THREE.Mesh;
  tick: (dt: number) => void;
  render: () => void;
  handleClick: (ev: RaycastInput) => void;
  syncLocalPlayer: (
    x: number,
    y: number,
    z: number,
    action?: number,
    actionSeq?: number,
    equippedWeaponItemId?: number
  ) => void;
  getCurrentAnimationClip: () => AnimationClip;
  syncRemotePlayer: (sessionId: string, sync: RemotePlayerAvatarSync) => void;
  listRemotePlayers: () => OtherPlayerHookEntry[];
  removeRemotePlayer: (sessionId: string) => void;
  syncMob: (mob: {
    id: string;
    npcId: number;
    x: number;
    y: number;
    z: number;
    hp: number;
    maxHp: number;
    action?: number;
    actionSeq?: number;
  }) => void;
  removeMob: (mobId: string) => void;
  getMobHookEntries: () => Array<{
    id: string;
    npcId: number;
    x: number;
    y: number;
    z: number;
    hp: number;
    maxHp: number;
    action: AnimationClip;
  }>;
  syncNpc: (npc: {
    id: string;
    npcId: number;
    type: string;
    x: number;
    y: number;
    z: number;
  }) => void;
  removeNpc: (npcKey: string) => void;
  triggerNpcGreet: (npcId: number, playerPos: { x: number; z: number }, uiEpoch: number) => void;
  getNpcHookEntries: () => Array<{
    npcKey: string;
    npcId: number;
    renderKind: 'mesh' | 'capsule';
    action: AnimationClip;
  }>;
  setMoveIntentHandler: (handler: (intent: MovementIntent) => void) => void;
  setMobTargetHandler: (handler: (mobId: string) => void) => void;
  setVfxTargetMobId: (mobId: string | null) => void;
  syncPlayerVfx: (snapshot: {
    hp: number;
    level: number;
    action: number;
    actionSeq: number;
    x: number;
    y: number;
    z: number;
    soulshotCount?: number;
  }) => void;
  syncMobVfx: (snapshot: {
    id: string;
    hp: number;
    x: number;
    y: number;
    z: number;
    action: number;
    actionSeq: number;
  }) => void;
  setAfterTick: (handler: (() => void) | null) => void;
  dispose: () => void;
}

function findMobId(object: THREE.Object3D): string | null {
  let current: THREE.Object3D | null = object;
  while (current) {
    const mobId = current.userData['mobId'];
    if (typeof mobId === 'string' && mobId.length > 0) return mobId;
    current = current.parent;
  }
  return null;
}

function addBox(spec: SceneObjectSpec): THREE.Mesh {
  const geometry = new THREE.BoxGeometry(spec.width, spec.height, spec.depth);
  const material = new THREE.MeshLambertMaterial({
    color: spec.color,
    flatShading: true,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(spec.x, spec.y, spec.z);
  return mesh;
}

function addTree(x: number, y: number, z: number, scale: number): THREE.Group {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2 * scale, 0.3 * scale, 2 * scale, 6),
    new THREE.MeshLambertMaterial({ color: 0x5c4033, flatShading: true })
  );
  trunk.position.y = y + scale;
  const foliage = new THREE.Mesh(
    new THREE.ConeGeometry(1 * scale, 2.5 * scale, 6),
    new THREE.MeshLambertMaterial({ color: 0x228b22, flatShading: true })
  );
  foliage.position.y = y + 2.2 * scale;
  group.add(trunk, foliage);
  group.position.set(x, 0, z);
  return group;
}

function addRock(x: number, y: number, z: number, scale: number): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.DodecahedronGeometry(0.8 * scale, 0),
    new THREE.MeshLambertMaterial({ color: 0x808080, flatShading: true })
  );
  mesh.position.set(x, y + 0.4 * scale, z);
  return mesh;
}

export function createRenderer(canvas: HTMLCanvasElement): GameRenderer {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb);

  const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );

  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const sun = new THREE.DirectionalLight(0xffffff, 0.85);
  sun.position.set(30, 50, 20);
  scene.add(sun);

  const terrainData = generateTerrain(WORLD_SEED, TERRAIN_OPTS);
  const terrainMesh = createTerrainMesh(THREE, terrainData);
  scene.add(terrainMesh);

  for (const spec of buildVillage({ seed: WORLD_SEED, sampleHeight: terrainData.sampleHeight })) {
    scene.add(addBox(spec));
  }

  for (const prop of scatterProps(WORLD_SEED, terrainData, {
    count: 80,
    fieldMin: -90,
    fieldMax: 90,
    villageRadius: 25,
  })) {
    scene.add(
      prop.kind === 'tree'
        ? addTree(prop.x, prop.y, prop.z, prop.scale)
        : addRock(prop.x, prop.y, prop.z, prop.scale)
    );
  }

  const playerAvatar = createPlayerAvatar();
  scene.add(playerAvatar.group);
  const vfxManager: VfxManager = createVfxManager(scene);

  const localPosition = { x: 0, y: terrainData.sampleHeight(0, 0) + 1, z: 0 };
  let currentAnimationClip: AnimationClip = 'idle';
  let moveIntentHandler: ((intent: MovementIntent) => void) | null = null;
  let mobTargetHandler: ((mobId: string) => void) | null = null;
  let afterTickHandler: (() => void) | null = null;
  const remotePlayers: RemotePlayerMap = new Map();
  const mobMeshes: MobMeshMap = new Map();
  const mobInstances = createMobInstanceMap();
  const mobSnapshots = new Map<string, ReturnType<typeof mobStateToVisual>>();
  let lastMobClips = new Map<string, AnimationClip>();
  const npcMeshes: NpcMeshMap = new Map();
  const npcInstances = createNpcInstanceMap();
  const npcSnapshots = new Map<string, ReturnType<typeof npcStateToVisual>>();
  let prevPlayerActionSeq = 0;
  let prevPlayerDieSeq = -1;

  const raycaster = new THREE.Raycaster();

  const clearPathPreview = (): void => {
    if (pathPreviewLine) {
      scene.remove(pathPreviewLine);
      pathPreviewLine.geometry.dispose();
      (pathPreviewLine.material as THREE.Material).dispose();
      pathPreviewLine = null;
    }
  };

  const showPathPreview = (fromX: number, fromZ: number, toX: number, toZ: number): void => {
    clearPathPreview();
    const points = buildPathPreviewPoints(fromX, fromZ, toX, toZ);
    if (points.length < 2) return;
    const vectors = points.map(
      (p) => new THREE.Vector3(p.x, terrainData.sampleHeight(p.x, p.z) + 0.15, p.z)
    );
    const geometry = new THREE.BufferGeometry().setFromPoints(vectors);
    pathPreviewLine = new THREE.Line(
      geometry,
      new THREE.LineBasicMaterial({ color: 0x00ffcc, transparent: true, opacity: 0.7 })
    );
    scene.add(pathPreviewLine);
  };

  const syncLocalPlayer = (
    x: number,
    y: number,
    z: number,
    action = 0,
    actionSeq = 0,
    equippedWeaponItemId = 0
  ): void => {
    localPosition.x = x;
    localPosition.y = y;
    localPosition.z = z;
    playerAvatar.sync({ x, y, z, action, actionSeq, equippedWeaponItemId });
    currentAnimationClip = playerAvatar.update(0);
    applyTo(
      {
        position: camera.position,
        lookAt: (target) => camera.lookAt(target.x, target.y, target.z),
      },
      { x, y, z },
      DEFAULT_CAMERA_OFFSET
    );
    const player = getGameState().player;
    setPlayer({ ...player, x, y, z, action: currentAnimationClip });
  };

  const setMoveIntentHandler = (handler: (intent: MovementIntent) => void): void => {
    moveIntentHandler = handler;
  };

  const setMobTargetHandler = (handler: (mobId: string) => void): void => {
    mobTargetHandler = handler;
  };

  const setAfterTick = (handler: (() => void) | null): void => {
    afterTickHandler = handler;
  };


  const syncPlayerVfx = (snapshot: {
    hp: number;
    level: number;
    action: number;
    actionSeq: number;
    x: number;
    y: number;
    z: number;
    soulshotCount?: number;
  }): void => {
    vfxManager.syncPlayer({
      hp: snapshot.hp,
      level: snapshot.level,
      action: snapshot.action as EntityAction,
      actionSeq: snapshot.actionSeq,
      x: snapshot.x,
      y: snapshot.y,
      z: snapshot.z,
      soulshotCount: snapshot.soulshotCount,
      weaponRoot: playerAvatar.group,
    });
    if (snapshot.action === EntityAction.Die && snapshot.actionSeq !== prevPlayerDieSeq) {
      vfxManager.attachPlayerDissolve(playerAvatar.group, performance.now());
      prevPlayerDieSeq = snapshot.actionSeq;
    }
    prevPlayerActionSeq = snapshot.actionSeq;
    vfxManager.publishHook(getGameState().vfx);
  };

  const syncMobVfx = (snapshot: {
    id: string;
    hp: number;
    x: number;
    y: number;
    z: number;
    action: number;
    actionSeq: number;
  }): void => {
    vfxManager.syncMob({
      id: snapshot.id,
      hp: snapshot.hp,
      x: snapshot.x,
      y: snapshot.y,
      z: snapshot.z,
      action: snapshot.action as EntityAction,
      actionSeq: snapshot.actionSeq,
    });
    vfxManager.publishHook(getGameState().vfx);
  };

  const setVfxTargetMobId = (mobId: string | null): void => {
    const snapshots = new Map(
      [...mobSnapshots.entries()].map(([id, snap]) => [
        id,
        {
          id,
          hp: snap.hp,
          x: snap.x,
          y: snap.y,
          z: snap.z,
          action: (snap.action ?? EntityAction.None) as EntityAction,
          actionSeq: snap.actionSeq ?? 0,
        },
      ])
    );
    vfxManager.setTargetMobId(mobId, snapshots);
    vfxManager.publishHook(getGameState().vfx);
  };

  let pathPreviewLine: THREE.Line | null = null;

  const syncRemotePlayer = (sessionId: string, sync: RemotePlayerAvatarSync): void => {
    upsertRemotePlayer(remotePlayers, sessionId, sync, scene);
  };

  const removeRemotePlayerById = (sessionId: string): void => {
    removeRemotePlayer(remotePlayers, sessionId, scene);
  };

  const listRemotePlayersForHook = (): OtherPlayerHookEntry[] => listRemotePlayers(remotePlayers);

  const syncMob = (mob: {
    id: string;
    npcId: number;
    x: number;
    y: number;
    z: number;
    hp: number;
    maxHp: number;
    action?: number;
    actionSeq?: number;
  }): void => {
    const visual = mobStateToVisual(mob);
    mobSnapshots.set(mob.id, visual);
    syncMobVisual(mobMeshes, mobInstances, visual, scene);
  };

  const hookClipForSnapshot = (
    id: string,
    snapshot: ReturnType<typeof mobStateToVisual>
  ): AnimationClip => {
    const tickClip = lastMobClips.get(id);
    if (tickClip) return tickClip;
    switch (snapshot.action) {
      case EntityAction.Attack:
        return 'attack';
      case EntityAction.Cast:
        return 'cast';
      case EntityAction.Die:
        return 'die';
      default:
        return 'idle';
    }
  };

  const getMobHookEntries = (): Array<{
    id: string;
    npcId: number;
    x: number;
    y: number;
    z: number;
    hp: number;
    maxHp: number;
    action: AnimationClip;
  }> => {
    return [...mobSnapshots.entries()].map(([id, snapshot]) => ({
      id,
      npcId: snapshot.npcId,
      x: snapshot.x,
      y: snapshot.y,
      z: snapshot.z,
      hp: snapshot.hp,
      maxHp: snapshot.maxHp,
      action: hookClipForSnapshot(id, snapshot),
    }));
  };

  const removeMobById = (mobId: string): void => {
    const group = mobMeshes.get(mobId);
    if (group) {
      vfxManager.attachMobDissolve(mobId, group, performance.now());
    }
    const removed = removeMob(mobMeshes, mobInstances, mobId, scene);
    if (removed) {
      mobSnapshots.delete(mobId);
    }
  };

  const syncNpc = (npc: {
    id: string;
    npcId: number;
    type: string;
    x: number;
    y: number;
    z: number;
  }): void => {
    const visual = npcStateToVisual(npc);
    npcSnapshots.set(npc.id, visual);
    syncNpcVisual(npcMeshes, npcInstances, visual, scene);
  };

  const removeNpcById = (npcKey: string): void => {
    removeNpc(npcMeshes, npcInstances, npcKey, scene);
    npcSnapshots.delete(npcKey);
  };

  const triggerNpcGreetById = (
    npcId: number,
    playerPos: { x: number; z: number },
    uiEpoch: number
  ): void => {
    triggerNpcGreet(npcInstances, npcId, playerPos, uiEpoch, performance.now());
  };

  const getNpcHookEntriesForRoom = () => getNpcHookEntries(npcInstances, npcSnapshots);

  const tick = (dt: number): void => {
    const nowMs = performance.now();
    currentAnimationClip = playerAvatar.update(dt);
    const player = getGameState().player;
    if (player.action !== currentAnimationClip) {
      setPlayer({ ...player, action: currentAnimationClip });
    }

    const mobClips = tickMobVisuals(mobInstances, dt, nowMs);
    lastMobClips = mobClips;
    for (const mobId of flushPendingMobRemovals(mobMeshes, mobInstances, scene, nowMs)) {
      mobSnapshots.delete(mobId);
    }

    if (mobSnapshots.size > 0) {
      setMobs(
        [...mobSnapshots.entries()].map(([id, snapshot]) => ({
          id,
          npcId: snapshot.npcId,
          x: snapshot.x,
          y: snapshot.y,
          z: snapshot.z,
          hp: snapshot.hp,
          maxHp: snapshot.maxHp,
          action: (mobClips.get(id) ?? 'idle') as AnimationClip,
        }))
      );
    }

    faceHpBarsToCamera(mobMeshes, camera);

    tickRemotePlayers(remotePlayers, dt, nowMs);
    if (remotePlayers.size > 0) {
      setOthers(listRemotePlayersForHook());
    }

    tickNpcVisuals(npcInstances, dt, nowMs);
    vfxManager.tick(nowMs);
    vfxManager.publishHook(getGameState().vfx);
    afterTickHandler?.();
  };

  const getCurrentAnimationClip = (): AnimationClip => currentAnimationClip;

  const render = (): void => {
    renderer.render(scene, camera);
  };

  const handleClick = (ev: RaycastInput): void => {
    terrainMesh.updateMatrixWorld(true);
    const rect = canvas.getBoundingClientRect();
    const ndc = ndcFromPointer(
      { clientX: ev.clientX, clientY: ev.clientY },
      rect.width,
      rect.height,
      rect.left,
      rect.top
    );
    raycaster.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), camera);

    const mobGroups = listMobMeshes(mobMeshes);
    if (mobGroups.length > 0) {
      for (const group of mobGroups) {
        group.updateMatrixWorld(true);
      }
      const mobHits = raycaster.intersectObjects(mobGroups, true);
      if (mobHits.length > 0) {
        const mobId = findMobId(mobHits[0].object);
        if (mobId) {
          mobTargetHandler?.(mobId);
          return;
        }
      }
    }

    let hits = raycaster.intersectObject(terrainMesh, false);

    if (hits.length === 0) {
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -localPosition.y);
      const fallback = new THREE.Vector3();
      if (raycaster.ray.intersectPlane(plane, fallback)) {
        hits = [{ point: fallback } as THREE.Intersection];
      }
    }

    const intent = toMovementIntent(
      hits.length > 0 ? { x: hits[0].point.x, z: hits[0].point.z } : null
    );
    if (intent) {
      clearPathPreview();
      showPathPreview(localPosition.x, localPosition.z, intent.targetX, intent.targetZ);
      setTarget(intent.targetX, intent.targetZ);
      moveIntentHandler?.(intent);
    } else {
      clearPathPreview();
      setTarget(null, null);
    }
  };

  const dispose = (): void => {
    clearPathPreview();
    vfxManager.dispose();
    renderer.dispose();
  };

  syncLocalPlayer(localPosition.x, localPosition.y, localPosition.z);

  return {
    scene,
    camera,
    renderer,
    terrainMesh,
    tick,
    render,
    handleClick,
    syncLocalPlayer,
    getCurrentAnimationClip,
    syncRemotePlayer,
    listRemotePlayers: listRemotePlayersForHook,
    removeRemotePlayer: removeRemotePlayerById,
    syncMob,
    removeMob: removeMobById,
    getMobHookEntries,
    syncNpc,
    removeNpc: removeNpcById,
    triggerNpcGreet: triggerNpcGreetById,
    getNpcHookEntries: getNpcHookEntriesForRoom,
    setMoveIntentHandler,
    setMobTargetHandler,
    setVfxTargetMobId,
    syncPlayerVfx,
    syncMobVfx,
    setAfterTick,
    dispose,
  };
}

export function startRenderLoop(game: GameRenderer): () => void {
  let last = performance.now();
  let frameId = 0;

  const loop = (now: number): void => {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    game.tick(dt);
    game.render();
    frameId = requestAnimationFrame(loop);
  };

  frameId = requestAnimationFrame(loop);
  return () => cancelAnimationFrame(frameId);
}
