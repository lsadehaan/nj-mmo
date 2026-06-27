import { boot, ColyseusTestServer } from '@colyseus/testing';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import app from '../app.config';

describe('TownRoom', () => {
  let colyseus: ColyseusTestServer;

  beforeAll(async () => {
    colyseus = await boot(app);
  });

  afterAll(async () => {
    await colyseus.shutdown();
  });

  it('adds a player to state on join', async () => {
    const room = await colyseus.createRoom('town', {});
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
    const room = await colyseus.createRoom('town', {});
    const client = await colyseus.connectTo(room);

    expect(room.state.players.size).toBe(1);
    await client.leave(true);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(room.state.players.size).toBe(0);
  });

  it('maintains TownState with players map present', async () => {
    const room = await colyseus.createRoom('town', {});

    expect(room.state).toBeDefined();
    expect(room.state.players).toBeDefined();

    await room.disconnect();
  });

  it('advances player position on simulation tick when a move intent is pending', async () => {
    const room = await colyseus.createRoom('town', {});
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
    const room = await colyseus.createRoom('town', {});
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
    const room = await colyseus.createRoom('town', {});
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
});
