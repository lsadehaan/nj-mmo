import type { ColyseusTestServer } from '@colyseus/testing';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { snapEntityY, getZoneAt } from '@nj/game-core';
import { runSeed, FIXTURE_DATA_DIR } from '../seed/seed';
import { DEFAULT_SIM_INTERVAL_MS } from './TownRoom';
import { TownState } from './schema/TownState';
import type { MobRuntime } from './spawn-manager';
import { acquireTownRoomTestServer, releaseTownRoomTestServer } from './town-room-harness';

const OUT_OF_PEACE = { x: -150, z: 55 };
const GREMLIN_NPC_ID = 20001;
const SOULSHOT_ITEM_ID = 1835;

let colyseus: ColyseusTestServer;

beforeAll(async () => {
  colyseus = await acquireTownRoomTestServer();
}, 60_000);

afterAll(async () => {
  await releaseTownRoomTestServer();
});

function tempDbPath(): { dbPath: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), 'nj-social-'));
  const dbPath = join(dir, 'test.db');
  return { dbPath, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

function seededDb() {
  const { dbPath, cleanup } = tempDbPath();
  runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
  return { dbPath, cleanup };
}

function zeroOffsetRng() {
  return { nextFloat: () => 1, nextInt: (min: number) => min, nextDamageOffset: () => 0 };
}

type TestRoom = Awaited<ReturnType<ColyseusTestServer['createRoom']>>;
type TestClient = Awaited<ReturnType<ColyseusTestServer['connectTo']>>;

const SIM_DELTA_MS = DEFAULT_SIM_INTERVAL_MS;

function tick(room: TestRoom): void {
  (room as unknown as { simulate(deltaMs: number): void }).simulate(SIM_DELTA_MS);
}

async function deliver(room: TestRoom, client: TestClient, messages: Array<[string, unknown]>) {
  for (const [type, payload] of messages) {
    const delivered = room.waitForMessage(type);
    client.send(type, payload);
    await delivered;
  }
}

async function deliverAndTick(room: TestRoom, client: TestClient, messages: Array<[string, unknown]>) {
  await deliver(room, client, messages);
  tick(room);
}

async function leaveRoom(room: TestRoom, client: TestClient) {
  await client.leave(true);
  await room.disconnect();
  await new Promise<void>((resolve) => setImmediate(resolve));
}

async function createRoom(dbPath: string) {
  return colyseus.createRoom('town', {
    instanceKey: randomUUID(),
    dbPath,
    combatRng: zeroOffsetRng(),
  });
}

async function joinWithClass(room: TestRoom, opts: { classId: number; sex: 0 | 1 }) {
  return colyseus.connectTo(room, { create: opts });
}

function findMobByNpcId(room: TestRoom, npcId: number) {
  return [...room.state.players.values()].length >= 0
    ? [...room.state.mobs.values()].find((m) => m.npcId === npcId)
    : undefined;
}

function placePlayerNear(room: TestRoom, sessionId: string, x: number, z: number) {
  const player = room.state.players.get(sessionId)!;
  player.x = x;
  player.z = z;
  player.y = snapEntityY(x, z);
  player.zoneId = getZoneAt(x, z).zoneId;
  const tickStates = (room as { tickStates: Map<string, { x: number; z: number }> }).tickStates;
  const ts = tickStates.get(sessionId);
  if (ts) {
    ts.x = x;
    ts.z = z;
  }
}

function relocateMob(room: TestRoom, mobId: string, x: number, z: number) {
  const runtime = (room as { mobRuntime: Map<string, MobRuntime> }).mobRuntime.get(mobId)!;
  runtime.x = x;
  runtime.z = z;
  const mob = room.state.mobs.get(mobId)!;
  mob.x = x;
  mob.z = z;
}

async function killGremlin(room: TestRoom, client: TestClient) {
  const gremlin = findMobByNpcId(room, GREMLIN_NPC_ID)!;
  relocateMob(room, gremlin.id, OUT_OF_PEACE.x, OUT_OF_PEACE.z);
  placePlayerNear(room, client.sessionId, OUT_OF_PEACE.x, OUT_OF_PEACE.z);
  const player = room.state.players.get(client.sessionId)!;
  player.hp = 50_000;
  await deliver(room, client, [['setTarget', { mobId: gremlin.id }]]);
  while (room.state.mobs.has(gremlin.id)) {
    const combat = (room as { playerCombat: Map<string, { nextAttackAtMs: number }> }).playerCombat.get(
      client.sessionId
    )!;
    combat.nextAttackAtMs = 0;
    await deliverAndTick(room, client, [['attack', {}]]);
  }
}

describe('TownRoom social — chat', () => {
  it('SOC26-01: all channel broadcast reaches both clients', async () => {
    const { dbPath, cleanup } = seededDb();
    try {
      const room = await createRoom(dbPath);
      const a = await joinWithClass(room, { classId: 0, sex: 0 });
      const b = await joinWithClass(room, { classId: 0, sex: 0 });
      const recvB = new Promise<unknown>((resolve) => b.onMessage('chat', resolve));
      a.send('chat', { channel: 'all', text: 'hello all' });
      const payload = await recvB;
      expect(payload).toMatchObject({ channel: 'all', text: 'hello all' });
      await leaveRoom(room, a);
      await leaveRoom(room, b);
    } finally {
      cleanup();
    }
  });

  it('SOC26-02: local chat only reaches nearby player', async () => {
    const { dbPath, cleanup } = seededDb();
    try {
      const room = await createRoom(dbPath);
      const a = await joinWithClass(room, { classId: 0, sex: 0 });
      const b = await joinWithClass(room, { classId: 0, sex: 0 });
      placePlayerNear(room, a.sessionId, 0, 0);
      placePlayerNear(room, b.sessionId, 0, 35);
      const recvPromise = new Promise<unknown>((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('should not receive')), 200);
        b.onMessage('chat', (p) => {
          clearTimeout(t);
          resolve(p);
        });
      });
      a.send('chat', { channel: 'local', text: 'near' });
      await expect(recvPromise).rejects.toThrow();
      await leaveRoom(room, a);
      await leaveRoom(room, b);
    } finally {
      cleanup();
    }
  });

  it('SOC26-03: party chat rejected when not in party', async () => {
    const { dbPath, cleanup } = seededDb();
    try {
      const room = await createRoom(dbPath);
      const a = await joinWithClass(room, { classId: 0, sex: 0 });
      let received = false;
      a.onMessage('chat', () => {
        received = true;
      });
      await deliver(room, a, [['chat', { channel: 'party', text: 'nope' }]]);
      expect(received).toBe(false);
      await leaveRoom(room, a);
    } finally {
      cleanup();
    }
  });
});

describe('TownRoom social — party', () => {
  it('SOC26-09/10: invite accept forms party with shared partyId', async () => {
    const { dbPath, cleanup } = seededDb();
    try {
      const room = await createRoom(dbPath);
      const a = await joinWithClass(room, { classId: 0, sex: 0 });
      const b = await joinWithClass(room, { classId: 0, sex: 0 });
      placePlayerNear(room, a.sessionId, 0, 0);
      placePlayerNear(room, b.sessionId, 0, 5);
      const inviteRecv = new Promise<unknown>((resolve) =>
        b.onMessage('partyInvite', resolve)
      );
      a.send('partyInvite', { targetSessionId: b.sessionId });
      const invite = await inviteRecv;
      expect(invite).toMatchObject({ inviterSessionId: a.sessionId });
      await deliver(room, b, [['partyAccept', { inviterSessionId: a.sessionId }]]);
      const pa = room.state.players.get(a.sessionId)!;
      const pb = room.state.players.get(b.sessionId)!;
      expect(pa.partyId).toBeGreaterThan(0);
      expect(pb.partyId).toBe(pa.partyId);
      const party = room.state.parties.get(String(pa.partyId))!;
      expect(party.leaderSessionId).toBe(a.sessionId);
      expect([...party.memberSessionIds]).toEqual(expect.arrayContaining([a.sessionId, b.sessionId]));
      await leaveRoom(room, a);
      await leaveRoom(room, b);
    } finally {
      cleanup();
    }
  });

  it('SOC26-37: partyDecline notifies inviter', async () => {
    const { dbPath, cleanup } = seededDb();
    try {
      const room = await createRoom(dbPath);
      const a = await joinWithClass(room, { classId: 0, sex: 0 });
      const b = await joinWithClass(room, { classId: 0, sex: 0 });
      placePlayerNear(room, a.sessionId, 0, 0);
      placePlayerNear(room, b.sessionId, 0, 5);
      a.send('partyInvite', { targetSessionId: b.sessionId });
      await new Promise((r) => b.onMessage('partyInvite', r));
      const declineRecv = new Promise<unknown>((resolve) => a.onMessage('partyDecline', resolve));
      await deliver(room, b, [['partyDecline', { inviterSessionId: a.sessionId }]]);
      await declineRecv;
      expect(room.state.parties.size).toBe(0);
      await leaveRoom(room, a);
      await leaveRoom(room, b);
    } finally {
      cleanup();
    }
  });
});

describe('TownRoom social — party kill XP', () => {
  it('SOC26-17: two-session party Gremlin kill grants +28 XP each', async () => {
    const { dbPath, cleanup } = seededDb();
    try {
      const room = await createRoom(dbPath);
      const a = await joinWithClass(room, { classId: 0, sex: 0 });
      const b = await joinWithClass(room, { classId: 0, sex: 0 });
      placePlayerNear(room, a.sessionId, OUT_OF_PEACE.x, OUT_OF_PEACE.z);
      placePlayerNear(room, b.sessionId, OUT_OF_PEACE.x, OUT_OF_PEACE.z + 2);
      await deliver(room, a, [['partyInvite', { targetSessionId: b.sessionId }]]);
      await new Promise((r) => b.onMessage('partyInvite', r));
      await deliver(room, b, [['partyAccept', { inviterSessionId: a.sessionId }]]);
      await killGremlin(room, a);
      expect(room.state.players.get(a.sessionId)!.xp).toBe(28);
      expect(room.state.players.get(b.sessionId)!.xp).toBe(28);
      await leaveRoom(room, a);
      await leaveRoom(room, b);
    } finally {
      cleanup();
    }
  });

  it('SOC26-21: solo kill still grants +44 XP', async () => {
    const { dbPath, cleanup } = seededDb();
    try {
      const room = await createRoom(dbPath);
      const a = await joinWithClass(room, { classId: 0, sex: 0 });
      await killGremlin(room, a);
      expect(room.state.players.get(a.sessionId)!.xp).toBe(44);
      await leaveRoom(room, a);
    } finally {
      cleanup();
    }
  });
});

describe('TownRoom social — trade', () => {
  it('SOC26-25: two-session atomic adena+item swap', async () => {
    const { dbPath, cleanup } = seededDb();
    try {
      const room = await createRoom(dbPath);
      const a = await joinWithClass(room, { classId: 0, sex: 0 });
      const b = await joinWithClass(room, { classId: 0, sex: 0 });
      placePlayerNear(room, a.sessionId, 10, 10);
      placePlayerNear(room, b.sessionId, 10, 11);
      (room as { playerItems: Map<string, Record<number, number>> }).playerItems.set(a.sessionId, {
        [SOULSHOT_ITEM_ID]: 10,
      });
      (room as { playerItems: Map<string, Record<number, number>> }).playerItems.set(b.sessionId, {
        [SOULSHOT_ITEM_ID]: 3,
      });
      (room as { syncItemsToPlayerState: (id: string) => void }).syncItemsToPlayerState(a.sessionId);
      (room as { syncItemsToPlayerState: (id: string) => void }).syncItemsToPlayerState(b.sessionId);
      room.state.players.get(a.sessionId)!.adena = 500;
      room.state.players.get(b.sessionId)!.adena = 200;

      const reqRecv = new Promise<void>((resolve) => b.onMessage('tradeRequest', () => resolve()));
      a.send('tradeRequest', { targetSessionId: b.sessionId });
      await reqRecv;
      await deliver(room, b, [['tradeAccept', { fromSessionId: a.sessionId }]]);
      await new Promise((r) => a.onMessage('tradeOpen', r));
      await new Promise((r) => b.onMessage('tradeOpen', r));

      await deliver(room, a, [
        ['tradeOffer', { items: [{ itemId: SOULSHOT_ITEM_ID, count: 5 }], adena: 100 }],
      ]);
      await deliver(room, b, [
        ['tradeOffer', { items: [{ itemId: SOULSHOT_ITEM_ID, count: 1 }], adena: 50 }],
      ]);
      await deliver(room, a, [['tradeConfirm', {}]]);
      await deliver(room, b, [['tradeConfirm', {}]]);

      const itemsA = (room as { playerItems: Map<string, Record<number, number>> }).playerItems.get(
        a.sessionId
      )!;
      const itemsB = (room as { playerItems: Map<string, Record<number, number>> }).playerItems.get(
        b.sessionId
      )!;
      expect(itemsA[SOULSHOT_ITEM_ID]).toBe(6);
      expect(itemsB[SOULSHOT_ITEM_ID]).toBe(7);
      expect(room.state.players.get(a.sessionId)!.adena).toBe(450);
      expect(room.state.players.get(b.sessionId)!.adena).toBe(250);
      await leaveRoom(room, a);
      await leaveRoom(room, b);
    } finally {
      cleanup();
    }
  });

  it('SOC26-26: insufficient adena fails with no inventory change', async () => {
    const { dbPath, cleanup } = seededDb();
    try {
      const room = await createRoom(dbPath);
      const a = await joinWithClass(room, { classId: 0, sex: 0 });
      const b = await joinWithClass(room, { classId: 0, sex: 0 });
      placePlayerNear(room, a.sessionId, 20, 20);
      placePlayerNear(room, b.sessionId, 20, 21);
      room.state.players.get(a.sessionId)!.adena = 50;
      room.state.players.get(b.sessionId)!.adena = 0;
      const beforeA = room.state.players.get(a.sessionId)!.adena;

      a.send('tradeRequest', { targetSessionId: b.sessionId });
      await new Promise((r) => b.onMessage('tradeRequest', r));
      await deliver(room, b, [['tradeAccept', { fromSessionId: a.sessionId }]]);
      await new Promise((r) => a.onMessage('tradeOpen', r));
      await deliver(room, a, [['tradeOffer', { items: [], adena: 100 }]]);
      await deliver(room, b, [['tradeOffer', { items: [], adena: 0 }]]);
      await deliver(room, a, [['tradeConfirm', {}]]);
      await deliver(room, b, [['tradeConfirm', {}]]);

      expect(room.state.players.get(a.sessionId)!.adena).toBe(beforeA);
      await leaveRoom(room, a);
      await leaveRoom(room, b);
    } finally {
      cleanup();
    }
  });
});

describe('TownRoom social — friends', () => {
  it('SOC26-31: friendAdd persists and syncs list', async () => {
    const { dbPath, cleanup } = seededDb();
    try {
      const room = await createRoom(dbPath);
      const a = await joinWithClass(room, { classId: 0, sex: 0 });
      const b = await joinWithClass(room, { classId: 0, sex: 0 });
      const listRecv = new Promise<{ friends: { characterId: string; online: boolean }[] }>((resolve) =>
        a.onMessage('friendsList', resolve)
      );
      await deliver(room, a, [['friendAdd', { targetSessionId: b.sessionId }]]);
      const list = await listRecv;
      const bCharId = (room as { characterIds: Map<string, string> }).characterIds.get(b.sessionId)!;
      expect(list.friends.some((f) => f.characterId === bCharId && f.online === true)).toBe(true);
      await leaveRoom(room, a);
      await leaveRoom(room, b);
    } finally {
      cleanup();
    }
  });
});
