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
import { TownState } from './schema/TownState';

function tempDbPath(): { dbPath: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), 'nj-town-room-'));
  const dbPath = join(dir, 'test.db');
  return { dbPath, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

describe('TownRoom', () => {
  let colyseus: ColyseusTestServer;

  beforeAll(async () => {
    colyseus = await boot(app);
  });

  afterAll(async () => {
    await colyseus.shutdown();
  });

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
