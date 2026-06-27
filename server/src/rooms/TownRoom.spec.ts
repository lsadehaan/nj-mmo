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
    expect(player!.y).toBe(0);
    expect(player!.z).toBe(0);

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
});
