import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { tickRemotePlayers, upsertRemotePlayer, type RemotePlayerMap } from './remote-players';

describe('renderer remote tick', () => {
  it('tickRemotePlayers advances every remote avatar', () => {
    const update = vi.fn(() => 'idle' as const);
    const map: RemotePlayerMap = new Map();
    const group = new THREE.Group();
    map.set('remote-a', {
      group,
      avatar: { group, sync: () => undefined, update, ready: Promise.resolve() },
      lastClip: 'idle',
      equippedWeaponItemId: 0,
      classId: 0,
      sex: 0,
    });

    tickRemotePlayers(map, 0.016, 50);
    expect(update).toHaveBeenCalledWith(0.016, 50);
  });

  it('upsertRemotePlayer syncs equipped weapon id', () => {
    const sync = vi.fn();
    const map: RemotePlayerMap = new Map();
    const group = new THREE.Group();
    map.set('remote-b', {
      group,
      avatar: { group, sync, update: () => 'idle', ready: Promise.resolve() },
      lastClip: 'idle',
      equippedWeaponItemId: 0,
      classId: 0,
      sex: 0,
    });

    upsertRemotePlayer(
      map,
      'remote-b',
      { x: 0, y: 0, z: 0, equippedWeaponItemId: 2369 },
      { add: () => undefined, remove: () => undefined } as unknown as THREE.Scene
    );

    expect(sync).toHaveBeenCalledWith(
      expect.objectContaining({ equippedWeaponItemId: 2369 })
    );
    expect(map.get('remote-b')!.equippedWeaponItemId).toBe(2369);
  });
});
