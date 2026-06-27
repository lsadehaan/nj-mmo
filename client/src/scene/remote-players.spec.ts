import { describe, it, expect } from 'vitest';
import {
  createRemotePlayerMesh,
  removeRemotePlayer,
  upsertRemotePlayer,
  type RemotePlayerMeshMap,
} from './remote-players';

describe('remote-players', () => {
  it('creates and updates a remote player mesh in the map', () => {
    const scene = { add: () => undefined, remove: () => undefined };
    const map: RemotePlayerMeshMap = new Map();

    upsertRemotePlayer(map, 'session-a', 1, 2, 3, scene as never);
    expect(map.size).toBe(1);
    const first = map.get('session-a')!;
    expect(first.position.x).toBe(1);
    expect(first.position.y).toBe(2);
    expect(first.position.z).toBe(3);

    upsertRemotePlayer(map, 'session-a', 4, 5, 6, scene as never);
    expect(map.size).toBe(1);
    expect(map.get('session-a')).toBe(first);
    expect(first.position.x).toBe(4);
    expect(first.position.z).toBe(6);
  });

  it('removes a remote player mesh from the map and scene', () => {
    const removed: unknown[] = [];
    const scene = {
      add: () => undefined,
      remove: (mesh: unknown) => removed.push(mesh),
    };
    const map: RemotePlayerMeshMap = new Map();
    const mesh = createRemotePlayerMesh();
    map.set('session-b', mesh);

    removeRemotePlayer(map, 'session-b', scene as never);

    expect(map.has('session-b')).toBe(false);
    expect(removed).toEqual([mesh]);
  });
});
