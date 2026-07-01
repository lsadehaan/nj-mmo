import * as THREE from 'three';
import { generateTerrain, createTerrainMesh } from './terrain';
import { type MovementIntent, TERRAIN_CONFIG, MOB_RENDER_DISTANCE } from '@nj/game-core';
import { buildPathPreviewPoints } from './path-preview';
import { applyTo, DEFAULT_CAMERA_OFFSET } from '../camera/follow-camera';
import { ndcFromPointer, toMovementIntent, type RaycastInput } from '../input/click-to-move';
import { getGameState, setPlayer, setTarget, setMobs, setOthers, setEnvironment } from '../test-hook';
import { createVfxManager, type VfxManager } from './vfx/vfx-manager';
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
  detachMobVisual,
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
import { buildEnvironmentScene } from './environment-renderer';
import type { AudioManager } from '../audio/audio-manager';

const WORLD_SEED = TERRAIN_CONFIG.seed;
const TERRAIN_OPTS = TERRAIN_CONFIG;

/** Barely-there world-edge fog: stays fully outside gameplay-relevant range. */
export const FOG_NEAR_M = MOB_RENDER_DISTANCE * 1.5;
export const FOG_FAR_M = MOB_RENDER_DISTANCE * 3;
/** Single directional shadow map covering the local player's immediate surroundings. */
export const SUN_SHADOW_MAP_SIZE = 2048;
export const SUN_SHADOW_FRUSTUM_M = 100;
/** Sun's fixed offset from whatever point it targets (originally the world origin). */
const SUN_OFFSET = { x: 30, y: 50, z: 20 };

function mobDistanceSq(x: number, z: number, playerX: number, playerZ: number): number {
  const dx = x - playerX;
  const dz = z - playerZ;
  return dx * dx + dz * dz;
}

function isMobInRenderRange(x: number, z: number, playerX: number, playerZ: number): boolean {
  return mobDistanceSq(x, z, playerX, playerZ) <= MOB_RENDER_DISTANCE * MOB_RENDER_DISTANCE;
}

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
    equippedWeaponItemId?: number,
    classId?: number,
    sex?: number
  ) => void;
  setLocalPlayerName: (name: string) => void;
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
    actionSeq: number;
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
  rotateCamera: (deltaYaw: number) => void;
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
  setAudioManager: (manager: AudioManager | null) => void;
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

export async function createRenderer(canvas: HTMLCanvasElement): Promise<GameRenderer> {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb);
  scene.fog = new THREE.Fog(0x87ceeb, FOG_NEAR_M, FOG_FAR_M);

  const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    2000
  );

  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const sun = new THREE.DirectionalLight(0xffffff, 0.85);
  sun.position.set(SUN_OFFSET.x, SUN_OFFSET.y, SUN_OFFSET.z);
  sun.castShadow = true;
  sun.shadow.mapSize.set(SUN_SHADOW_MAP_SIZE, SUN_SHADOW_MAP_SIZE);
  sun.shadow.camera.left = -SUN_SHADOW_FRUSTUM_M;
  sun.shadow.camera.right = SUN_SHADOW_FRUSTUM_M;
  sun.shadow.camera.top = SUN_SHADOW_FRUSTUM_M;
  sun.shadow.camera.bottom = -SUN_SHADOW_FRUSTUM_M;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 220;
  sun.shadow.camera.updateProjectionMatrix();
  scene.add(sun);
  scene.add(sun.target);

  const terrainData = generateTerrain(WORLD_SEED, TERRAIN_OPTS);
  const terrainMesh = createTerrainMesh(THREE, terrainData);
  scene.add(terrainMesh);

  void buildEnvironmentScene({ scene, terrainData }).then((envResult) => {
    setEnvironment({ ...envResult, loaded: true });
  });

  let playerAvatar = createPlayerAvatar();
  scene.add(playerAvatar.group);
  let activeClassId = -1;
  let activeSex = -1;
  let localPlayerName = '';

  const ensureLocalAvatar = (classId: number, sex: number): void => {
    if (classId === activeClassId && sex === activeSex) return;
    activeClassId = classId;
    activeSex = sex;
    scene.remove(playerAvatar.group);
    playerAvatar = createPlayerAvatar({ classId, sex });
    // Re-apply the name label after the avatar is rebuilt for a class/sex change.
    if (localPlayerName) playerAvatar.setName(localPlayerName);
    scene.add(playerAvatar.group);
  };

  const setLocalPlayerName = (name: string): void => {
    localPlayerName = (name ?? '').trim();
    if (localPlayerName) playerAvatar.setName(localPlayerName);
  };
  const vfxManager: VfxManager = createVfxManager(scene);
  let audioManager: AudioManager | null = null;

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
    requestAnimationFrame(() => {
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
    });
  };

  let lastCullX = Number.NaN;
  let lastCullZ = Number.NaN;
  const CULL_MOVE_THRESHOLD_SQ = 4;

  let cameraYaw = 0;
  const updateCamera = (): void => {
    applyTo(
      {
        position: camera.position,
        lookAt: (target) => camera.lookAt(target.x, target.y, target.z),
      },
      { x: localPosition.x, y: localPosition.y, z: localPosition.z },
      DEFAULT_CAMERA_OFFSET,
      cameraYaw
    );
  };

  const rotateCamera = (deltaYaw: number): void => {
    cameraYaw = (cameraYaw + deltaYaw) % (Math.PI * 2);
    updateCamera();
  };

  const syncLocalPlayer = (
    x: number,
    y: number,
    z: number,
    action = 0,
    actionSeq = 0,
    equippedWeaponItemId = 0,
    classId = 0,
    sex = 0
  ): void => {
    ensureLocalAvatar(classId, sex);
    localPosition.x = x;
    localPosition.y = y;
    localPosition.z = z;
    playerAvatar.sync({ x, y, z, action, actionSeq, equippedWeaponItemId });
    currentAnimationClip = playerAvatar.update(0);
    const cullDx = x - lastCullX;
    const cullDz = z - lastCullZ;
    if (
      !Number.isFinite(lastCullX) ||
      cullDx * cullDx + cullDz * cullDz >= CULL_MOVE_THRESHOLD_SQ
    ) {
      lastCullX = x;
      lastCullZ = z;
      refreshMobCulling();
      sun.position.set(x + SUN_OFFSET.x, SUN_OFFSET.y, z + SUN_OFFSET.z);
      sun.target.position.set(x, 0, z);
      sun.target.updateMatrixWorld();
    }
    updateCamera();
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

  const setAudioManager = (manager: AudioManager | null): void => {
    audioManager = manager;
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
    audioManager?.syncCombat(mobId);
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

  const clipFromServerAction = (
    snapshot: ReturnType<typeof mobStateToVisual>
  ): AnimationClip | null => {
    switch (snapshot.action) {
      case EntityAction.Attack:
        return 'attack';
      case EntityAction.Cast:
        return 'cast';
      case EntityAction.Die:
        return 'die';
      default:
        return null;
    }
  };

  const hookClipForSnapshot = (
    id: string,
    snapshot: ReturnType<typeof mobStateToVisual>
  ): AnimationClip => {
    const serverClip = clipFromServerAction(snapshot);
    if (serverClip === 'attack' || serverClip === 'die') {
      return serverClip;
    }
    const tickClip = lastMobClips.get(id);
    if (tickClip === 'attack' || tickClip === 'cast' || tickClip === 'die') {
      return tickClip;
    }
    if (serverClip) return serverClip;
    return tickClip ?? 'idle';
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
    actionSeq: number;
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
      actionSeq: snapshot.actionSeq ?? 0,
    }));
  };

  const publishMobHookEntries = (): void => {
    if (mobSnapshots.size > 0) {
      setMobs(getMobHookEntries());
    }
  };

  const refreshMobCulling = (): void => {
    const px = localPosition.x;
    const pz = localPosition.z;
    for (const [id, snapshot] of mobSnapshots) {
      const inRange = isMobInRenderRange(snapshot.x, snapshot.z, px, pz);
      const hasMesh = mobMeshes.has(id);
      if (inRange && !hasMesh) {
        syncMobVisual(mobMeshes, mobInstances, snapshot, scene);
      } else if (!inRange && hasMesh) {
        detachMobVisual(mobMeshes, mobInstances, id, scene);
      }
    }
  };

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
    const prev = mobSnapshots.get(mob.id);
    const visual = mobStateToVisual(mob);
    mobSnapshots.set(mob.id, visual);
    if (isMobInRenderRange(visual.x, visual.z, localPosition.x, localPosition.z)) {
      syncMobVisual(mobMeshes, mobInstances, visual, scene);
    } else if (mobMeshes.has(mob.id)) {
      detachMobVisual(mobMeshes, mobInstances, mob.id, scene);
    }
    if (
      prev?.action !== visual.action ||
      prev?.actionSeq !== visual.actionSeq ||
      prev?.hp !== visual.hp ||
      prev?.x !== visual.x ||
      prev?.z !== visual.z
    ) {
      publishMobHookEntries();
    }
  };

  const removeMobById = (mobId: string): void => {
    const group = mobMeshes.get(mobId);
    if (group) {
      vfxManager.attachMobDissolve(mobId, group, performance.now());
    }
    const removed = removeMob(mobMeshes, mobInstances, mobId, scene);
    if (!removed) {
      const snap = mobSnapshots.get(mobId);
      if (snap) {
        mobSnapshots.set(mobId, {
          ...snap,
          action: EntityAction.Die,
          actionSeq: (snap.actionSeq ?? 0) + 1,
          hp: 0,
        });
        publishMobHookEntries();
      }
    }
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

    const mobClips = tickMobVisuals(mobInstances, dt, nowMs, {
      x: localPosition.x,
      z: localPosition.z,
    });
    lastMobClips = mobClips;
    for (const mobId of flushPendingMobRemovals(mobMeshes, mobInstances, scene, nowMs)) {
      mobSnapshots.delete(mobId);
      publishMobHookEntries();
    }

    faceHpBarsToCamera(mobMeshes, camera);

    tickRemotePlayers(remotePlayers, dt, nowMs);
    if (remotePlayers.size > 0) {
      setOthers(listRemotePlayersForHook());
    }

    tickNpcVisuals(npcInstances, dt, nowMs);
    vfxManager.tick(nowMs);
    vfxManager.publishHook(getGameState().vfx);
    const { zone } = getGameState();
    audioManager?.tickFootsteps({ x: player.x, z: player.z, zoneType: zone.type }, nowMs);
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
    audioManager?.dispose();
    audioManager = null;
    vfxManager.dispose();
    renderer.dispose();
  };

  return {
    scene,
    camera,
    renderer,
    terrainMesh,
    tick,
    render,
    handleClick,
    syncLocalPlayer,
    setLocalPlayerName,
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
    rotateCamera,
    setVfxTargetMobId,
    syncPlayerVfx,
    syncMobVfx,
    setAfterTick,
    setAudioManager,
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
