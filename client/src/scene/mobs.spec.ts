import { describe, it, expect, vi, afterEach } from 'vitest';
import * as THREE from 'three';
import { EntityAction, ACTION_DURATION_MS } from '@nj/game-core';
import {
  createMobGroup,
  createMobInstanceMap,
  flushPendingMobRemovals,
  getMobHpBarYOffset,
  hpBarFillRatio,
  mobStateToVisual,
  mobUsesCapsule,
  removeMob,
  syncMobVisual,
  tickMobVisuals,
  ANIM_FULL_DISTANCE,
  FAR_ANIM_INTERVAL_MS,
  clearMobTemplateLoadsForTest,
  attachGoblinClubForTest,
  type MobMeshMap,
  type MobVisualState,
} from './mobs';
import { clearGltfTemplateCache, KAYKIT_CLIP_MAP } from './creature/mesh-character';
import { KAYKIT_RIGHT_HAND_BONE } from './creature/weapon-manifest';
import { findBoneByName } from './creature/attachment';
import { createMobAvatar } from './mob-avatar';

describe('mobs visual mapping', () => {
  afterEach(() => {
    clearGltfTemplateCache();
    clearMobTemplateLoadsForTest();
  });

  it('maps server mob state to visual snapshot without mutating hp', () => {
    const server = {
      id: 'mob-1',
      npcId: 20001,
      x: 12,
      y: 4.26,
      z: -18,
      hp: 30,
      maxHp: 41,
      action: EntityAction.Attack,
      actionSeq: 2,
    };
    const visual = mobStateToVisual(server);

    expect(visual).toEqual({
      id: 'mob-1',
      npcId: 20001,
      x: 12,
      y: 4.26,
      z: -18,
      hp: 30,
      maxHp: 41,
      action: EntityAction.Attack,
      actionSeq: 2,
    });
    expect(visual).not.toBe(server);
    server.hp = 0;
    expect(visual.hp).toBe(30);
  });

  it('computes hp bar fill ratio clamped to 0..1', () => {
    expect(hpBarFillRatio(20, 40)).toBe(0.5);
    expect(hpBarFillRatio(0, 40)).toBe(0);
    expect(hpBarFillRatio(50, 40)).toBe(1);
    expect(hpBarFillRatio(10, 0)).toBe(0);
  });

  it('creates and updates mob mesh position and hp bar from server snapshot', () => {
    const scene = { add: () => undefined, remove: () => undefined };
    const map: MobMeshMap = new Map();
    const instances = createMobInstanceMap();

    const first: MobVisualState = {
      id: 'mob-a',
      npcId: 20001,
      x: 1,
      y: 2,
      z: 3,
      hp: 40,
      maxHp: 80,
    };
    syncMobVisual(map, instances, first, scene as never);
    expect(map.size).toBe(1);
    const group = map.get('mob-a')!;
    expect(group.position.x).toBe(1);
    expect(group.position.y).toBe(2);
    expect(group.position.z).toBe(3);
    expect(group.userData.mobId).toBe('mob-a');

    syncMobVisual(
      map,
      instances,
      { ...first, x: 4, y: 5, z: 6, hp: 20, maxHp: 80 },
      scene as never
    );
    expect(map.size).toBe(1);
    expect(map.get('mob-a')).toBe(group);
    expect(group.position.x).toBe(4);
    expect(group.position.z).toBe(6);
  });

  it('uses manifest hpBarYOffset for mapped npcIds', () => {
    const scene = { add: () => undefined, remove: () => undefined };
    const map: MobMeshMap = new Map();
    const instances = createMobInstanceMap();
    syncMobVisual(
      map,
      instances,
      { id: 'mob-g', npcId: 20001, x: 0, y: 0, z: 0, hp: 10, maxHp: 10 },
      scene as never
    );
    expect(getMobHpBarYOffset(instances, 'mob-g')).toBe(1.45);
  });

  it('keeps capsule fallback for unknown npcId', () => {
    const scene = { add: () => undefined, remove: () => undefined };
    const map: MobMeshMap = new Map();
    const instances = createMobInstanceMap();
    syncMobVisual(
      map,
      instances,
      { id: 'mob-x', npcId: 99999, x: 0, y: 0, z: 0, hp: 10, maxHp: 10 },
      scene as never
    );
    expect(mobUsesCapsule(instances, 'mob-x')).toBe(true);
    expect(map.get('mob-x')?.getObjectByName('capsuleBody')).not.toBeNull();
  });

  it('renders rigged mesh (not capsule) for Orc npcId 20130 after template load', async () => {
    const skinned = new THREE.SkinnedMesh(
      new THREE.BoxGeometry(0.4, 1.2, 0.4),
      new THREE.MeshBasicMaterial()
    );
    skinned.bind(new THREE.Skeleton([new THREE.Bone()]));
    const mobRoot = new THREE.Group();
    mobRoot.add(skinned);

    vi.spyOn(await import('./creature/mesh-character'), 'loadGltfTemplate').mockResolvedValue({
      scene: mobRoot,
      animations: [],
    });

    const scene = { add: () => undefined, remove: () => undefined };
    const map: MobMeshMap = new Map();
    const instances = createMobInstanceMap();
    syncMobVisual(
      map,
      instances,
      { id: 'orc-1', npcId: 20130, x: 0, y: 0, z: 0, hp: 98, maxHp: 98 },
      scene as never
    );

    await vi.waitFor(() => {
      expect(mobUsesCapsule(instances, 'orc-1')).toBe(false);
    });
    expect(map.get('orc-1')?.getObjectByName('capsuleBody')).toBeUndefined();
  });

  it.each([20006, 20132, 20016, 20103])(
    'renders rigged mesh (not capsule) for Phase 22 npcId %i (BEST22-42)',
    async (npcId) => {
      const skinned = new THREE.SkinnedMesh(
        new THREE.BoxGeometry(0.4, 1.2, 0.4),
        new THREE.MeshBasicMaterial()
      );
      skinned.bind(new THREE.Skeleton([new THREE.Bone()]));
      const mobRoot = new THREE.Group();
      mobRoot.add(skinned);

      vi.spyOn(await import('./creature/mesh-character'), 'loadGltfTemplate').mockResolvedValue({
        scene: mobRoot,
        animations: [],
      });

      const scene = { add: () => undefined, remove: () => undefined };
      const map: MobMeshMap = new Map();
      const instances = createMobInstanceMap();
      const mobId = `mob-${npcId}`;
      syncMobVisual(
        map,
        instances,
        { id: mobId, npcId, x: 0, y: 0, z: 0, hp: 100, maxHp: 100 },
        scene as never
      );

      await vi.waitFor(() => {
        expect(mobUsesCapsule(instances, mobId)).toBe(false);
      });
      expect(map.get(mobId)?.getObjectByName('capsuleBody')).toBeUndefined();
    }
  );

  it('defers scene removal while die clip is latched', () => {
    vi.useFakeTimers();
    const removed: unknown[] = [];
    const scene = {
      add: () => undefined,
      remove: (obj: unknown) => removed.push(obj),
    };
    const map: MobMeshMap = new Map();
    const instances = createMobInstanceMap();
    const group = createMobGroup('mob-d');
    map.set('mob-d', group);
    const latchDie = vi.fn();
    const isDiePlaying = vi
      .fn()
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true)
      .mockReturnValue(false);
    instances.set('mob-d', {
      group,
      avatar: { latchDie, isDiePlaying } as never,
      usesCapsule: false,
      hpBarYOffset: 1.6,
      pendingRemovalAtMs: null,
      currentClip: 'die',
      clubProp: null,
    });

    expect(removeMob(map, instances, 'mob-d', scene as never, 0)).toBe(false);
    expect(removed).toHaveLength(0);

    const instance = instances.get('mob-d')!;
    instance.pendingRemovalAtMs = ACTION_DURATION_MS[EntityAction.Die];
    flushPendingMobRemovals(map, instances, scene as never, ACTION_DURATION_MS[EntityAction.Die] + 1);
    expect(map.has('mob-d')).toBe(false);
    expect(removed).toHaveLength(1);
    vi.useRealTimers();
  });

  it('defers capsule mob removal for die clip duration without avatar', () => {
    vi.useFakeTimers();
    const removed: unknown[] = [];
    const scene = {
      add: () => undefined,
      remove: (obj: unknown) => removed.push(obj),
    };
    const map: MobMeshMap = new Map();
    const instances = createMobInstanceMap();
    const group = createMobGroup('mob-b');
    map.set('mob-b', group);
    instances.set('mob-b', {
      group,
      avatar: null,
      usesCapsule: true,
      hpBarYOffset: 1.6,
      pendingRemovalAtMs: null,
      currentClip: 'idle',
      clubProp: null,
    });

    expect(removeMob(map, instances, 'mob-b', scene as never, 0)).toBe(false);
    expect(map.has('mob-b')).toBe(true);
    expect(instances.get('mob-b')?.currentClip).toBe('die');

    vi.advanceTimersByTime(ACTION_DURATION_MS[EntityAction.Die] + 1);
    expect(flushPendingMobRemovals(map, instances, scene as never, ACTION_DURATION_MS[EntityAction.Die] + 1)).toEqual([
      'mob-b',
    ]);
    expect(map.has('mob-b')).toBe(false);
    expect(removed).toEqual([group]);
    vi.useRealTimers();
  });

  it('attaches a club prop only to Goblin npcId 20003', async () => {
    const rootBone = new THREE.Bone();
    const handBone = new THREE.Bone();
    handBone.name = KAYKIT_RIGHT_HAND_BONE;
    rootBone.add(handBone);
    const skinned = new THREE.SkinnedMesh(
      new THREE.BoxGeometry(0.2, 0.5, 0.2),
      new THREE.MeshBasicMaterial()
    );
    skinned.bind(new THREE.Skeleton([rootBone, handBone]));
    const mobRoot = new THREE.Group();
    mobRoot.add(rootBone);
    mobRoot.add(skinned);

    const avatar = createMobAvatar({
      entry: {
        model: '/models/monsters/Goblin.glb',
        clipMap: KAYKIT_CLIP_MAP,
        scale: 1,
        feetOffsetY: 0.5,
        hpBarYOffset: 1.6,
      },
      template: { scene: mobRoot, animations: [] },
    });

    const clubScene = new THREE.Group();
    clubScene.add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.1)));
    vi.spyOn(await import('./creature/mesh-character'), 'loadGltfTemplate').mockResolvedValue({
      scene: clubScene,
      animations: [],
    });

    const instances = createMobInstanceMap();
    const group = createMobGroup('goblin-1');
    instances.set('goblin-1', {
      group,
      avatar,
      usesCapsule: false,
      hpBarYOffset: 1.6,
      pendingRemovalAtMs: null,
      currentClip: 'idle',
      clubProp: null,
    });

    attachGoblinClubForTest(instances, 'goblin-1', 20003, avatar);

    instances.set('gremlin-1', {
      group: createMobGroup('gremlin-1'),
      avatar,
      usesCapsule: false,
      hpBarYOffset: 1.45,
      pendingRemovalAtMs: null,
      currentClip: 'idle',
      clubProp: null,
    });
    attachGoblinClubForTest(instances, 'gremlin-1', 20001, avatar);

    await vi.waitFor(() => {
      expect(instances.get('goblin-1')?.clubProp).not.toBeNull();
    });
    expect(instances.get('gremlin-1')?.clubProp).toBeNull();
  });

  it('clones a distinct club object per Goblin instance', async () => {
    const handBone = new THREE.Bone();
    handBone.name = KAYKIT_RIGHT_HAND_BONE;
    const skinned = new THREE.SkinnedMesh(
      new THREE.BoxGeometry(0.2, 0.5, 0.2),
      new THREE.MeshBasicMaterial()
    );
    skinned.bind(new THREE.Skeleton([handBone]));
    const mobRoot = new THREE.Group();
    mobRoot.add(handBone);
    mobRoot.add(skinned);

    const template = { scene: mobRoot, animations: [] as THREE.AnimationClip[] };
    const avatarA = createMobAvatar({
      entry: {
        model: '/models/monsters/Goblin.glb',
        clipMap: KAYKIT_CLIP_MAP,
        scale: 1,
        feetOffsetY: 0.5,
        hpBarYOffset: 1.6,
      },
      template,
    });
    const avatarB = createMobAvatar({
      entry: {
        model: '/models/monsters/Goblin.glb',
        clipMap: KAYKIT_CLIP_MAP,
        scale: 1,
        feetOffsetY: 0.5,
        hpBarYOffset: 1.6,
      },
      template,
    });

    const clubScene = new THREE.Group();
    clubScene.add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.1)));
    vi.spyOn(await import('./creature/mesh-character'), 'loadGltfTemplate').mockResolvedValue({
      scene: clubScene,
      animations: [],
    });

    const instances = createMobInstanceMap();
    instances.set('g1', {
      group: createMobGroup('g1'),
      avatar: avatarA,
      usesCapsule: false,
      hpBarYOffset: 1.6,
      pendingRemovalAtMs: null,
      currentClip: 'idle',
      clubProp: null,
    });
    instances.set('g2', {
      group: createMobGroup('g2'),
      avatar: avatarB,
      usesCapsule: false,
      hpBarYOffset: 1.6,
      pendingRemovalAtMs: null,
      currentClip: 'idle',
      clubProp: null,
    });

    attachGoblinClubForTest(instances, 'g1', 20003, avatarA);
    attachGoblinClubForTest(instances, 'g2', 20003, avatarB);

    await vi.waitFor(() => {
      const a = instances.get('g1')?.clubProp;
      const b = instances.get('g2')?.clubProp;
      expect(a).toBeTruthy();
      expect(b).toBeTruthy();
      expect(a).not.toBe(b);
    });
  });

  it('animates near mobs every frame but throttles distant mobs (anim LOD)', () => {
    const instances = createMobInstanceMap();
    const makeInstance = (mobId: string, x: number) => {
      const update = vi.fn(() => 'idle' as const);
      const group = createMobGroup(mobId);
      group.position.set(x, 0, 0);
      instances.set(mobId, {
        group,
        avatar: { update, sync: vi.fn() } as never,
        usesCapsule: false,
        hpBarYOffset: 1.6,
        pendingRemovalAtMs: null,
        currentClip: 'idle',
        clubProp: null,
        animAccumMs: 0,
      });
      return update;
    };

    const viewer = { x: 0, z: 0 };
    const near = makeInstance('near', ANIM_FULL_DISTANCE - 5);
    const far = makeInstance('far', ANIM_FULL_DISTANCE + 20);

    const dt = 0.016;
    const ticks = Math.ceil(FAR_ANIM_INTERVAL_MS / (dt * 1000)); // ~7 frames > 100ms
    for (let i = 0; i < ticks; i++) {
      tickMobVisuals(instances, dt, i * dt * 1000, viewer);
    }

    expect(near).toHaveBeenCalledTimes(ticks);
    // Far mob skeleton advanced at most once over the ~112ms window.
    expect(far.mock.calls.length).toBeLessThanOrEqual(1);
    expect(far.mock.calls.length).toBeGreaterThanOrEqual(0);
  });

  it('catches up distant mob skeleton with the accumulated delta', () => {
    const instances = createMobInstanceMap();
    const update = vi.fn(() => 'idle' as const);
    const group = createMobGroup('far');
    group.position.set(ANIM_FULL_DISTANCE + 50, 0, 0);
    instances.set('far', {
      group,
      avatar: { update, sync: vi.fn() } as never,
      usesCapsule: false,
      hpBarYOffset: 1.6,
      pendingRemovalAtMs: null,
      currentClip: 'idle',
      clubProp: null,
      animAccumMs: 0,
    });

    const viewer = { x: 0, z: 0 };
    const dt = 0.016;
    // Accumulate just past the throttle interval, then expect one catch-up step
    // whose dt is the full accumulated time, not a single frame.
    let fired = -1;
    for (let i = 0; i < 10 && fired < 0; i++) {
      tickMobVisuals(instances, dt, i * dt * 1000, viewer);
      if (update.mock.calls.length === 1) fired = i;
    }
    expect(fired).toBeGreaterThan(0);
    const stepDt = update.mock.calls[0][0] as number;
    expect(stepDt).toBeGreaterThanOrEqual(FAR_ANIM_INTERVAL_MS / 1000);
  });

  it('goblin club world position changes during attack', async () => {
    const rootBone = new THREE.Bone();
    const handBone = new THREE.Bone();
    handBone.name = KAYKIT_RIGHT_HAND_BONE;
    rootBone.add(handBone);
    const skinned = new THREE.SkinnedMesh(
      new THREE.BoxGeometry(0.2, 0.5, 0.2),
      new THREE.MeshBasicMaterial()
    );
    skinned.bind(new THREE.Skeleton([rootBone, handBone]));
    const mobRoot = new THREE.Group();
    mobRoot.add(rootBone);
    mobRoot.add(skinned);

    const avatar = createMobAvatar({
      entry: {
        model: '/models/monsters/Goblin.glb',
        clipMap: KAYKIT_CLIP_MAP,
        scale: 1,
        feetOffsetY: 0.5,
        hpBarYOffset: 1.6,
      },
      template: { scene: mobRoot, animations: [] },
    });

    const clubScene = new THREE.Group();
    clubScene.add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.1)));
    vi.spyOn(await import('./creature/mesh-character'), 'loadGltfTemplate').mockResolvedValue({
      scene: clubScene,
      animations: [],
    });

    const instances = createMobInstanceMap();
    const group = createMobGroup('goblin-attack');
    instances.set('goblin-attack', {
      group,
      avatar,
      usesCapsule: false,
      hpBarYOffset: 1.6,
      pendingRemovalAtMs: null,
      currentClip: 'idle',
      clubProp: null,
    });

    attachGoblinClubForTest(instances, 'goblin-attack', 20003, avatar);

    await vi.waitFor(() => {
      expect(instances.get('goblin-attack')?.clubProp).not.toBeNull();
    });

    const club = instances.get('goblin-attack')!.clubProp!;
    const hand = findBoneByName(avatar.group, KAYKIT_RIGHT_HAND_BONE)!;
    avatar.group.updateMatrixWorld(true);
    const idlePos = club.getWorldPosition(new THREE.Vector3()).clone();

    avatar.sync({ x: 0, y: 0, z: 0, action: EntityAction.Attack, actionSeq: 1 }, 0);
    expect(avatar.update(0.016, 0)).toBe('attack');

    hand.rotation.z = Math.PI / 2;
    avatar.group.updateMatrixWorld(true);
    const attackPos = club.getWorldPosition(new THREE.Vector3());

    expect(idlePos.distanceTo(attackPos)).toBeGreaterThan(0.01);
  });
});
