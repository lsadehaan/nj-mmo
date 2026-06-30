import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as THREE from 'three';
import { EntityAction } from '@nj/game-core';

vi.mock('./creature/mesh-character', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./creature/mesh-character')>();
  return {
    ...actual,
    createMeshCharacter: vi.fn(() => ({
      object: new THREE.Group(),
      ready: Promise.resolve(),
      play: () => undefined,
      update: () => undefined,
      setTime: () => undefined,
    })),
  };
});

import {
  computeFacingYaw,
  createPlayerAvatar,
  MOVE_THRESHOLD,
  MOVE_COAST_MS,
} from './player-avatar';
import { createMeshCharacter, type MeshCharacter } from './creature/mesh-character';
import { initGameState, setMobs, setTargetMobId } from '../test-hook';
import { syncWeaponVisual } from './creature/weapon-visual';

vi.mock('./creature/weapon-visual', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./creature/weapon-visual')>();
  return {
    ...actual,
    syncWeaponVisual: vi.fn(actual.syncWeaponVisual),
  };
});

function stubMesh(): MeshCharacter {
  return {
    object: new THREE.Group(),
    ready: Promise.resolve(),
    play: () => undefined,
    update: () => undefined,
    setTime: () => undefined,
  };
}

describe('createPlayerAvatar', () => {
  beforeEach(() => {
    initGameState();
    setMobs([]);
    setTargetMobId(null);
    vi.mocked(syncWeaponVisual).mockClear();
    vi.mocked(createMeshCharacter).mockClear();
  });

  it('enters move on a server step and coasts to idle after movement stops', () => {
    const avatar = createPlayerAvatar({ mesh: stubMesh() });
    avatar.sync({ x: 0, y: 0, z: 0 }, 0);
    expect(avatar.update(0.016, 0)).toBe('idle');

    // A real server position step starts movement...
    avatar.sync({ x: MOVE_THRESHOLD + 0.01, y: 0, z: 0 }, 100);
    expect(avatar.update(0.016, 100)).toBe('move');

    // ...and it stays 'move' across frames within the coast window even with no
    // further sync (the gap between server broadcasts).
    expect(avatar.update(0.016, 100 + MOVE_COAST_MS)).toBe('move');

    // Once the coast window elapses with no new movement, decay to idle — even
    // though the server has gone silent (no zero-delta sync arrives).
    expect(avatar.update(0.016, 100 + MOVE_COAST_MS + 1)).toBe('idle');
  });

  it('faces movement direction within ±5°', () => {
    const avatar = createPlayerAvatar({ mesh: stubMesh() });
    avatar.sync({ x: 0, y: 0, z: 0 }, 0);
    avatar.sync({ x: 0, y: 0, z: 1 }, 16);
    avatar.update(0.016, 16);
    const expected = Math.atan2(0, 1);
    expect(avatar.group.rotation.y).toBeCloseTo(expected, 1);
    expect(
      Math.abs(avatar.group.rotation.y - expected) * (180 / Math.PI)
    ).toBeLessThanOrEqual(5);
  });

  it('faces combat target during attack/cast when target exists', () => {
    setMobs([{ id: 'mob-1', npcId: 1, x: 10, y: 0, z: 0, hp: 10, maxHp: 10, action: 'idle', actionSeq: 0 }]);
    setTargetMobId('mob-1');

    const avatar = createPlayerAvatar({ mesh: stubMesh() });
    avatar.sync(
      { x: 0, y: 0, z: 0, action: EntityAction.Attack, actionSeq: 1 },
      0
    );
    avatar.update(0.016, 0);

    const expected = Math.atan2(10, 0);
    expect(avatar.group.rotation.y).toBeCloseTo(expected, 1);
  });

  it('syncs weapon visual when Squire Sword is equipped', () => {
    const avatar = createPlayerAvatar({ mesh: stubMesh() });
    avatar.sync({ x: 0, y: 0, z: 0, equippedWeaponItemId: 2369 }, 0);
    expect(syncWeaponVisual).toHaveBeenCalledWith(
      expect.anything(),
      2369,
      expect.any(Object)
    );
  });

  it('loads Rogue_Hooded.glb for classId 31', () => {
    createPlayerAvatar({ classId: 31 });
    expect(createMeshCharacter).toHaveBeenCalledWith(
      '/models/characters/Rogue_Hooded.glb',
      expect.objectContaining({ scale: expect.any(Number) })
    );
  });

  it('syncs weapon detach when unequipped', () => {
    const avatar = createPlayerAvatar({ mesh: stubMesh() });
    avatar.sync({ x: 0, y: 0, z: 0, equippedWeaponItemId: 2369 }, 0);
    avatar.sync({ x: 0, y: 0, z: 0, equippedWeaponItemId: 0 }, 16);
    expect(syncWeaponVisual).toHaveBeenLastCalledWith(expect.anything(), 0, expect.any(Object));
  });

  it('ignores unmapped positive weapon ids without throwing', () => {
    const avatar = createPlayerAvatar({ mesh: stubMesh() });
    expect(() =>
      avatar.sync({ x: 0, y: 0, z: 0, equippedWeaponItemId: 9999 }, 0)
    ).not.toThrow();
  });

  it('adds a single name label above the head and updates it in place', () => {
    const avatar = createPlayerAvatar({ mesh: stubMesh() });
    const nameplates = () =>
      avatar.group.children.filter((c) => c.name === 'nameplate');

    expect(nameplates().length).toBe(0);
    avatar.setName('Aria');
    expect(nameplates().length).toBe(1);

    // Re-setting the name reuses the same sprite instead of stacking labels.
    avatar.setName('Aria the Bold');
    expect(nameplates().length).toBe(1);
  });

  it('ignores empty/whitespace names (no label created)', () => {
    const avatar = createPlayerAvatar({ mesh: stubMesh() });
    avatar.setName('   ');
    expect(avatar.group.children.some((c) => c.name === 'nameplate')).toBe(false);
  });
});

describe('computeFacingYaw', () => {
  it('prefers target facing when requested', () => {
    const velocityYaw = computeFacingYaw(1, 0);
    const targetYaw = computeFacingYaw(0, 0, 5, 5, true);
    expect(targetYaw).toBeCloseTo(Math.atan2(5, 5), 5);
    expect(targetYaw).not.toBeCloseTo(velocityYaw, 1);
  });
});
