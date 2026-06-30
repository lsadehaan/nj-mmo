import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import {
  initGameState,
  getGameState,
  setQuests,
  setMobs,
  setZone,
  setWarehouse,
  setNpcs,
} from '../test-hook';
import { getZoneAt, EQUIP_SLOTS } from '@nj/game-core';
import { getNpcEntry, TI_NPC_MANIFEST_IDS } from '../scene/creature/npc-manifest';
import {
  createNpcInstanceMap,
  getNpcHookEntries,
  npcStateToVisual,
  syncNpcVisual,
} from '../scene/npc-renderer';

const { mockCallbacksGet } = vi.hoisted(() => ({
  mockCallbacksGet: vi.fn(),
}));

vi.mock('@colyseus/sdk', () => ({
  Callbacks: {
    get: mockCallbacksGet,
  },
}));

import { wireRoom } from './room';
import type { GameRenderer } from '../scene/renderer';

describe('wireRoom mob sync (unit)', () => {
  beforeEach(() => {
    initGameState();
  });

  it('updates __GAME_STATE__.mobs with npcId for Phase 22 types (BEST22-51)', () => {
    setMobs([
      {
        id: 'archer',
        npcId: 20006,
        x: 10,
        y: 4,
        z: -10,
        hp: 131,
        maxHp: 131,
        action: 'idle',
        actionSeq: 0,
      },
    ]);
    expect(getGameState().mobs[0]?.npcId).toBe(20006);
  });

  it('updates __GAME_STATE__.mobs attack action for Orc Warrior (BEST22-52)', () => {
    setMobs([
      {
        id: 'warrior',
        npcId: 20093,
        x: 0,
        y: 0,
        z: 0,
        hp: 100,
        maxHp: 172,
        action: 'attack',
        actionSeq: 1,
      },
    ]);
    expect(getGameState().mobs[0]?.action).toBe('attack');
  });
});

describe('wireRoom quest sync (unit)', () => {
  beforeEach(() => {
    initGameState();
  });

  it('updates __GAME_STATE__.quests when entries change', () => {
    setQuests([{ questId: 255, status: 'in_progress', step: 1 }]);
    expect(getGameState().quests.active).toHaveLength(1);
    expect(getGameState().quests.active[0]?.objectiveText).toContain('Gremlin');

    setQuests([{ questId: 255, status: 'in_progress', step: 2 }]);
    expect(getGameState().quests.active[0]?.step).toBe(2);
  });
});

describe('test-hook zone defaults', () => {
  beforeEach(() => {
    initGameState();
  });

  it('TIW23-47: pre-join zone is unknown', () => {
    expect(getGameState().zone).toEqual({
      id: '',
      type: 'unknown',
      displayName: '',
    });
  });
});

describe('wireRoom warehouse sync (unit)', () => {
  beforeEach(() => {
    initGameState();
  });

  it('TOWN24-28: exposes warehouse stacks on __GAME_STATE__.warehouse', () => {
    setWarehouse({ 1060: 3, 1835: 10 });
    expect(getGameState().warehouse[1060]).toBe(3);
    expect(getGameState().warehouse[1835]).toBe(10);
  });
});

describe('wireRoom TI NPC roster (unit)', () => {
  beforeEach(() => {
    initGameState();
  });

  it('TOWN24-14: syncs 26 TI NPCs with mesh renderKind on __GAME_STATE__.npcs', () => {
    expect(TI_NPC_MANIFEST_IDS).toHaveLength(26);

    const scene = new THREE.Scene();
    const meshMap = new Map<string, THREE.Group>();
    const instances = createNpcInstanceMap();
    const snapshots = new Map<
      string,
      ReturnType<typeof npcStateToVisual>
    >();

    for (const npcId of TI_NPC_MANIFEST_IDS) {
      const id = `npc-${npcId}`;
      const serverNpc = {
        id,
        npcId,
        type: 'Folk',
        x: 0,
        y: 4,
        z: 0,
      };
      syncNpcVisual(meshMap, instances, npcStateToVisual(serverNpc), scene);
      snapshots.set(id, npcStateToVisual(serverNpc));
    }

    const hooks = getNpcHookEntries(instances, snapshots);
    setNpcs(
      hooks.map((hook) => {
        const snap = snapshots.get(hook.npcKey)!;
        const entry = getNpcEntry(hook.npcId);
        return {
          npcId: hook.npcId,
          name: entry?.displayName ?? `Npc${hook.npcId}`,
          type: 'Folk',
          x: snap.x,
          y: snap.y,
          z: snap.z,
          renderKind: hook.renderKind,
          action: hook.action,
        };
      })
    );

    expect(getGameState().npcs).toHaveLength(26);
    expect(getGameState().npcs[0]?.npcId).toBe(30001);
    for (const npc of getGameState().npcs) {
      expect(npc.renderKind).toBe('mesh');
    }
  });
});

describe('wireRoom zone sync (unit)', () => {
  beforeEach(() => {
    initGameState();
  });

  it('TIW23-45: exposes zone id and type from server zoneId', () => {
    const hit = getZoneAt(0, 0);
    setZone({ id: 'ti_village', type: hit.type, displayName: hit.displayName });
    expect(getGameState().zone.id).toBe('ti_village');
    expect(getGameState().zone.type).toBe('peace');
  });

  it('TIW23-46: updates zone when moving village → obelisk', () => {
    const village = getZoneAt(0, 0);
    setZone({ id: 'ti_village', type: village.type, displayName: village.displayName });
    const obelisk = getZoneAt(-150, 55);
    setZone({ id: 'obelisk', type: obelisk.type, displayName: obelisk.displayName });
    expect(getGameState().zone.id).toBe('obelisk');
    expect(getGameState().zone.type).toBe('combat');
  });
});

describe('wireRoom equipment sync (unit)', () => {
  let localPlayer: Record<string, unknown>;
  let onLocalChange: (() => void) | undefined;

  const game = {
    syncLocalPlayer: vi.fn(),
    setLocalPlayerName: vi.fn(),
    syncRemotePlayer: vi.fn(),
    removeRemotePlayer: vi.fn(),
    syncMob: vi.fn(),
    removeMob: vi.fn(),
    syncNpc: vi.fn(),
    removeNpc: vi.fn(),
    triggerNpcGreet: vi.fn(),
    getNpcHookEntries: vi.fn(() => []),
    setAfterTick: vi.fn(),
    syncPlayerVfx: vi.fn(),
    syncMobVfx: vi.fn(),
    setVfxTargetMobId: vi.fn(),
    getCurrentAnimationClip: () => 'idle' as const,
  } as unknown as GameRenderer;

  beforeEach(() => {
    document.body.innerHTML = '';
    initGameState();
    onLocalChange = undefined;

    const chestIdx = EQUIP_SLOTS.indexOf('chest');
    const equipItemIds = Array(EQUIP_SLOTS.length).fill(0);
    const equipEnchantLevels = Array(EQUIP_SLOTS.length).fill(0);
    equipItemIds[chestIdx] = 23;

    localPlayer = {
      x: 0,
      y: 4.26,
      z: 0,
      xp: 0,
      level: 1,
      hp: 100,
      maxHp: 100,
      mp: 50,
      maxMp: 50,
      adena: 1000,
      equippedWeaponItemId: 0,
      equipSlotIds: EQUIP_SLOTS.map((_, i) => i),
      equipItemIds,
      equipEnchantLevels,
      pDef: 47,
      powerStrikeCooldownEndMs: 0,
      healingPotionCooldownEndMs: 0,
      items: { entries: () => [] as const },
    };

    mockCallbacksGet.mockReturnValue({
      onAdd: (
        collectionOrPlayer: string | Record<string, unknown>,
        handlerOrProperty: string | ((entity: unknown, id: string) => void)
      ) => {
        if (collectionOrPlayer === 'players' && typeof handlerOrProperty === 'function') {
          (handlerOrProperty as (entity: unknown, id: string) => void)(
            localPlayer,
            'local-session'
          );
        }
      },
      onChange: (target: unknown, handlerOrProperty?: string | (() => void)) => {
        if (target === localPlayer && typeof handlerOrProperty === 'function') {
          onLocalChange = handlerOrProperty;
        }
      },
      onRemove: vi.fn(),
      listen: vi.fn(),
    });

    wireRoom(
      {
        sessionId: 'local-session',
        send: vi.fn(),
        state: {
          players: new Map([['local-session', localPlayer]]),
          mobs: new Map(),
          npcs: new Map(),
        },
        onMessage: vi.fn(),
      } as never,
      game
    );
  });

  it('ITEM25-32: syncs chest slot item 23 to __GAME_STATE__.equipment', () => {
    onLocalChange?.();
    expect(getGameState().equipment.chest).toEqual({ itemId: 23, enchantLevel: 0 });
  });
});
