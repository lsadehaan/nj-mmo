import { boot, ColyseusTestServer } from '@colyseus/testing';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SPAWN_X, SPAWN_Y, SPAWN_Z } from '@nj/game-core';
import app from '../app.config';
import { getDb } from '../db/client';
import {
  createCharacter,
  loadCharacter,
  saveCharacter,
} from '../db/character-repository';
import { runSeed, FIXTURE_DATA_DIR } from '../seed/seed';
import { TownState } from './schema/TownState';

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

    await client.leave();
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
      await room.waitForNextSimulationTick();
    }

    expect(player.x).toBeGreaterThan(0);
    expect(player.z).toBe(0);

    await client.leave();
  });

  it('moves the player when a valid move intent is received', async () => {
    const room = await colyseus.createRoom('town', { dbPath: ':memory:' });
    const client = await colyseus.connectTo(room);
    const player = room.state.players.get(client.sessionId)!;

    client.send('move', { targetX: 20, targetZ: 0 });

    for (let i = 0; i < 10; i++) {
      await room.waitForNextSimulationTick();
    }

    expect(player.x).toBeGreaterThan(0);
    expect(player.z).toBe(0);

    await client.leave();
  });

  it('ignores invalid move intents without changing position', async () => {
    const room = await colyseus.createRoom('town', { dbPath: ':memory:' });
    const client = await colyseus.connectTo(room);
    const player = room.state.players.get(client.sessionId)!;
    const startX = player.x;
    const startZ = player.z;

    client.send('move', { targetX: Number.NaN, targetZ: 0 });
    client.send('move', { targetX: 200, targetZ: 0 });

    for (let i = 0; i < 5; i++) {
      await room.waitForNextSimulationTick();
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

    clientA.send('move', { targetX: 20, targetZ: 0 });

    const deadline = Date.now() + 2000;
    let remoteOnB = clientB.state.players.get(sessionA);
    while (Date.now() < deadline && (!remoteOnB || remoteOnB.x <= 0)) {
      await room.waitForNextSimulationTick();
      remoteOnB = clientB.state.players.get(sessionA);
    }

    expect(remoteOnB).toBeDefined();
    expect(remoteOnB!.x).toBeGreaterThan(0);
    expect(remoteOnB!.z).toBe(0);

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

      client.send('move', { targetX: 10, targetZ: 5 });
      for (let i = 0; i < 20; i++) {
        await room.waitForNextSimulationTick();
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

      client.send('move', { targetX: 10, targetZ: 5 });
      for (let i = 0; i < 20; i++) {
        await room.waitForNextSimulationTick();
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

      client.send('move', { targetX: 10, targetZ: 0 });
      for (let i = 0; i < 15; i++) {
        await room.waitForNextSimulationTick();
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

      client.send('move', { targetX: 0.3, targetZ: 0 });
      await room.waitForNextSimulationTick();

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
      expect(room.state.mobs.size).toBe(11);
      await room.disconnect();
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
      placePlayerNear(room, client.sessionId, gremlin.x, gremlin.z);
      const hpBefore = gremlin.hp;

      client.send('setTarget', { mobId: gremlin.id });
      client.send('attack', {});
      await room.waitForNextSimulationTick();

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
      placePlayerNear(room, client.sessionId, gremlin.x + 20, gremlin.z);
      const hpBefore = gremlin.hp;

      client.send('setTarget', { mobId: gremlin.id });
      client.send('attack', {});
      await room.waitForNextSimulationTick();

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
    placePlayerNear(room, client.sessionId, gremlin.x, gremlin.z);

    client.send('setTarget', { mobId: gremlin.id });

    while (room.state.mobs.has(gremlin.id)) {
      const combat = room['playerCombat'].get(client.sessionId)!;
      combat.nextAttackAtMs = 0;
      client.send('attack', {});
      await room.waitForNextSimulationTick();
    }
  }

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
      await room.waitForNextSimulationTick();
      expect(room.state.mobs.has(gremlinId)).toBe(false);

      clock.advance(1);
      await room.waitForNextSimulationTick();
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

      await room.waitForNextSimulationTick();

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

      await room.waitForNextSimulationTick();
      let runtime = room['mobRuntime'].get(gremlin.id)!;
      expect(runtime.targetSessionId).toBeNull();

      placePlayerNear(room, client.sessionId, gremlin.x, gremlin.z);
      client.send('setTarget', { mobId: gremlin.id });
      client.send('attack', {});
      await room.waitForNextSimulationTick();

      runtime = room['mobRuntime'].get(gremlin.id)!;
      expect(runtime.wasDamaged).toBe(true);

      await room.waitForNextSimulationTick();
      runtime = room['mobRuntime'].get(gremlin.id)!;
      expect(runtime.targetSessionId).toBe(client.sessionId);
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
    client.send('setTarget', { mobId });
    client.send('useSkill', { skillId: 3 });
    await room.waitForNextSimulationTick();
  }

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
      placePlayerNear(room, client.sessionId, gremlin.x, gremlin.z);

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
      placePlayerNear(room, client.sessionId, gremlin.x + 4.1, gremlin.z);
      const hpBefore = gremlin.hp;
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
      placePlayerNear(room, client.sessionId, gremlin.x + 3.9, gremlin.z);

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
      placePlayerNear(room, client.sessionId, gremlin.x, gremlin.z);
      const hpBefore = gremlin.hp;

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
      placePlayerNear(room, client.sessionId, gremlin.x, gremlin.z);

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
      const goblin = findMobByNpcId(room, 20003)!;
      placePlayerNear(room, client.sessionId, goblin.x, goblin.z);

      await castPowerStrike(client, room, goblin.id);
      const hpAfterFirst = room.state.mobs.get(goblin.id)!.hp;
      expect(player.mp).toBe(41);

      clock.advance(2999);
      await castPowerStrike(client, room, goblin.id);
      expect(room.state.mobs.get(goblin.id)!.hp).toBeCloseTo(hpAfterFirst, 3);
      expect(player.mp).toBe(41);

      clock.advance(1);
      await castPowerStrike(client, room, goblin.id);
      expect(player.mp).toBe(32);
      const goblinAfter = room.state.mobs.get(goblin.id);
      if (goblinAfter) {
        expect(hpAfterFirst - goblinAfter.hp).toBeCloseTo(69, 3);
      } else {
        expect(hpAfterFirst).toBeLessThanOrEqual(69);
      }
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
      placePlayerNear(room, client.sessionId, gremlin.x, gremlin.z);
      const hpBefore = gremlin.hp;
      const mpBefore = player.mp;

      client.send('useSkill', { skillId: 3 });
      await room.waitForNextSimulationTick();
      expect(player.mp).toBe(mpBefore);
      expect(gremlin.hp).toBeCloseTo(hpBefore, 3);

      client.send('setTarget', { mobId: gremlin.id });
      client.send('useSkill', { skillId: 99 });
      await room.waitForNextSimulationTick();
      expect(player.mp).toBe(mpBefore);

      while (room.state.mobs.has(gremlin.id)) {
        const combat = room['playerCombat'].get(client.sessionId)!;
        combat.nextAttackAtMs = 0;
        client.send('attack', {});
        await room.waitForNextSimulationTick();
      }

      client.send('setTarget', { mobId: gremlin.id });
      client.send('useSkill', { skillId: 3 });
      await room.waitForNextSimulationTick();
      expect(player.mp).toBe(mpBefore);

      await client.leave();
    } finally {
      cleanup();
    }
  });
});
