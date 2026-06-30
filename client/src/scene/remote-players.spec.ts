import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import {
  listRemotePlayers,
  removeRemotePlayer,
  tickRemotePlayers,
  upsertRemotePlayer,
  usesCapsuleGeometry,
  type RemotePlayerMap,
} from './remote-players';
import type { RemotePlayerAvatar } from './remote-player-avatar';

function stubAvatar(): RemotePlayerAvatar {
  const group = new THREE.Group();
  return {
    group,
    sync: () => undefined,
    update: () => 'idle',
    setName: () => undefined,
    ready: Promise.resolve(),
  };
}

vi.mock('./remote-player-avatar', () => ({
  createRemotePlayerAvatar: () => stubAvatar(),
}));

describe('remote-players', () => {
  it('creates mesh avatars without capsule geometry', () => {
    const scene = new THREE.Scene();
    const map: RemotePlayerMap = new Map();

    upsertRemotePlayer(map, 'session-a', { x: 1, y: 2, z: 3 }, scene);
    const instance = map.get('session-a')!;
    expect(usesCapsuleGeometry(instance.group)).toBe(false);
    expect(scene.children).toContain(instance.group);
  });

  it('upserts idempotently per sessionId', () => {
    const scene = { add: vi.fn(), remove: vi.fn() } as unknown as THREE.Scene;
    const map: RemotePlayerMap = new Map();

    const first = upsertRemotePlayer(map, 'session-a', { x: 1, y: 2, z: 3 }, scene);
    const second = upsertRemotePlayer(map, 'session-a', { x: 4, y: 5, z: 6 }, scene);

    expect(map.size).toBe(1);
    expect(second).toBe(first);
  });

  it('creates distinct avatar groups per sessionId', () => {
    const scene = new THREE.Scene();
    const map: RemotePlayerMap = new Map();

    const first = upsertRemotePlayer(map, 'session-a', { x: 0, y: 0, z: 0 }, scene);
    const second = upsertRemotePlayer(map, 'session-b', { x: 1, y: 1, z: 1 }, scene);

    expect(map.size).toBe(2);
    expect(first.group).not.toBe(second.group);
    expect(scene.children).toHaveLength(2);
  });

  it('removes remote player from map and scene', () => {
    const removed: THREE.Object3D[] = [];
    const scene = {
      add: () => undefined,
      remove: (obj: THREE.Object3D) => removed.push(obj),
    } as unknown as THREE.Scene;
    const map: RemotePlayerMap = new Map();
    upsertRemotePlayer(map, 'session-b', { x: 0, y: 0, z: 0 }, scene);
    const group = map.get('session-b')!.group;

    removeRemotePlayer(map, 'session-b', scene);

    expect(map.has('session-b')).toBe(false);
    expect(removed).toContain(group);
  });

  it('disposes avatar geometry and materials on remove', () => {
    const scene = new THREE.Scene();
    const map: RemotePlayerMap = new Map();
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshBasicMaterial();
    const disposeGeometry = vi.spyOn(geometry, 'dispose');
    const disposeMaterial = vi.spyOn(material, 'dispose');
    const mesh = new THREE.Mesh(geometry, material);
    const group = new THREE.Group();
    group.add(mesh);
    map.set('session-c', {
      group,
      avatar: { group, sync: () => undefined, update: () => 'idle', ready: Promise.resolve() },
      lastClip: 'idle',
      equippedWeaponItemId: 0,
      classId: 0,
      sex: 0,
    });
    scene.add(group);

    removeRemotePlayer(map, 'session-c', scene);

    expect(map.has('session-c')).toBe(false);
    expect(scene.children).toHaveLength(0);
    expect(disposeGeometry).toHaveBeenCalled();
    expect(disposeMaterial).toHaveBeenCalled();
  });

  it('tickRemotePlayers invokes avatar update', () => {
    const update = vi.fn(() => 'move' as const);
    const map: RemotePlayerMap = new Map();
    const group = new THREE.Group();
    map.set('s1', {
      group,
      avatar: { group, sync: () => undefined, update, ready: Promise.resolve() },
      lastClip: 'idle',
      equippedWeaponItemId: 0,
      classId: 0,
      sex: 0,
    });

    const clips = tickRemotePlayers(map, 0.016, 100);
    expect(update).toHaveBeenCalledWith(0.016, 100);
    expect(clips.get('s1')).toBe('move');
    expect(map.get('s1')!.lastClip).toBe('move');
  });

  it('listRemotePlayers exposes mesh hook fields', () => {
    const map: RemotePlayerMap = new Map();
    const group = new THREE.Group();
    group.position.set(1, 0.1, 3);
    map.set('remote-1', {
      group,
      avatar: { group, sync: () => undefined, update: () => 'attack', ready: Promise.resolve() },
      lastClip: 'attack',
      equippedWeaponItemId: 2369,
      classId: 0,
      sex: 0,
    });

    expect(listRemotePlayers(map)).toEqual([
      {
        id: 'remote-1',
        x: 1,
        y: 1,
        z: 3,
        renderKind: 'mesh',
        action: 'attack',
        equippedWeaponId: 2369,
      },
    ]);
  });
});
