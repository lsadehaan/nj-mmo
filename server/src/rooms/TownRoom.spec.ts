import { boot, ColyseusTestServer } from '@colyseus/testing';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { EntityAction, SPAWN_X, SPAWN_Y, SPAWN_Z, snapEntityY, isWalkable } from '@nj/game-core';
import app from '../app.config';
import { getDb } from '../db/client';
import {
  createCharacter,
  loadCharacter,
  saveCharacter,
  loadCharacterItems,
} from '../db/character-repository';
import { runSeed, FIXTURE_DATA_DIR } from '../seed/seed';
import { DEFAULT_SIM_INTERVAL_MS } from './TownRoom';
import { TownState } from './schema/TownState';
import type { MobRuntime } from './spawn-manager';
import * as mobAi from './mob-ai';

const OUT_OF_PEACE = { x: 30, z: -30 };

let colyseus: ColyseusTestServer;

beforeAll(async () => {
  colyseus = await boot(app);
});

afterAll(async () => {
  await colyseus.shutdown();
});

function tempDbPath(): { dbPath: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), 'nj-town-room-'));
  const dbPath = join(dir, 'test.db');
  return { dbPath, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

function seededCombatDb(): { dbPath: string; cleanup: () => void } {
  const { dbPath, cleanup } = tempDbPath();
  runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
  return { dbPath, cleanup };
}

function zeroOffsetRng() {
  return {
    nextFloat: () => 0,
    nextInt: (min: number) => min,
    nextDamageOffset: () => 0,
  };
}

function createFakeClock(startMs = 0) {
  let now = startMs;
  return {
    now: () => now,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

function findNpcByNpcId(room: { state: TownState }, npcId: number) {
  return [...room.state.npcs.values()].find((n) => n.npcId === npcId);
}

function getPlayerItemCount(
  room: { state: TownState },
  sessionId: string,
  itemId: number
): number {
  const stack = room.state.players.get(sessionId)?.items.get(String(itemId));
  return stack?.count ?? 0;
}

function placePlayerAtNpc(
  room: { state: TownState },
  sessionId: string,
  npcId: number
) {
  const npc = findNpcByNpcId(room, npcId)!;
  placePlayerNear(room, sessionId, npc.x, npc.z);
}

function placePlayerNearNpcOffset(
  room: { state: TownState },
  sessionId: string,
  npcId: number,
  offsetZ: number
) {
  const npc = findNpcByNpcId(room, npcId)!;
  placePlayerNear(room, sessionId, npc.x, npc.z + offsetZ);
}

function findMobByNpcId(room: { state: TownState }, npcId: number) {
  return [...room.state.mobs.values()].find((m) => m.npcId === npcId);
}

function placePlayerNear(
  room: { state: TownState },
  sessionId: string,
  x: number,
  z: number
) {
  const player = room.state.players.get(sessionId)!;
  player.x = x;
  player.z = z;
  const tickStates = (room as { tickStates: Map<string, { x: number; z: number; targetX: number | null; targetZ: number | null }> })
    .tickStates;
  const tickState = tickStates.get(sessionId);
  if (tickState) {
    tickState.x = x;
    tickState.z = z;
    tickState.targetX = null;
    tickState.targetZ = null;
  }
}

function relocateMob(
  room: { state: TownState },
  mobId: string,
  x: number,
  z: number
) {
  const runtime = (room as { mobRuntime: Map<string, MobRuntime> }).mobRuntime.get(mobId)!;
  runtime.x = x;
  runtime.z = z;
  runtime.wanderTargetX = x;
  runtime.wanderTargetZ = z;
  runtime.wanderCooldownMs = Number.MAX_SAFE_INTEGER;
  const mobState = room.state.mobs.get(mobId)!;
  mobState.x = x;
  mobState.z = z;
}

function placePlayerAndMobForCombat(
  room: { state: TownState },
  sessionId: string,
  mob: { id: string; x: number; z: number }
) {
  relocateMob(room, mob.id, OUT_OF_PEACE.x, OUT_OF_PEACE.z);
  placePlayerNear(room, sessionId, OUT_OF_PEACE.x, OUT_OF_PEACE.z);
}

type TestRoom = Awaited<ReturnType<ColyseusTestServer['createRoom']>>;
type TestClient = { send: (type: string, payload?: unknown) => void };

// Tests run with NJ_AUTOSIM=0, so TownRoom has no background simulation
// interval. They advance the world by calling simulate() directly — fully
// deterministic and synchronous, with no wall-clock sleeps or tick/transport
// races.
const SIM_DELTA_MS = DEFAULT_SIM_INTERVAL_MS;

/** Advance the authoritative simulation by exactly one fixed tick. */
function tick(room: TestRoom): void {
  (room as unknown as { simulate(deltaMs: number): void }).simulate(SIM_DELTA_MS);
}

/**
 * Deterministically deliver one or more client→server messages. `waitForMessage`
 * resolves only after the room has RECEIVED and run the handler for the final
 * message, so the caller never races the async transport. Messages are ordered,
 * so awaiting the last one guarantees the earlier ones were handled too.
 */
async function deliver(
  room: TestRoom,
  client: TestClient,
  messages: Array<[string, unknown]>
): Promise<void> {
  const lastType = messages[messages.length - 1][0];
  const delivered = room.waitForMessage(lastType);
  for (const [type, payload] of messages) client.send(type, payload);
  await delivered;
}

/**
 * Deliver intent messages then advance exactly one simulation tick so the room's
 * `simulate()` consumes the resulting pending flags. Combines deterministic
 * delivery with deterministic processing.
 */
async function deliverAndTick(
  room: TestRoom,
  client: TestClient,
  messages: Array<[string, unknown]>
): Promise<void> {
  await deliver(room, client, messages);
  tick(room);
}

describe('TownRoom', () => {
  it('adds a player to state on join', async () => {
    const room = await colyseus.createRoom('town', { dbPath: ':memory:' });
    const client = await colyseus.connectTo(room);

    expect(room.state.players.size).toBe(1);
    const player = room.state.players.get(client.sessionId);
    expect(player).toBeDefined();
    expect(player!.x).toBe(0);
    expect(player!.y).toBeCloseTo(4.263961466789237, 5);
    expect(player!.z).toBe(0);
    expect(player!.hp).toBe(100);
    expect(player!.mp).toBe(50);
    expect(player!.xp).toBe(0);
    expect(player!.level).toBe(1);
    expect(player!.connected).toBe(true);
    expect(player!.action).toBe(0);
    expect(player!.actionSeq).toBe(0);

    await client.leave();
  });

  it('does not persist render-only action/actionSeq across save/load', async () => {
    const { dbPath, cleanup } = tempDbPath();
    try {
      const room = await colyseus.createRoom('town', { dbPath });
      const client = await colyseus.connectTo(room);
      const sessionId = client.sessionId;
      const characterId = room['characterIds'].get(sessionId)!;

      const player = room.state.players.get(sessionId)!;
      player.action = 1;
      player.actionSeq = 42;

      room['persistCharacter'](sessionId);

      await client.leave(true);
      await room.disconnect();

      const room2 = await colyseus.createRoom('town', { dbPath });
      const client2 = await colyseus.connectTo(room2, { characterId });
      const reloaded = room2.state.players.get(client2.sessionId)!;
      expect(reloaded.action).toBe(0);
      expect(reloaded.actionSeq).toBe(0);

      await client2.leave();
      await room2.disconnect();
    } finally {
      cleanup();
    }
  });

  it('removes a player from state on leave', async () => {
    const room = await colyseus.createRoom('town', { dbPath: ':memory:' });
    const client = await colyseus.connectTo(room);

    expect(room.state.players.size).toBe(1);
    await client.leave(true);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(room.state.players.size).toBe(0);
  });

  it('maintains TownState with players map present', async () => {
    const room = await colyseus.createRoom('town', { dbPath: ':memory:' });

    expect(room.state).toBeDefined();
    expect(room.state.players).toBeDefined();

    await room.disconnect();
  });

  it('advances player position on simulation tick when a move intent is pending', async () => {
    const room = await colyseus.createRoom('town', { dbPath: ':memory:' });
    const client = await colyseus.connectTo(room);
    const player = room.state.players.get(client.sessionId)!;

    expect(player.x).toBe(0);
    expect(player.z).toBe(0);

    room['pendingIntents'].set(client.sessionId, { targetX: 20, targetZ: 0 });

    for (let i = 0; i < 10; i++) {
      tick(room);
    }

    expect(player.x).toBeGreaterThan(0);
    expect(Math.abs(player.z)).toBeLessThan(1);

    await client.leave();
  });

  it('moves the player when a valid move intent is received', async () => {
    const room = await colyseus.createRoom('town', { dbPath: ':memory:' });
    const client = await colyseus.connectTo(room);
    const player = room.state.players.get(client.sessionId)!;

    await deliver(room, client, [['move', { targetX: 20, targetZ: 0 }]]);

    for (let i = 0; i < 10; i++) {
      tick(room);
    }

    expect(player.x).toBeGreaterThan(0);
    expect(Math.abs(player.z)).toBeLessThan(1);

    await client.leave();
  });

  it('ignores invalid move intents without changing position', async () => {
    const room = await colyseus.createRoom('town', { dbPath: ':memory:' });
    const client = await colyseus.connectTo(room);
    const player = room.state.players.get(client.sessionId)!;
    const startX = player.x;
    const startZ = player.z;

    await deliver(room, client, [
      ['move', { targetX: Number.NaN, targetZ: 0 }],
      ['move', { targetX: 200, targetZ: 0 }],
    ]);

    for (let i = 0; i < 5; i++) {
      tick(room);
    }

    expect(player.x).toBe(startX);
    expect(player.z).toBe(startZ);

    await client.leave();
  });

  it('broadcasts player position changes to other clients', async () => {
    const room = await colyseus.createRoom('town', { dbPath: ':memory:' });
    const clientA = await colyseus.sdk.joinById(room.roomId, {}, TownState);
    const clientB = await colyseus.sdk.joinById(room.roomId, {}, TownState);
    const sessionA = clientA.sessionId;

    await deliver(room, clientA, [['move', { targetX: 20, targetZ: 0 }]]);
    // Advance the server synchronously so A actually moves...
    for (let i = 0; i < 10; i++) tick(room);

    // ...then wait (bounded) for the state patch to propagate to B's client.
    const deadline = Date.now() + 2000;
    let remoteOnB = clientB.state.players.get(sessionA);
    while (Date.now() < deadline && (!remoteOnB || remoteOnB.x <= 0)) {
      await new Promise((resolve) => setTimeout(resolve, 20));
      remoteOnB = clientB.state.players.get(sessionA);
    }

    expect(remoteOnB).toBeDefined();
    expect(remoteOnB!.x).toBeGreaterThan(0);
    expect(Math.abs(remoteOnB!.z)).toBeLessThan(1);

    await clientA.leave();
    await clientB.leave();
  });

  it('creates a new character row when joining without characterId', async () => {
    const { dbPath, cleanup } = tempDbPath();
    try {
      const room = await colyseus.createRoom('town', { dbPath });
      const client = await colyseus.sdk.joinById(room.roomId, {}, TownState);
      const characterId = await client.waitForMessage('characterId');
      const row = loadCharacter(getDb(dbPath), characterId);
      expect(row).toMatchObject({
        name: 'Adventurer',
        level: 1,
        xp: 0,
        hp: 100,
        mp: 50,
        x: SPAWN_X,
        y: SPAWN_Y,
        z: SPAWN_Z,
      });
      await client.leave();
    } finally {
      cleanup();
    }
  });

  it('restores saved position when joining with a known characterId', async () => {
    const { dbPath, cleanup } = tempDbPath();
    try {
      const db = getDb(dbPath);
      const saved = createCharacter(db);
      saveCharacter(db, { ...saved, x: 15, y: SPAWN_Y, z: -10 });

      const room = await colyseus.createRoom('town', { dbPath });
      const client = await colyseus.sdk.joinById(
        room.roomId,
        { characterId: saved.id },
        TownState
      );
      const player = room.state.players.get(client.sessionId)!;
      expect(player.x).toBe(15);
      expect(player.y).toBe(SPAWN_Y);
      expect(player.z).toBe(-10);
      expect(player.hp).toBe(100);
      expect(player.level).toBe(1);
      await client.leave();
    } finally {
      cleanup();
    }
  });

  it('persists updated coordinates on unclean disconnect (onDrop)', async () => {
    const { dbPath, cleanup } = tempDbPath();
    try {
      const room = await colyseus.createRoom('town', { dbPath });
      const client = await colyseus.sdk.joinById(room.roomId, {}, TownState);
      const characterId = await client.waitForMessage('characterId');

      await deliver(room, client, [['move', { targetX: 10, targetZ: 5 }]]);
      for (let i = 0; i < 20; i++) {
        tick(room);
      }

      const player = room.state.players.get(client.sessionId)!;
      expect(player.x).not.toBe(SPAWN_X);
      const movedX = player.x;
      const movedZ = player.z;

      await client.leave(false);
      await new Promise((resolve) => setTimeout(resolve, 50));

      const row = loadCharacter(getDb(dbPath), characterId);
      expect(row!.x).toBeCloseTo(movedX, 3);
      expect(row!.z).toBeCloseTo(movedZ, 3);
      expect(room.state.players.has(client.sessionId)).toBe(true);
    } finally {
      cleanup();
    }
  });

  it('persists updated coordinates on consented leave', async () => {
    const { dbPath, cleanup } = tempDbPath();
    try {
      const room = await colyseus.createRoom('town', { dbPath });
      const client = await colyseus.sdk.joinById(room.roomId, {}, TownState);
      const characterId = await client.waitForMessage('characterId');

      await deliver(room, client, [['move', { targetX: 10, targetZ: 5 }]]);
      for (let i = 0; i < 20; i++) {
        tick(room);
      }

      const player = room.state.players.get(client.sessionId)!;
      expect(player.x).not.toBe(SPAWN_X);

      await client.leave(true);
      await new Promise((resolve) => setTimeout(resolve, 50));

      const row = loadCharacter(getDb(dbPath), characterId);
      expect(row!.x).toBeCloseTo(player.x, 3);
      expect(row!.z).toBeCloseTo(player.z, 3);
    } finally {
      cleanup();
    }
  });

  it('preserves session slot when client reconnects within the window', async () => {
    const { dbPath, cleanup } = tempDbPath();
    try {
      const room = await colyseus.createRoom('town', { dbPath });
      const client = await colyseus.sdk.joinById(room.roomId, {}, TownState);
      const sessionId = client.sessionId;
      const reconnectionToken = client.reconnectionToken;

      await client.leave(false);

      const dropDeadline = Date.now() + 2000;
      while (
        Date.now() < dropDeadline &&
        room.state.players.get(sessionId)?.connected !== false
      ) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      expect(room.state.players.has(sessionId)).toBe(true);
      expect(room.state.players.get(sessionId)!.connected).toBe(false);

      const reconnected = await colyseus.sdk.reconnect(reconnectionToken, TownState);
      expect(reconnected.sessionId).toBe(sessionId);
      expect(room.state.players.get(sessionId)!.connected).toBe(true);

      await reconnected.leave(true);
    } finally {
      cleanup();
    }
  });

  it('keeps hp/mp/xp/level unchanged after movement and persistence', async () => {
    const { dbPath, cleanup } = tempDbPath();
    try {
      const room = await colyseus.createRoom('town', { dbPath });
      const client = await colyseus.sdk.joinById(room.roomId, {}, TownState);
      const characterId = await client.waitForMessage('characterId');

      await deliver(room, client, [['move', { targetX: 10, targetZ: 0 }]]);
      for (let i = 0; i < 15; i++) {
        tick(room);
      }

      const player = room.state.players.get(client.sessionId)!;
      expect(player.hp).toBe(100);
      expect(player.mp).toBe(50);
      expect(player.xp).toBe(0);
      expect(player.level).toBe(1);

      await client.leave(true);
      await new Promise((resolve) => setTimeout(resolve, 50));

      const row = loadCharacter(getDb(dbPath), characterId);
      expect(row).toMatchObject({ hp: 100, mp: 50, xp: 0, level: 1 });
    } finally {
      cleanup();
    }
  });

  it('debounces persistence while position changes', async () => {
    const { dbPath, cleanup } = tempDbPath();
    try {
      const room = await colyseus.createRoom('town', { dbPath, saveDebounceMs: 100 });
      const client = await colyseus.sdk.joinById(room.roomId, {}, TownState);
      const characterId = await client.waitForMessage('characterId');

      await deliver(room, client, [['move', { targetX: 0.3, targetZ: 0 }]]);
      tick(room);

      const movedX = room.state.players.get(client.sessionId)!.x;
      expect(movedX).toBeGreaterThan(0);
      expect(loadCharacter(getDb(dbPath), characterId)!.x).toBe(SPAWN_X);

      await new Promise((resolve) => setTimeout(resolve, 150));
      const player = room.state.players.get(client.sessionId)!;
      expect(loadCharacter(getDb(dbPath), characterId)!.x).toBeCloseTo(player.x, 3);

      await client.leave(true);
    } finally {
      cleanup();
    }
  });
});

describe('TownRoom combat', () => {
  it('boots with populated state.mobs from seed', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await colyseus.createRoom('town', { dbPath, combatRng: zeroOffsetRng() });
      expect(room.state.mobs.size).toBe(23);
      await room.disconnect();
    } finally {
      cleanup();
    }
  });

  it('sets ATTACK action and increments actionSeq on confirmed melee', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    const clock = createFakeClock(0);
    try {
      const room = await colyseus.createRoom('town', {
        dbPath,
        combatRng: zeroOffsetRng(),
        nowMs: clock.now,
      });
      const client = await colyseus.connectTo(room);
      const player = room.state.players.get(client.sessionId)!;
      const gremlin = findMobByNpcId(room, 20001)!;
      placePlayerAndMobForCombat(room, client.sessionId, gremlin);

      expect(player.action).toBe(0);
      expect(player.actionSeq).toBe(0);

      await deliverAndTick(room, client, [
        ['setTarget', { mobId: gremlin.id }],
        ['attack', {}],
      ]);

      expect(player.action).toBe(1);
      expect(player.actionSeq).toBe(1);

      clock.advance(1700);
      await deliverAndTick(room, client, [['attack', {}]]);

      expect(player.action).toBe(1);
      expect(player.actionSeq).toBe(2);

      await client.leave();
    } finally {
      cleanup();
    }
  });

  it('sets mob ATTACK action and increments actionSeq on confirmed mob melee', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await colyseus.createRoom('town', { dbPath, combatRng: zeroOffsetRng() });
      const client = await colyseus.connectTo(room);
      const goblin = findMobByNpcId(room, 20003)!;
      placePlayerAndMobForCombat(room, client.sessionId, goblin);
      const mobState = room.state.mobs.get(goblin.id)!;

      expect(mobState.action).toBe(0);
      expect(mobState.actionSeq).toBe(0);

      const runtime = room['mobRuntime'].get(goblin.id)!;
      runtime.targetSessionId = client.sessionId;
      runtime.nextAttackAtMs = 0;
      tick(room);

      expect(mobState.action).toBe(EntityAction.Attack);
      expect(mobState.actionSeq).toBe(1);

      runtime.nextAttackAtMs = 0;
      tick(room);
      expect(mobState.action).toBe(EntityAction.Attack);
      expect(mobState.actionSeq).toBe(2);

      await client.leave();
    } finally {
      cleanup();
    }
  });

  it('sets Orc ATTACK action and increments actionSeq on confirmed mob melee', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await colyseus.createRoom('town', { dbPath, combatRng: zeroOffsetRng() });
      const client = await colyseus.connectTo(room);
      const orc = findMobByNpcId(room, 20130)!;
      placePlayerAndMobForCombat(room, client.sessionId, orc);
      const mobState = room.state.mobs.get(orc.id)!;

      expect(mobState.action).toBe(0);
      expect(mobState.actionSeq).toBe(0);

      const runtime = room['mobRuntime'].get(orc.id)!;
      runtime.targetSessionId = client.sessionId;
      runtime.nextAttackAtMs = 0;
      tick(room);

      expect(mobState.action).toBe(EntityAction.Attack);
      expect(mobState.actionSeq).toBe(1);

      runtime.nextAttackAtMs = 0;
      tick(room);
      expect(mobState.action).toBe(EntityAction.Attack);
      expect(mobState.actionSeq).toBe(2);

      await client.leave();
    } finally {
      cleanup();
    }
  });

  it('emits Orc DIE on MobState before removal', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    const clock = createFakeClock(0);
    try {
      const room = await colyseus.createRoom('town', {
        dbPath,
        combatRng: zeroOffsetRng(),
        nowMs: clock.now,
      });
      const client = await colyseus.connectTo(room);
      const orc = findMobByNpcId(room, 20130)!;
      placePlayerAndMobForCombat(room, client.sessionId, orc);
      const mobId = orc.id;
      let dieObservedBeforeDelete = false;

      const mobMap = room.state.mobs;
      const originalDelete = mobMap.delete.bind(mobMap);
      vi.spyOn(mobMap, 'delete').mockImplementation((id: string) => {
        if (id === mobId) {
          const state = mobMap.get(id);
          dieObservedBeforeDelete =
            state?.action === EntityAction.Die && (state?.actionSeq ?? 0) > 0;
        }
        return originalDelete(id);
      });

      await deliver(room, client, [['setTarget', { mobId }]]);
      while (room.state.mobs.has(mobId)) {
        const combat = room['playerCombat'].get(client.sessionId)!;
        combat.nextAttackAtMs = 0;
        await deliverAndTick(room, client, [['attack', {}]]);
      }

      expect(dieObservedBeforeDelete).toBe(true);
      await client.leave();
    } finally {
      cleanup();
    }
  });

  it('attack in range reduces Gremlin HP by 17', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await colyseus.createRoom('town', { dbPath, combatRng: zeroOffsetRng() });
      const client = await colyseus.connectTo(room);
      const gremlin = findMobByNpcId(room, 20001)!;
      placePlayerAndMobForCombat(room, client.sessionId, gremlin);
      const hpBefore = room.state.mobs.get(gremlin.id)!.hp;

      await deliverAndTick(room, client, [
        ['setTarget', { mobId: gremlin.id }],
        ['attack', {}],
      ]);

      const gremlinAfter = room.state.mobs.get(gremlin.id)!;
      expect(hpBefore - gremlinAfter.hp).toBeCloseTo(17, 3);

      await client.leave();
    } finally {
      cleanup();
    }
  });

  it('attack out of range does not reduce mob HP', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await colyseus.createRoom('town', { dbPath, combatRng: zeroOffsetRng() });
      const client = await colyseus.connectTo(room);
      const gremlin = findMobByNpcId(room, 20001)!;
      relocateMob(room, gremlin.id, OUT_OF_PEACE.x, OUT_OF_PEACE.z);
      placePlayerNear(room, client.sessionId, OUT_OF_PEACE.x + 20, OUT_OF_PEACE.z);
      const hpBefore = room.state.mobs.get(gremlin.id)!.hp;

      await deliverAndTick(room, client, [
        ['setTarget', { mobId: gremlin.id }],
        ['attack', {}],
      ]);

      expect(room.state.mobs.get(gremlin.id)!.hp).toBeCloseTo(hpBefore, 3);
      await client.leave();
    } finally {
      cleanup();
    }
  });

  async function killGremlin(
    room: Awaited<ReturnType<ColyseusTestServer['createRoom']>>,
    client: Awaited<ReturnType<ColyseusTestServer['connectTo']>>
  ) {
    const gremlin = findMobByNpcId(room, 20001)!;
    placePlayerAndMobForCombat(room, client.sessionId, gremlin);

    await deliver(room, client, [['setTarget', { mobId: gremlin.id }]]);

    while (room.state.mobs.has(gremlin.id)) {
      const combat = room['playerCombat'].get(client.sessionId)!;
      combat.nextAttackAtMs = 0;
      await deliverAndTick(room, client, [['attack', {}]]);
    }
  }

  it('emits mob DIE on MobState before removal and respawn resets action fields', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    const clock = createFakeClock(0);
    try {
      const room = await colyseus.createRoom('town', {
        dbPath,
        combatRng: zeroOffsetRng(),
        nowMs: clock.now,
      });
      const client = await colyseus.connectTo(room);
      const goblin = findMobByNpcId(room, 20003)!;
      placePlayerAndMobForCombat(room, client.sessionId, goblin);
      const mobId = goblin.id;
      let dieObservedBeforeDelete = false;

      const mobMap = room.state.mobs;
      const originalDelete = mobMap.delete.bind(mobMap);
      vi.spyOn(mobMap, 'delete').mockImplementation((id: string) => {
        if (id === mobId) {
          const state = mobMap.get(id);
          dieObservedBeforeDelete =
            state?.action === EntityAction.Die && (state?.actionSeq ?? 0) > 0;
        }
        return originalDelete(id);
      });

      await deliver(room, client, [['setTarget', { mobId }]]);
      while (room.state.mobs.has(mobId)) {
        const combat = room['playerCombat'].get(client.sessionId)!;
        combat.nextAttackAtMs = 0;
        await deliverAndTick(room, client, [['attack', {}]]);
      }

      expect(dieObservedBeforeDelete).toBe(true);

      const runtime = room['mobRuntime'];
      const pending = room['pendingRespawns'].get(mobId)!;
      clock.advance(pending.runtime.respawnSec * 1000 + 1);
      tick(room);

      const respawned = room.state.mobs.get(mobId)!;
      expect(respawned.action).toBe(0);
      expect(respawned.actionSeq).toBe(0);
      expect(runtime.has(mobId)).toBe(true);

      await client.leave();
    } finally {
      cleanup();
    }
  });

  it('kill grants xp=44', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await colyseus.createRoom('town', { dbPath, combatRng: zeroOffsetRng() });
      const client = await colyseus.connectTo(room);
      const player = room.state.players.get(client.sessionId)!;

      await killGremlin(room, client);

      expect(player.xp).toBe(44);
      expect(player.level).toBe(1);
      await client.leave();
    } finally {
      cleanup();
    }
  });

  it('second kill levels to 2 at cumulative xp=88', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await colyseus.createRoom('town', { dbPath, combatRng: zeroOffsetRng() });
      const client = await colyseus.connectTo(room);
      const player = room.state.players.get(client.sessionId)!;

      await killGremlin(room, client);
      await killGremlin(room, client);

      expect(player.xp).toBe(88);
      expect(player.level).toBe(2);
      await client.leave();
    } finally {
      cleanup();
    }
  });

  it('persists XP to DB on kill', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await colyseus.createRoom('town', { dbPath, combatRng: zeroOffsetRng() });
      const client = await colyseus.sdk.joinById(room.roomId, {}, TownState);
      const characterId = await client.waitForMessage('characterId');

      await killGremlin(room, client);

      const row = loadCharacter(getDb(dbPath), characterId);
      expect(row!.xp).toBe(44);
      expect(row!.level).toBe(1);
      await client.leave();
    } finally {
      cleanup();
    }
  });

  it('mob respawns after 27 seconds', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    const clock = createFakeClock(0);
    try {
      const room = await colyseus.createRoom('town', {
        dbPath,
        combatRng: zeroOffsetRng(),
        nowMs: clock.now,
      });
      const client = await colyseus.connectTo(room);
      const gremlin = findMobByNpcId(room, 20001)!;
      const gremlinId = gremlin.id;

      await killGremlin(room, client);
      expect(room.state.mobs.has(gremlinId)).toBe(false);

      clock.advance(26_999);
      tick(room);
      expect(room.state.mobs.has(gremlinId)).toBe(false);

      clock.advance(1);
      tick(room);
      expect(room.state.mobs.has(gremlinId)).toBe(true);
      expect(room.state.mobs.get(gremlinId)!.hp).toBeCloseTo(41.145, 3);

      await client.leave();
    } finally {
      cleanup();
    }
  });

  it('aggressive Goblin acquires player within 45 units', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await colyseus.createRoom('town', { dbPath, combatRng: zeroOffsetRng() });
      const client = await colyseus.connectTo(room);
      const goblin = findMobByNpcId(room, 20003)!;
      placePlayerNear(room, client.sessionId, goblin.x + 40, goblin.z);

      tick(room);

      const runtime = room['mobRuntime'].get(goblin.id)!;
      expect(runtime.targetSessionId).toBe(client.sessionId);
      await client.leave();
    } finally {
      cleanup();
    }
  });

  it('passive Gremlin only retaliates after being damaged', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await colyseus.createRoom('town', { dbPath, combatRng: zeroOffsetRng() });
      const client = await colyseus.connectTo(room);
      const gremlin = findMobByNpcId(room, 20001)!;
      placePlayerNear(room, client.sessionId, gremlin.x + 5, gremlin.z);
      relocateMob(room, gremlin.id, OUT_OF_PEACE.x, OUT_OF_PEACE.z);

      tick(room);
      let runtime = room['mobRuntime'].get(gremlin.id)!;
      expect(runtime.targetSessionId).toBeNull();

      placePlayerAndMobForCombat(room, client.sessionId, gremlin);
      await deliverAndTick(room, client, [
        ['setTarget', { mobId: gremlin.id }],
        ['attack', {}],
      ]);

      runtime = room['mobRuntime'].get(gremlin.id)!;
      expect(runtime.wasDamaged).toBe(true);

      tick(room);
      runtime = room['mobRuntime'].get(gremlin.id)!;
      expect(runtime.targetSessionId).toBe(client.sessionId);
      await client.leave();
    } finally {
      cleanup();
    }
  });
  it('sets DIE action before respawn restores HP and position', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await colyseus.createRoom('town', { dbPath, combatRng: zeroOffsetRng() });
      const client = await colyseus.connectTo(room);
      const player = room.state.players.get(client.sessionId)!;

      let hpWhenDieEmitted: number | undefined;
      const roomInternals = room as unknown as {
        emitPlayerAction: (p: typeof player, action: EntityAction) => void;
      };
      const originalEmit = roomInternals.emitPlayerAction.bind(roomInternals);
      vi.spyOn(roomInternals, 'emitPlayerAction').mockImplementation((p, action) => {
        if (action === EntityAction.Die) hpWhenDieEmitted = p.hp;
        originalEmit(p, action);
      });

      player.hp = 0;
      tick(room);

      expect(hpWhenDieEmitted).toBe(0);
      expect(player.action).toBe(EntityAction.Die);
      expect(player.actionSeq).toBe(1);
      expect(player.hp).toBe(100);
      expect(player.x).toBe(SPAWN_X);
      expect(player.z).toBe(SPAWN_Z);

      await client.leave();
    } finally {
      cleanup();
    }
  });
});

describe('TownRoom Power Strike', () => {
  async function castPowerStrike(
    client: Awaited<ReturnType<ColyseusTestServer['connectTo']>>,
    room: Awaited<ReturnType<ColyseusTestServer['createRoom']>>,
    mobId: string
  ) {
    await deliverAndTick(room, client, [
      ['setTarget', { mobId }],
      ['useSkill', { skillId: 3 }],
    ]);
  }

  it('sets CAST action and increments actionSeq on Power Strike resolve', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await colyseus.createRoom('town', {
        dbPath,
        combatRng: zeroOffsetRng(),
      });
      const client = await colyseus.connectTo(room);
      const player = room.state.players.get(client.sessionId)!;
      const gremlin = findMobByNpcId(room, 20001)!;
      placePlayerAndMobForCombat(room, client.sessionId, gremlin);

      expect(player.action).toBe(0);
      expect(player.actionSeq).toBe(0);

      await castPowerStrike(client, room, gremlin.id);

      expect(player.action).toBe(2);
      expect(player.actionSeq).toBe(1);
      expect(player.mp).toBe(41);

      await client.leave();
    } finally {
      cleanup();
    }
  });

  it('useSkill in range deals 69 damage and reduces MP from 50 to 41', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await colyseus.createRoom('town', {
        dbPath,
        combatRng: zeroOffsetRng(),
      });
      const client = await colyseus.connectTo(room);
      const player = room.state.players.get(client.sessionId)!;
      const gremlin = findMobByNpcId(room, 20001)!;
      placePlayerAndMobForCombat(room, client.sessionId, gremlin);

      await castPowerStrike(client, room, gremlin.id);

      expect(player.mp).toBe(41);
      expect(room.state.mobs.has(gremlin.id)).toBe(false);
      expect(player.xp).toBe(44);
      await client.leave();
    } finally {
      cleanup();
    }
  });

  it('useSkill at 4.1 m does not change mob HP or player MP', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await colyseus.createRoom('town', {
        dbPath,
        combatRng: zeroOffsetRng(),
      });
      const client = await colyseus.connectTo(room);
      const player = room.state.players.get(client.sessionId)!;
      const gremlin = findMobByNpcId(room, 20001)!;
      relocateMob(room, gremlin.id, OUT_OF_PEACE.x, OUT_OF_PEACE.z);
      placePlayerNear(room, client.sessionId, OUT_OF_PEACE.x + 4.1, OUT_OF_PEACE.z);
      const hpBefore = room.state.mobs.get(gremlin.id)!.hp;
      const mpBefore = player.mp;

      await castPowerStrike(client, room, gremlin.id);

      expect(room.state.mobs.get(gremlin.id)!.hp).toBeCloseTo(hpBefore, 3);
      expect(player.mp).toBe(mpBefore);
      await client.leave();
    } finally {
      cleanup();
    }
  });

  it('useSkill at 3.9 m succeeds', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await colyseus.createRoom('town', {
        dbPath,
        combatRng: zeroOffsetRng(),
      });
      const client = await colyseus.connectTo(room);
      const player = room.state.players.get(client.sessionId)!;
      const gremlin = findMobByNpcId(room, 20001)!;
      relocateMob(room, gremlin.id, OUT_OF_PEACE.x, OUT_OF_PEACE.z);
      placePlayerNear(room, client.sessionId, OUT_OF_PEACE.x + 3.9, OUT_OF_PEACE.z);

      await castPowerStrike(client, room, gremlin.id);

      expect(player.mp).toBe(41);
      expect(room.state.mobs.has(gremlin.id)).toBe(false);
      await client.leave();
    } finally {
      cleanup();
    }
  });

  it('useSkill rejects when player MP is below 9', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await colyseus.createRoom('town', {
        dbPath,
        combatRng: zeroOffsetRng(),
      });
      const client = await colyseus.connectTo(room);
      const player = room.state.players.get(client.sessionId)!;
      player.mp = 8;
      const gremlin = findMobByNpcId(room, 20001)!;
      placePlayerAndMobForCombat(room, client.sessionId, gremlin);
      const hpBefore = room.state.mobs.get(gremlin.id)!.hp;

      await castPowerStrike(client, room, gremlin.id);

      expect(player.mp).toBe(8);
      expect(room.state.mobs.get(gremlin.id)!.hp).toBeCloseTo(hpBefore, 3);
      await client.leave();
    } finally {
      cleanup();
    }
  });

  it('sets powerStrikeCooldownEndMs to nowMs + 3000 on success', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    const clock = createFakeClock(5000);
    try {
      const room = await colyseus.createRoom('town', {
        dbPath,
        combatRng: zeroOffsetRng(),
        nowMs: clock.now,
      });
      const client = await colyseus.connectTo(room);
      const player = room.state.players.get(client.sessionId)!;
      const gremlin = findMobByNpcId(room, 20001)!;
      placePlayerAndMobForCombat(room, client.sessionId, gremlin);

      await castPowerStrike(client, room, gremlin.id);

      expect(player.powerStrikeCooldownEndMs).toBe(8000);
      await client.leave();
    } finally {
      cleanup();
    }
  });

  it('rejects second useSkill at t+2999 and accepts at t+3000', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    const clock = createFakeClock(1000);
    try {
      const room = await colyseus.createRoom('town', {
        dbPath,
        combatRng: zeroOffsetRng(),
        nowMs: clock.now,
      });
      const client = await colyseus.connectTo(room);
      const player = room.state.players.get(client.sessionId)!;
      const gremlin = findMobByNpcId(room, 20001)!;
      placePlayerAndMobForCombat(room, client.sessionId, gremlin);
      const gremlinRuntime = room['mobRuntime'].get(gremlin.id)!;
      gremlinRuntime.hp = 500;
      gremlinRuntime.maxHp = 500;
      room.state.mobs.get(gremlin.id)!.hp = 500;

      await castPowerStrike(client, room, gremlin.id);
      const hpAfterFirst = room.state.mobs.get(gremlin.id)!.hp;
      expect(player.mp).toBe(41);

      clock.advance(2999);
      await castPowerStrike(client, room, gremlin.id);
      expect(room.state.mobs.get(gremlin.id)!.hp).toBeCloseTo(hpAfterFirst, 3);
      expect(player.mp).toBe(41);

      clock.advance(1);
      await castPowerStrike(client, room, gremlin.id);
      expect(player.mp).toBe(32);
      const gremlinAfter = room.state.mobs.get(gremlin.id)!;
      expect(hpAfterFirst - gremlinAfter.hp).toBeCloseTo(69, 3);
      await client.leave();
    } finally {
      cleanup();
    }
  });

  it('ignores useSkill without target, on dead mob, and unknown skillId', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await colyseus.createRoom('town', {
        dbPath,
        combatRng: zeroOffsetRng(),
      });
      const client = await colyseus.connectTo(room);
      const player = room.state.players.get(client.sessionId)!;
      const gremlin = findMobByNpcId(room, 20001)!;
      placePlayerAndMobForCombat(room, client.sessionId, gremlin);
      const hpBefore = room.state.mobs.get(gremlin.id)!.hp;
      const mpBefore = player.mp;

      await deliverAndTick(room, client, [['useSkill', { skillId: 3 }]]);
      expect(player.mp).toBe(mpBefore);
      expect(gremlin.hp).toBeCloseTo(hpBefore, 3);

      await deliverAndTick(room, client, [
        ['setTarget', { mobId: gremlin.id }],
        ['useSkill', { skillId: 99 }],
      ]);
      expect(player.mp).toBe(mpBefore);

      while (room.state.mobs.has(gremlin.id)) {
        const combat = room['playerCombat'].get(client.sessionId)!;
        combat.nextAttackAtMs = 0;
        await deliverAndTick(room, client, [['attack', {}]]);
      }

      await deliverAndTick(room, client, [
        ['setTarget', { mobId: gremlin.id }],
        ['useSkill', { skillId: 3 }],
      ]);
      expect(player.mp).toBe(mpBefore);

      await client.leave();
    } finally {
      cleanup();
    }
  });
});

describe('TownRoom NPC shop and peace zone', () => {
  const KATERINA = 30004;
  const ROXXY = 30006;
  const LECTOR = 30001;
  const POTION = 1060;
  const SHORT_SWORD = 1;

  it('boots with 7 NPCs in state.npcs from seed', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await colyseus.createRoom('town', { dbPath });
      expect(room.state.npcs.size).toBe(7);
      expect(findNpcByNpcId(room, KATERINA)).toMatchObject({ npcId: KATERINA });
      expect(findNpcByNpcId(room, ROXXY)).toMatchObject({ npcId: ROXXY });
      expect(findNpcByNpcId(room, LECTOR)).toMatchObject({ npcId: LECTOR });
      await room.disconnect();
    } finally {
      cleanup();
    }
  });

  it('buy 1× Short Sword at Lector drops adena 1000→117 (TINPC-22)', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await colyseus.createRoom('town', { dbPath });
      const client = await colyseus.sdk.joinById(room.roomId, {}, TownState);
      const player = room.state.players.get(client.sessionId)!;
      placePlayerAtNpc(room, client.sessionId, LECTOR);

      await deliver(room, client, [
        ['buy', { npcId: LECTOR, itemId: SHORT_SWORD, quantity: 1 }],
      ]);

      expect(player.adena).toBe(117);
      expect(getPlayerItemCount(room, client.sessionId, SHORT_SWORD)).toBe(1);
      await client.leave();
    } finally {
      cleanup();
    }
  });

  it('rejects Lector buy from 3.1 m away (TINPC-23)', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await colyseus.createRoom('town', { dbPath });
      const client = await colyseus.connectTo(room);
      const player = room.state.players.get(client.sessionId)!;
      placePlayerNearNpcOffset(room, client.sessionId, LECTOR, 3.1);

      await deliver(room, client, [
        ['buy', { npcId: LECTOR, itemId: SHORT_SWORD, quantity: 1 }],
      ]);

      expect(player.adena).toBe(1000);
      expect(getPlayerItemCount(room, client.sessionId, SHORT_SWORD)).toBe(0);
      await client.leave();
    } finally {
      cleanup();
    }
  });

  it('buy 1× Healing Potion drops adena 1000→897 and grants item 1060', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await colyseus.createRoom('town', { dbPath });
      const client = await colyseus.sdk.joinById(room.roomId, {}, TownState);
      const player = room.state.players.get(client.sessionId)!;
      placePlayerAtNpc(room, client.sessionId, KATERINA);

      await deliver(room, client, [
        ['buy', { npcId: KATERINA, itemId: POTION, quantity: 1 }],
      ]);

      expect(player.adena).toBe(897);
      expect(getPlayerItemCount(room, client.sessionId, POTION)).toBe(1);
      await client.leave();
    } finally {
      cleanup();
    }
  });

  it('rejects buy from 3.1 m away from Katerina', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await colyseus.createRoom('town', { dbPath });
      const client = await colyseus.connectTo(room);
      const player = room.state.players.get(client.sessionId)!;
      placePlayerNearNpcOffset(room, client.sessionId, KATERINA, 3.1);

      await deliver(room, client, [
        ['buy', { npcId: KATERINA, itemId: POTION, quantity: 1 }],
      ]);

      expect(player.adena).toBe(1000);
      expect(getPlayerItemCount(room, client.sessionId, POTION)).toBe(0);
      await client.leave();
    } finally {
      cleanup();
    }
  });

  it('rejects buy when adena is insufficient', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await colyseus.createRoom('town', { dbPath });
      const client = await colyseus.connectTo(room);
      const player = room.state.players.get(client.sessionId)!;
      player.adena = 50;
      placePlayerAtNpc(room, client.sessionId, KATERINA);

      await deliver(room, client, [
        ['buy', { npcId: KATERINA, itemId: POTION, quantity: 1 }],
      ]);

      expect(player.adena).toBe(50);
      expect(getPlayerItemCount(room, client.sessionId, POTION)).toBe(0);
      await client.leave();
    } finally {
      cleanup();
    }
  });

  it('accepts interact with Roxxy within 3.0 m', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await colyseus.createRoom('town', { dbPath });
      const client = await colyseus.sdk.joinById(room.roomId, {}, TownState);
      placePlayerAtNpc(room, client.sessionId, ROXXY);

      client.send('interact', { npcId: ROXXY });
      const result = await client.waitForMessage('interactResult');

      expect(result).toMatchObject({
        npcId: ROXXY,
        name: 'Roxxy',
        type: 'Teleporter',
      });
      await client.leave();
    } finally {
      cleanup();
    }
  });

  it('rejects interact from 3.1 m away from Roxxy', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await colyseus.createRoom('town', { dbPath });
      const client = await colyseus.connectTo(room);
      placePlayerNearNpcOffset(room, client.sessionId, ROXXY, 3.1);

      let received = false;
      client.onMessage('interactResult', () => {
        received = true;
      });
      await deliver(room, client, [['interact', { npcId: ROXXY }]]);

      expect(received).toBe(false);
      await client.leave();
    } finally {
      cleanup();
    }
  });

  it('sell 1× potion adds adena 897→948', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await colyseus.createRoom('town', { dbPath });
      const client = await colyseus.sdk.joinById(room.roomId, {}, TownState);
      const player = room.state.players.get(client.sessionId)!;
      placePlayerAtNpc(room, client.sessionId, KATERINA);

      await deliver(room, client, [
        ['buy', { npcId: KATERINA, itemId: POTION, quantity: 1 }],
      ]);
      expect(player.adena).toBe(897);
      room['playerItems'].set(client.sessionId, { [POTION]: 2 });
      room['syncItemsToPlayerState'](client.sessionId);

      await deliver(room, client, [
        ['sell', { npcId: KATERINA, itemId: POTION, quantity: 1 }],
      ]);

      expect(player.adena).toBe(948);
      expect(getPlayerItemCount(room, client.sessionId, POTION)).toBe(1);
      await client.leave();
    } finally {
      cleanup();
    }
  });

  it('heal restores hp from 40 to 100 near Roxxy', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await colyseus.createRoom('town', { dbPath });
      const client = await colyseus.sdk.joinById(room.roomId, {}, TownState);
      const player = room.state.players.get(client.sessionId)!;
      player.hp = 40;
      placePlayerAtNpc(room, client.sessionId, ROXXY);

      await deliver(room, client, [['npcAction', { npcId: ROXXY, action: 'heal' }]]);

      expect(player.hp).toBe(100);
      await client.leave();
    } finally {
      cleanup();
    }
  });

  it('starter kit grants 3× potion once', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await colyseus.createRoom('town', { dbPath });
      const client = await colyseus.sdk.joinById(room.roomId, {}, TownState);
      placePlayerAtNpc(room, client.sessionId, ROXXY);

      await deliver(room, client, [
        ['npcAction', { npcId: ROXXY, action: 'starterKit' }],
      ]);

      expect(getPlayerItemCount(room, client.sessionId, POTION)).toBe(3);
      const characterId = room['characterIds'].get(client.sessionId)!;
      await client.leave(true);
      expect(loadCharacter(getDb(dbPath), characterId)!.starterKitGranted).toBe(true);
    } finally {
      cleanup();
    }
  });

  it('starter kit does not grant items a second time', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await colyseus.createRoom('town', { dbPath });
      const client = await colyseus.sdk.joinById(room.roomId, {}, TownState);
      placePlayerAtNpc(room, client.sessionId, ROXXY);

      await deliver(room, client, [
        ['npcAction', { npcId: ROXXY, action: 'starterKit' }],
      ]);
      await deliver(room, client, [
        ['npcAction', { npcId: ROXXY, action: 'starterKit' }],
      ]);

      expect(getPlayerItemCount(room, client.sessionId, POTION)).toBe(3);
      await client.leave();
    } finally {
      cleanup();
    }
  });

  it('persists buy adena and items on leave', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await colyseus.createRoom('town', { dbPath });
      const client = await colyseus.sdk.joinById(room.roomId, {}, TownState);
      const characterId = await client.waitForMessage('characterId');
      placePlayerAtNpc(room, client.sessionId, KATERINA);

      await deliver(room, client, [
        ['buy', { npcId: KATERINA, itemId: POTION, quantity: 1 }],
      ]);
      await client.leave(true);

      expect(loadCharacter(getDb(dbPath), characterId)!.adena).toBe(897);
      expect(loadCharacterItems(getDb(dbPath), characterId)[POTION]).toBe(1);
    } finally {
      cleanup();
    }
  });

  it('attack inside peace zone deals no damage', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await colyseus.createRoom('town', { dbPath, combatRng: zeroOffsetRng() });
      const client = await colyseus.connectTo(room);
      const gremlin = findMobByNpcId(room, 20001)!;
      relocateMob(room, gremlin.id, 0, 0);
      placePlayerNear(room, client.sessionId, 0, 0);
      const hpBefore = room.state.mobs.get(gremlin.id)!.hp;

      await deliverAndTick(room, client, [
        ['setTarget', { mobId: gremlin.id }],
        ['attack', {}],
      ]);

      expect(room.state.mobs.get(gremlin.id)!.hp).toBeCloseTo(hpBefore, 3);
      await client.leave();
    } finally {
      cleanup();
    }
  });

  it('useSkill inside peace zone deals no damage and costs no MP', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await colyseus.createRoom('town', { dbPath, combatRng: zeroOffsetRng() });
      const client = await colyseus.connectTo(room);
      const player = room.state.players.get(client.sessionId)!;
      const gremlin = findMobByNpcId(room, 20001)!;
      relocateMob(room, gremlin.id, 0, 0);
      placePlayerNear(room, client.sessionId, 0, 0);
      const hpBefore = room.state.mobs.get(gremlin.id)!.hp;

      await deliverAndTick(room, client, [
        ['setTarget', { mobId: gremlin.id }],
        ['useSkill', { skillId: 3 }],
      ]);

      expect(room.state.mobs.get(gremlin.id)!.hp).toBeCloseTo(hpBefore, 3);
      expect(player.mp).toBe(50);
      await client.leave();
    } finally {
      cleanup();
    }
  });

  it('mob attack inside peace zone deals no player damage', async () => {
    const tickSpy = vi.spyOn(mobAi, 'tickMobAi').mockImplementation(() => {
      /* keep mob target for peace-zone mob-attack room test */
    });
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await colyseus.createRoom('town', {
        dbPath,
        combatRng: zeroOffsetRng(),
        nowMs: () => 0,
      });
      const client = await colyseus.connectTo(room);
      const player = room.state.players.get(client.sessionId)!;
      const gremlin = findMobByNpcId(room, 20001)!;
      relocateMob(room, gremlin.id, 0, 0);
      placePlayerNear(room, client.sessionId, 0, 0);

      const runtime = room['mobRuntime'].get(gremlin.id)!;
      runtime.targetSessionId = client.sessionId;
      runtime.nextAttackAtMs = 0;

      const hpBefore = player.hp;
      tick(room);

      expect(player.hp).toBe(hpBefore);
      await client.leave();
    } finally {
      tickSpy.mockRestore();
      cleanup();
    }
  });
});

const ROXXY_NPC = 30006;
const SQUIRES_SWORD = 2369;
const HEALING_POTION = 1060;

async function claimStarterKit(
  room: TestRoom,
  client: TestClient,
  sessionId: string
): Promise<void> {
  placePlayerAtNpc(room, sessionId, ROXXY_NPC);
  await deliver(room, client, [
    ['npcAction', { npcId: ROXXY_NPC, action: 'starterKit' }],
  ]);
}

describe('TownRoom equip', () => {
  it('equipping Squire\'s Sword then melee deals 27 damage to Gremlin', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await colyseus.createRoom('town', { dbPath, combatRng: zeroOffsetRng() });
      const client = await colyseus.connectTo(room);
      await claimStarterKit(room, client, client.sessionId);

      await deliver(room, client, [['equip', { itemId: SQUIRES_SWORD }]]);
      expect(room.state.players.get(client.sessionId)!.equippedWeaponItemId).toBe(
        SQUIRES_SWORD
      );

      const gremlin = findMobByNpcId(room, 20001)!;
      placePlayerAndMobForCombat(room, client.sessionId, gremlin);
      const hpBefore = room.state.mobs.get(gremlin.id)!.hp;

      await deliverAndTick(room, client, [
        ['setTarget', { mobId: gremlin.id }],
        ['attack', {}],
      ]);

      expect(hpBefore - room.state.mobs.get(gremlin.id)!.hp).toBeCloseTo(27, 3);
      await client.leave();
    } finally {
      cleanup();
    }
  });

  it('rejects equipping a consumable (item 1060)', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await colyseus.createRoom('town', { dbPath });
      const client = await colyseus.connectTo(room);
      await claimStarterKit(room, client, client.sessionId);
      const player = room.state.players.get(client.sessionId)!;

      await deliver(room, client, [['equip', { itemId: HEALING_POTION }]]);

      expect(player.equippedWeaponItemId).toBe(0);
      await client.leave();
    } finally {
      cleanup();
    }
  });

  it('rejects equipping Squire\'s Sword without owning it', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await colyseus.createRoom('town', { dbPath });
      const client = await colyseus.connectTo(room);
      const player = room.state.players.get(client.sessionId)!;

      await deliver(room, client, [['equip', { itemId: SQUIRES_SWORD }]]);

      expect(player.equippedWeaponItemId).toBe(0);
      await client.leave();
    } finally {
      cleanup();
    }
  });

  it('persists equipped weapon on reconnect', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await colyseus.createRoom('town', { dbPath });
      const client = await colyseus.sdk.joinById(room.roomId, {}, TownState);
      const characterId = await client.waitForMessage('characterId');
      await claimStarterKit(room, client, client.sessionId);

      await deliver(room, client, [['equip', { itemId: SQUIRES_SWORD }]]);
      await client.leave(true);
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(loadCharacter(getDb(dbPath), characterId)!.equippedWeaponItemId).toBe(
        SQUIRES_SWORD
      );

      const room2 = await colyseus.createRoom('town', { dbPath });
      const client2 = await colyseus.sdk.joinById(
        room2.roomId,
        { characterId },
        TownState
      );
      expect(room2.state.players.get(client2.sessionId)!.equippedWeaponItemId).toBe(
        SQUIRES_SWORD
      );
      await client2.leave();
    } finally {
      cleanup();
    }
  });

  it('debounced save persists equipped_weapon_item_id after equip', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await colyseus.createRoom('town', { dbPath, saveDebounceMs: 100 });
      const client = await colyseus.sdk.joinById(room.roomId, {}, TownState);
      const characterId = await client.waitForMessage('characterId');
      await claimStarterKit(room, client, client.sessionId);

      await deliver(room, client, [['equip', { itemId: SQUIRES_SWORD }]]);
      expect(loadCharacter(getDb(dbPath), characterId)!.equippedWeaponItemId).toBeNull();

      await new Promise((resolve) => setTimeout(resolve, 150));
      expect(loadCharacter(getDb(dbPath), characterId)!.equippedWeaponItemId).toBe(
        SQUIRES_SWORD
      );
      await client.leave();
    } finally {
      cleanup();
    }
  });
});

describe('TownRoom useItem', () => {
  const KATERINA = 30004;
  const ROXXY = 30006;

  function grantPotions(room: TestRoom, sessionId: string, count: number): void {
    room['playerItems'].set(sessionId, { [HEALING_POTION]: count });
    room['syncItemsToPlayerState'](sessionId);
  }

  it('heals 24 HP, decrements stack, and sets reuse cooldown on success', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    const clock = createFakeClock(2000);
    try {
      const room = await colyseus.createRoom('town', { dbPath, nowMs: clock.now });
      const client = await colyseus.connectTo(room);
      const player = room.state.players.get(client.sessionId)!;
      grantPotions(room, client.sessionId, 1);
      player.hp = 50;

      await deliver(room, client, [['useItem', { itemId: HEALING_POTION }]]);

      expect(player.hp).toBe(74);
      expect(getPlayerItemCount(room, client.sessionId, HEALING_POTION)).toBe(0);
      expect(player.healingPotionCooldownEndMs).toBe(12_000);
      await client.leave();
    } finally {
      cleanup();
    }
  });

  it('rejects useItem when potion count is 0', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await colyseus.createRoom('town', { dbPath });
      const client = await colyseus.connectTo(room);
      const player = room.state.players.get(client.sessionId)!;
      player.hp = 50;

      await deliver(room, client, [['useItem', { itemId: HEALING_POTION }]]);

      expect(player.hp).toBe(50);
      expect(getPlayerItemCount(room, client.sessionId, HEALING_POTION)).toBe(0);
      await client.leave();
    } finally {
      cleanup();
    }
  });

  it('rejects useItem for weapon item 2369', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await colyseus.createRoom('town', { dbPath });
      const client = await colyseus.connectTo(room);
      await claimStarterKit(room, client, client.sessionId);
      const player = room.state.players.get(client.sessionId)!;
      const hpBefore = player.hp;
      const swordBefore = getPlayerItemCount(room, client.sessionId, SQUIRES_SWORD);

      await deliver(room, client, [['useItem', { itemId: SQUIRES_SWORD }]]);

      expect(player.hp).toBe(hpBefore);
      expect(getPlayerItemCount(room, client.sessionId, SQUIRES_SWORD)).toBe(swordBefore);
      await client.leave();
    } finally {
      cleanup();
    }
  });

  it('rejects second useItem at t+9999 and accepts at t+10000', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    const clock = createFakeClock(1000);
    try {
      const room = await colyseus.createRoom('town', { dbPath, nowMs: clock.now });
      const client = await colyseus.connectTo(room);
      const player = room.state.players.get(client.sessionId)!;
      grantPotions(room, client.sessionId, 2);
      player.hp = 50;

      await deliver(room, client, [['useItem', { itemId: HEALING_POTION }]]);
      expect(player.hp).toBe(74);
      expect(getPlayerItemCount(room, client.sessionId, HEALING_POTION)).toBe(1);

      clock.advance(9999);
      await deliver(room, client, [['useItem', { itemId: HEALING_POTION }]]);
      expect(player.hp).toBe(74);
      expect(getPlayerItemCount(room, client.sessionId, HEALING_POTION)).toBe(1);

      clock.advance(1);
      await deliver(room, client, [['useItem', { itemId: HEALING_POTION }]]);
      expect(player.hp).toBe(98);
      expect(getPlayerItemCount(room, client.sessionId, HEALING_POTION)).toBe(0);
      await client.leave();
    } finally {
      cleanup();
    }
  });

  it('allows potion use inside peace zone', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await colyseus.createRoom('town', { dbPath });
      const client = await colyseus.connectTo(room);
      const player = room.state.players.get(client.sessionId)!;
      grantPotions(room, client.sessionId, 1);
      placePlayerNear(room, client.sessionId, 0, 0);
      player.hp = 80;

      await deliver(room, client, [['useItem', { itemId: HEALING_POTION }]]);

      expect(player.hp).toBe(100);
      expect(getPlayerItemCount(room, client.sessionId, HEALING_POTION)).toBe(0);
      await client.leave();
    } finally {
      cleanup();
    }
  });

  it('persists hp and potion count after useItem on reconnect', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await colyseus.createRoom('town', { dbPath });
      const client = await colyseus.sdk.joinById(room.roomId, {}, TownState);
      const characterId = await client.waitForMessage('characterId');
      const player = room.state.players.get(client.sessionId)!;
      grantPotions(room, client.sessionId, 1);
      player.hp = 50;

      await deliver(room, client, [['useItem', { itemId: HEALING_POTION }]]);
      await client.leave(true);

      expect(loadCharacter(getDb(dbPath), characterId)!.hp).toBe(74);
      expect(loadCharacterItems(getDb(dbPath), characterId)[HEALING_POTION]).toBeUndefined();

      const room2 = await colyseus.createRoom('town', { dbPath });
      const client2 = await colyseus.sdk.joinById(room2.roomId, { characterId }, TownState);
      const player2 = room2.state.players.get(client2.sessionId)!;
      expect(player2.hp).toBe(74);
      expect(getPlayerItemCount(room2, client2.sessionId, HEALING_POTION)).toBe(0);
      await client2.leave();
    } finally {
      cleanup();
    }
  });

  it('Roxxy heal still restores full HP after potion use', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await colyseus.createRoom('town', { dbPath });
      const client = await colyseus.connectTo(room);
      const player = room.state.players.get(client.sessionId)!;
      grantPotions(room, client.sessionId, 1);
      player.hp = 40;
      placePlayerAtNpc(room, client.sessionId, ROXXY);

      await deliver(room, client, [['useItem', { itemId: HEALING_POTION }]]);
      expect(player.hp).toBe(64);

      await deliver(room, client, [['npcAction', { npcId: ROXXY, action: 'heal' }]]);
      expect(player.hp).toBe(100);
      await client.leave();
    } finally {
      cleanup();
    }
  });

  it('Katerina buy 1× potion at 103 adena still works', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await colyseus.createRoom('town', { dbPath });
      const client = await colyseus.connectTo(room);
      const player = room.state.players.get(client.sessionId)!;
      placePlayerAtNpc(room, client.sessionId, KATERINA);

      await deliver(room, client, [
        ['buy', { npcId: KATERINA, itemId: HEALING_POTION, quantity: 1 }],
      ]);

      expect(player.adena).toBe(897);
      expect(getPlayerItemCount(room, client.sessionId, HEALING_POTION)).toBe(1);
      await client.leave();
    } finally {
      cleanup();
    }
  });

  it('rejects equipping Healing Potion (regression)', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await colyseus.createRoom('town', { dbPath });
      const client = await colyseus.connectTo(room);
      await claimStarterKit(room, client, client.sessionId);
      const player = room.state.players.get(client.sessionId)!;

      await deliver(room, client, [['equip', { itemId: HEALING_POTION }]]);

      expect(player.equippedWeaponItemId).toBe(0);
      await client.leave();
    } finally {
      cleanup();
    }
  });

  it('rejects useItem when player is dead', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await colyseus.createRoom('town', { dbPath });
      const client = await colyseus.connectTo(room);
      const player = room.state.players.get(client.sessionId)!;
      grantPotions(room, client.sessionId, 1);
      player.hp = 0;

      await deliver(room, client, [['useItem', { itemId: HEALING_POTION }]]);

      expect(player.hp).toBe(0);
      expect(getPlayerItemCount(room, client.sessionId, HEALING_POTION)).toBe(1);
      await client.leave();
    } finally {
      cleanup();
    }
  });
});

describe('TownRoom player death', () => {
  it('emits DIE before same-tick respawn restores HP after lethal mob hit (CHAR-08)', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await colyseus.createRoom('town', {
        dbPath,
        combatRng: zeroOffsetRng(),
        nowMs: () => 0,
      });
      const client = await colyseus.connectTo(room);
      const player = room.state.players.get(client.sessionId)!;
      const gremlin = findMobByNpcId(room, 20001)!;
      placePlayerAndMobForCombat(room, client.sessionId, gremlin);

      player.hp = 1;
      const runtime = room['mobRuntime'].get(gremlin.id)!;
      runtime.targetSessionId = client.sessionId;
      runtime.nextAttackAtMs = 0;

      let hpWhenDieEmitted: number | undefined;
      const roomInternals = room as unknown as {
        emitPlayerAction: (p: typeof player, action: EntityAction) => void;
      };
      const originalEmit = roomInternals.emitPlayerAction.bind(roomInternals);
      vi.spyOn(roomInternals, 'emitPlayerAction').mockImplementation((p, action) => {
        if (action === EntityAction.Die) hpWhenDieEmitted = p.hp;
        originalEmit(p, action);
      });

      tick(room);

      expect(hpWhenDieEmitted).toBe(0);
      expect(player.action).toBe(EntityAction.Die);
      expect(player.actionSeq).toBe(1);
      expect(player.hp).toBe(player.maxHp);
      expect(player.x).toBe(SPAWN_X);
      expect(player.z).toBe(SPAWN_Z);

      await client.leave();
    } finally {
      cleanup();
    }
  });

  it('mob kill respawns player at spawn with full HP and unchanged xp', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await colyseus.createRoom('town', {
        dbPath,
        combatRng: zeroOffsetRng(),
        nowMs: () => 0,
      });
      const client = await colyseus.connectTo(room);
      const player = room.state.players.get(client.sessionId)!;
      const gremlin = findMobByNpcId(room, 20001)!;
      placePlayerAndMobForCombat(room, client.sessionId, gremlin);

      player.xp = 44;
      room['characters'].get(client.sessionId)!.xp = 44;
      player.hp = 1;

      const runtime = room['mobRuntime'].get(gremlin.id)!;
      runtime.targetSessionId = client.sessionId;
      runtime.nextAttackAtMs = 0;

      tick(room);

      expect(player.hp).toBe(player.maxHp);
      expect(player.mp).toBe(player.maxMp);
      expect(player.x).toBe(SPAWN_X);
      expect(player.y).toBeCloseTo(SPAWN_Y, 5);
      expect(player.z).toBe(SPAWN_Z);
      expect(player.xp).toBe(44);
      await client.leave();
    } finally {
      cleanup();
    }
  });

  it('death clears player combat target and mob aggro', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await colyseus.createRoom('town', {
        dbPath,
        combatRng: zeroOffsetRng(),
        nowMs: () => 0,
      });
      const client = await colyseus.connectTo(room);
      const player = room.state.players.get(client.sessionId)!;
      const gremlin = findMobByNpcId(room, 20001)!;
      placePlayerAndMobForCombat(room, client.sessionId, gremlin);

      await deliver(room, client, [['setTarget', { mobId: gremlin.id }]]);
      const combat = room['playerCombat'].get(client.sessionId)!;
      expect(combat.targetMobId).toBe(gremlin.id);

      player.hp = 1;
      const runtime = room['mobRuntime'].get(gremlin.id)!;
      runtime.targetSessionId = client.sessionId;
      runtime.nextAttackAtMs = 0;
      tick(room);

      expect(combat.targetMobId).toBeNull();
      expect(runtime.targetSessionId).toBeNull();
      await client.leave();
    } finally {
      cleanup();
    }
  });

  it('persists respawn position and full HP on leave after death', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await colyseus.createRoom('town', {
        dbPath,
        combatRng: zeroOffsetRng(),
        nowMs: () => 0,
      });
      const client = await colyseus.sdk.joinById(room.roomId, {}, TownState);
      const characterId = await client.waitForMessage('characterId');
      const player = room.state.players.get(client.sessionId)!;
      const gremlin = findMobByNpcId(room, 20001)!;
      placePlayerAndMobForCombat(room, client.sessionId, gremlin);

      player.hp = 1;
      const runtime = room['mobRuntime'].get(gremlin.id)!;
      runtime.targetSessionId = client.sessionId;
      runtime.nextAttackAtMs = 0;
      tick(room);

      await client.leave(true);
      await new Promise((resolve) => setTimeout(resolve, 50));

      const row = loadCharacter(getDb(dbPath), characterId)!;
      expect(row.x).toBe(SPAWN_X);
      expect(row.z).toBe(SPAWN_Z);
      expect(row.hp).toBe(row.maxHp);
    } finally {
      cleanup();
    }
  });

  it('reconnect after death restores spawn position and full HP', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await colyseus.createRoom('town', {
        dbPath,
        combatRng: zeroOffsetRng(),
        nowMs: () => 0,
      });
      const client = await colyseus.sdk.joinById(room.roomId, {}, TownState);
      const characterId = await client.waitForMessage('characterId');
      const player = room.state.players.get(client.sessionId)!;
      const gremlin = findMobByNpcId(room, 20001)!;
      placePlayerAndMobForCombat(room, client.sessionId, gremlin);

      player.hp = 1;
      const runtime = room['mobRuntime'].get(gremlin.id)!;
      runtime.targetSessionId = client.sessionId;
      runtime.nextAttackAtMs = 0;
      tick(room);

      await client.leave(true);
      await new Promise((resolve) => setTimeout(resolve, 50));

      const room2 = await colyseus.createRoom('town', { dbPath });
      const client2 = await colyseus.sdk.joinById(
        room2.roomId,
        { characterId },
        TownState
      );
      const rejoined = room2.state.players.get(client2.sessionId)!;
      expect(rejoined.x).toBe(SPAWN_X);
      expect(rejoined.z).toBe(SPAWN_Z);
      expect(rejoined.hp).toBe(rejoined.maxHp);
      await client2.leave();
    } finally {
      cleanup();
    }
  });
});

describe('TownRoom level-up reward', () => {
  async function killGremlin(
    room: TestRoom,
    client: TestClient,
    sessionId: string
  ) {
    const gremlin = findMobByNpcId(room, 20001)!;
    placePlayerAndMobForCombat(room, sessionId, gremlin);

    await deliver(room, client, [['setTarget', { mobId: gremlin.id }]]);

    while (room.state.mobs.has(gremlin.id)) {
      const combat = room['playerCombat'].get(sessionId)!;
      combat.nextAttackAtMs = 0;
      await deliverAndTick(room, client, [['attack', {}]]);
    }
  }

  it('single Gremlin kill does not change maxHp or maxMp', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await colyseus.createRoom('town', { dbPath, combatRng: zeroOffsetRng() });
      const client = await colyseus.connectTo(room);
      const player = room.state.players.get(client.sessionId)!;

      await killGremlin(room, client, client.sessionId);

      expect(player.level).toBe(1);
      expect(player.xp).toBe(44);
      expect(player.maxHp).toBe(100);
      expect(player.maxMp).toBe(50);
      await client.leave();
    } finally {
      cleanup();
    }
  });

  it('two Gremlin kills reach level 2 with maxHp 112 and maxMp 55', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await colyseus.createRoom('town', { dbPath, combatRng: zeroOffsetRng() });
      const client = await colyseus.connectTo(room);
      const player = room.state.players.get(client.sessionId)!;

      await killGremlin(room, client, client.sessionId);
      await killGremlin(room, client, client.sessionId);

      expect(player.level).toBe(2);
      expect(player.xp).toBe(88);
      expect(player.maxHp).toBe(112);
      expect(player.maxMp).toBe(55);
      expect(player.hp).toBe(112);
      expect(player.mp).toBe(55);
      await client.leave();
    } finally {
      cleanup();
    }
  });

  it('persists level-up max vitals to DB on kill', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await colyseus.createRoom('town', { dbPath, combatRng: zeroOffsetRng() });
      const client = await colyseus.sdk.joinById(room.roomId, {}, TownState);
      const characterId = await client.waitForMessage('characterId');

      await killGremlin(room, client, client.sessionId);
      await killGremlin(room, client, client.sessionId);

      const row = loadCharacter(getDb(dbPath), characterId)!;
      expect(row).toMatchObject({
        level: 2,
        xp: 88,
        maxHp: 112,
        maxMp: 55,
        hp: 112,
        mp: 55,
      });
      await client.leave();
    } finally {
      cleanup();
    }
  });

  describe('terrain walkability', () => {
    function isOutsideCentreBuilding(x: number, z: number): boolean {
      return Math.abs(x) > 4 || Math.abs(z + 14) > 3;
    }

    it('updates player y to snapEntityY when moving across terrain', async () => {
      const room = await colyseus.createRoom('town', { dbPath: ':memory:' });
      const client = await colyseus.connectTo(room);
      const player = room.state.players.get(client.sessionId)!;

      placePlayerNear(room, client.sessionId, 20, 20);
      player.y = 0;

      await deliverAndTick(room, client, [['move', { targetX: 25, targetZ: 20 }]]);
      for (let i = 0; i < 20; i++) tick(room);

      expect(player.y).toBeCloseTo(snapEntityY(player.x, player.z), 8);
      await client.leave();
    });

    it('spawned mob y equals snapEntityY at spawn xz', async () => {
      const { dbPath, cleanup } = seededCombatDb();
      try {
        const room = await colyseus.createRoom('town', { dbPath });
        const mob = findMobByNpcId(room, 20001);
        expect(mob).toBeDefined();
        expect(mob!.y).toBeCloseTo(snapEntityY(mob!.x, mob!.z), 8);
        await room.disconnect();
      } finally {
        cleanup();
      }
    });

    it('initialized NPC y equals snapEntityY at spawn xz', async () => {
      const { dbPath, cleanup } = seededCombatDb();
      try {
        const room = await colyseus.createRoom('town', { dbPath });
        for (const npc of room.state.npcs.values()) {
          expect(npc.y).toBeCloseTo(snapEntityY(npc.x, npc.z), 8);
        }
        await room.disconnect();
      } finally {
        cleanup();
      }
    });

    it('rejects move intents into the centre building', async () => {
      const room = await colyseus.createRoom('town', { dbPath: ':memory:' });
      const client = await colyseus.connectTo(room);
      const player = room.state.players.get(client.sessionId)!;

      placePlayerNear(room, client.sessionId, 0, 5);

      for (let i = 0; i < 40; i++) {
        await deliverAndTick(room, client, [['move', { targetX: 0, targetZ: -14 }]]);
      }

      expect(isOutsideCentreBuilding(player.x, player.z)).toBe(true);
      await client.leave();
    });

    it('routes move intent around building via pathfinding', async () => {
      const room = await colyseus.createRoom('town', { dbPath: ':memory:' });
      const client = await colyseus.connectTo(room);
      const player = room.state.players.get(client.sessionId)!;

      placePlayerNear(room, client.sessionId, 0, 20);
      await deliverAndTick(room, client, [['move', { targetX: 0, targetZ: -25 }]]);

      const tickState = (
        room as {
          tickStates: Map<string, { waypoints: Array<{ x: number; z: number }> }>;
        }
      ).tickStates.get(client.sessionId);
      expect(tickState?.waypoints.length).toBeGreaterThan(0);

      const positions: Array<{ x: number; z: number }> = [];
      for (let i = 0; i < 400; i++) {
        positions.push({ x: player.x, z: player.z });
        tick(room);
        if (Math.abs(player.z + 25) <= 1) break;
      }

      expect(positions.length).toBeGreaterThan(5);
      for (const pos of positions) {
        expect(isOutsideCentreBuilding(pos.x, pos.z)).toBe(true);
      }
      for (let i = 1; i < positions.length; i++) {
        expect(isWalkable(positions[i - 1], positions[i])).toBe(true);
      }
      expect(Math.abs(player.z + 25)).toBeLessThanOrEqual(2);
      await client.leave();
    });

    it('mob adjacent to building does not enter on wander tick', async () => {
      const { dbPath, cleanup } = seededCombatDb();
      try {
        const room = await colyseus.createRoom('town', {
          dbPath,
          combatRng: zeroOffsetRng(),
        });
        const mob = findMobByNpcId(room, 20001)!;
        relocateMob(room, mob.id, 0, -8);
        const runtime = (room as { mobRuntime: Map<string, MobRuntime> }).mobRuntime.get(mob.id)!;
        runtime.wanderTargetX = 0;
        runtime.wanderTargetZ = -14;
        runtime.wanderCooldownMs = 0;

        const beforeX = runtime.x;
        const beforeZ = runtime.z;
        tick(room);

        expect(isOutsideCentreBuilding(runtime.x, runtime.z)).toBe(true);
        if (runtime.x === beforeX && runtime.z === beforeZ) {
          expect(isWalkable({ x: beforeX, z: beforeZ }, { x: 0, z: -14 })).toBe(false);
        }
        await room.disconnect();
      } finally {
        cleanup();
      }
    });
  });
});

describe('TownRoom e2e intents', () => {
  const originalE2E = process.env['NJ_E2E'];

  afterEach(() => {
    if (originalE2E === undefined) delete process.env['NJ_E2E'];
    else process.env['NJ_E2E'] = originalE2E;
  });

  describe('with NJ_E2E=1', () => {
    it('e2eTeleport moves player to walkable coordinates', async () => {
      process.env['NJ_E2E'] = '1';
      const room = await colyseus.createRoom('town', { dbPath: ':memory:' });
      const client = await colyseus.connectTo(room);

      await deliver(room, client, [
        ['e2eTeleport', { x: OUT_OF_PEACE.x, z: OUT_OF_PEACE.z }],
      ]);

      const player = room.state.players.get(client.sessionId)!;
      expect(player.x).toBe(OUT_OF_PEACE.x);
      expect(player.z).toBe(OUT_OF_PEACE.z);
      expect(player.y).toBeCloseTo(snapEntityY(OUT_OF_PEACE.x, OUT_OF_PEACE.z), 5);

      await client.leave(true);
      await room.disconnect();
    });

    it('e2eTeleport rejects unwalkable coordinates', async () => {
      process.env['NJ_E2E'] = '1';
      const room = await colyseus.createRoom('town', { dbPath: ':memory:' });
      const client = await colyseus.connectTo(room);
      const before = room.state.players.get(client.sessionId)!;
      const startX = before.x;
      const startZ = before.z;

      await deliver(room, client, [['e2eTeleport', { x: 0, z: -14 }]]);

      const after = room.state.players.get(client.sessionId)!;
      expect(after.x).toBe(startX);
      expect(after.z).toBe(startZ);

      await client.leave(true);
      await room.disconnect();
    });

    it('e2eDamage reduces HP floored at 1', async () => {
      process.env['NJ_E2E'] = '1';
      const room = await colyseus.createRoom('town', { dbPath: ':memory:' });
      const client = await colyseus.connectTo(room);

      await deliver(room, client, [['e2eDamage', { amount: 20 }]]);
      expect(room.state.players.get(client.sessionId)!.hp).toBe(80);

      await deliver(room, client, [['e2eDamage', { amount: 200 }]]);
      expect(room.state.players.get(client.sessionId)!.hp).toBe(1);

      await client.leave(true);
      await room.disconnect();
    });

    it('e2eFreezeMob pins wander so mob position is stable after ticks', async () => {
      process.env['NJ_E2E'] = '1';
      const { dbPath, cleanup } = seededCombatDb();
      try {
        const room = await colyseus.createRoom('town', {
          dbPath,
          combatRng: zeroOffsetRng(),
        });
        const client = await colyseus.connectTo(room);
        const mob = findMobByNpcId(room, 20001)!;
        relocateMob(room, mob.id, OUT_OF_PEACE.x, OUT_OF_PEACE.z);

        await deliver(room, client, [['e2eFreezeMob', { mobId: mob.id }]]);

        const runtime = (room as { mobRuntime: Map<string, MobRuntime> }).mobRuntime.get(
          mob.id
        )!;
        expect(runtime.wanderCooldownMs).toBe(Number.MAX_SAFE_INTEGER);
        expect(runtime.wanderTargetX).toBe(runtime.x);
        expect(runtime.wanderTargetZ).toBe(runtime.z);

        for (let i = 0; i < 5; i++) tick(room);

        expect(runtime.wanderCooldownMs).toBe(Number.MAX_SAFE_INTEGER);
        expect(runtime.wanderTargetX).toBe(runtime.x);
        expect(runtime.wanderTargetZ).toBe(runtime.z);

        await client.leave(true);
        await room.disconnect();
      } finally {
        cleanup();
      }
    });
  });

  describe('production rejection (NJ_E2E unset)', () => {
    it('e2e intents are ignored with no state change', async () => {
      delete process.env['NJ_E2E'];
      const { dbPath, cleanup } = seededCombatDb();
      try {
        const room = await colyseus.createRoom('town', {
          dbPath,
          combatRng: zeroOffsetRng(),
        });
        const client = await colyseus.connectTo(room);
        const sessionId = client.sessionId;
        const playerBefore = room.state.players.get(sessionId)!;
        const startX = playerBefore.x;
        const startZ = playerBefore.z;
        const startHp = playerBefore.hp;

        const mob = findMobByNpcId(room, 20001)!;
        const runtime = (room as { mobRuntime: Map<string, MobRuntime> }).mobRuntime.get(
          mob.id
        )!;
        const startWanderCooldown = runtime.wanderCooldownMs;

        client.send('e2eTeleport', { x: OUT_OF_PEACE.x, z: OUT_OF_PEACE.z });
        client.send('e2eDamage', { amount: 50 });
        client.send('e2eFreezeMob', { mobId: mob.id });

        const playerAfter = room.state.players.get(sessionId)!;
        expect(playerAfter.x).toBe(startX);
        expect(playerAfter.z).toBe(startZ);
        expect(playerAfter.hp).toBe(startHp);
        expect(runtime.wanderCooldownMs).toBe(startWanderCooldown);

        await client.leave(true);
        await room.disconnect();
      } finally {
        cleanup();
      }
    });
  });
});
