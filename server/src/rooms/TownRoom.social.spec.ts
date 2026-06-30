import type { ColyseusTestServer } from '@colyseus/testing';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { snapEntityY, getZoneAt } from '@nj/game-core';
import { runSeed, FIXTURE_DATA_DIR } from '../seed/seed';
import { DEFAULT_SIM_INTERVAL_MS } from './TownRoom';
import { TownState } from './schema/TownState';
import type { MobRuntime } from './spawn-manager';
import { acquireTownRoomTestServer, releaseTownRoomTestServer } from './town-room-harness';

const OUT_OF_PEACE = { x: -150, z: 55 };
const GREMLIN_NPC_ID = 20001;
const SOULSHOT_ITEM_ID = 1835;
const SQUIRES_SWORD = 2369;
const GOLEM_SHARD_ITEM_ID = 1012;
const GREMLIN_DROP_ITEM_ID = 1864;

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

function alwaysDropRng() {
  return { nextFloat: () => 0, nextInt: (min: number) => min, nextDamageOffset: () => 0 };
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

async function createRoom(dbPath: string, combatRng = zeroOffsetRng()) {
  return colyseus.createRoom('town', {
    instanceKey: randomUUID(),
    dbPath,
    combatRng,
  });
}

function setPlayerLevel(room: TestRoom, sessionId: string, level: number): void {
  const player = room.state.players.get(sessionId)!;
  const stored = (room as { characters: Map<string, { level: number }> }).characters.get(
    sessionId
  )!;
  player.level = level;
  stored.level = level;
}

function grantItem(room: TestRoom, sessionId: string, itemId: number, count: number): void {
  const items = (room as { playerItems: Map<string, Record<number, number>> }).playerItems;
  items.set(sessionId, { ...(items.get(sessionId) ?? {}), [itemId]: count });
  (room as { syncItemsToPlayerState: (id: string) => void }).syncItemsToPlayerState(sessionId);
}

function getPlayerItems(room: TestRoom, sessionId: string): Record<number, number> {
  return (room as { playerItems: Map<string, Record<number, number>> }).playerItems.get(
    sessionId
  ) ?? {};
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

function getQuestEntry(room: TestRoom, sessionId: string, questId: number) {
  return [...(room.state.players.get(sessionId)?.questEntries ?? [])].find(
    (e) => e.questId === questId
  );
}

function advanceQuestStep(
  room: TestRoom,
  sessionId: string,
  questId: number,
  step: number,
  counters: number[] = []
): void {
  const quests = (
    room as {
      playerQuests: Map<
        string,
        { questId: number; status: string; step: number; counters: number[] }[]
      >;
    }
  ).playerQuests;
  const list = quests.get(sessionId) ?? [];
  const idx = list.findIndex((q) => q.questId === questId);
  if (idx < 0) return;
  list[idx] = { questId, status: 'in_progress', step, counters };
  quests.set(sessionId, list);
  (room as { syncQuestEntries: (s: string) => void }).syncQuestEntries(sessionId);
}

async function openTrade(room: TestRoom, a: TestClient, b: TestClient) {
  const openA = new Promise<unknown>((resolve) => a.onMessage('tradeOpen', resolve));
  const openB = new Promise<unknown>((resolve) => b.onMessage('tradeOpen', resolve));
  a.send('tradeRequest', { targetSessionId: b.sessionId });
  await new Promise((r) => b.onMessage('tradeRequest', r));
  await deliver(room, b, [['tradeAccept', { fromSessionId: a.sessionId }]]);
  await Promise.all([openA, openB]);
}

async function formParty(room: TestRoom, leader: TestClient, ...members: TestClient[]) {
  for (const member of members) {
    const inviteRecv = new Promise<void>((resolve) =>
      member.onMessage('partyInvite', () => resolve())
    );
    leader.send('partyInvite', { targetSessionId: member.sessionId });
    await inviteRecv;
    await deliver(room, member, [['partyAccept', { inviterSessionId: leader.sessionId }]]);
    tick(room);
  }
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

  it('SOC26-04: party chat reaches party members only', async () => {
    const { dbPath, cleanup } = seededDb();
    try {
      const room = await createRoom(dbPath);
      const a = await joinWithClass(room, { classId: 0, sex: 0 });
      const b = await joinWithClass(room, { classId: 0, sex: 0 });
      placePlayerNear(room, a.sessionId, 0, 0);
      placePlayerNear(room, b.sessionId, 0, 5);
      const inviteRecv = new Promise<unknown>((resolve) => b.onMessage('partyInvite', resolve));
      a.send('partyInvite', { targetSessionId: b.sessionId });
      await inviteRecv;
      await deliver(room, b, [['partyAccept', { inviterSessionId: a.sessionId }]]);
      tick(room);

      const outsider = await joinWithClass(room, { classId: 0, sex: 0 });
      placePlayerNear(room, outsider.sessionId, 0, 6);

      let outsiderReceived = false;
      outsider.onMessage('chat', () => {
        outsiderReceived = true;
      });
      const recvB = new Promise<unknown>((resolve) => b.onMessage('chat', resolve));
      a.send('chat', { channel: 'party', text: 'party-only' });
      expect(await recvB).toMatchObject({ channel: 'party', text: 'party-only' });
      expect(outsiderReceived).toBe(false);
      await Promise.all([a, b, outsider].map((client) => client.leave(true)));
      await room.disconnect();
    } finally {
      cleanup();
    }
  });

  it('SOC26-05: room rejects 6th chat message within rate window', async () => {
    const { dbPath, cleanup } = seededDb();
    try {
      const room = await createRoom(dbPath);
      const a = await joinWithClass(room, { classId: 0, sex: 0 });
      const b = await joinWithClass(room, { classId: 0, sex: 0 });
      for (let i = 0; i < 5; i++) {
        const recv = new Promise<unknown>((resolve) => b.onMessage('chat', resolve));
        await deliver(room, a, [['chat', { channel: 'all', text: `m${i}` }]]);
        await recv;
      }
      let sixthReceived = false;
      b.onMessage('chat', () => {
        sixthReceived = true;
      });
      await deliver(room, a, [['chat', { channel: 'all', text: 'sixth' }]]);
      expect(sixthReceived).toBe(false);
      await leaveRoom(room, a);
      await leaveRoom(room, b);
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

  it('SOC26-13: leader leave transfers leadership to longest-tenured member', async () => {
    const { dbPath, cleanup } = seededDb();
    try {
      const room = await createRoom(dbPath);
      const a = await joinWithClass(room, { classId: 0, sex: 0 });
      const b = await joinWithClass(room, { classId: 0, sex: 0 });
      placePlayerNear(room, a.sessionId, 0, 0);
      placePlayerNear(room, b.sessionId, 0, 5);
      await formParty(room, a, b);
      const partyId = room.state.players.get(a.sessionId)!.partyId;
      await deliver(room, a, [['partyLeave', {}]]);
      const party = room.state.parties.get(String(partyId))!;
      expect(party.leaderSessionId).toBe(b.sessionId);
      expect(room.state.players.get(a.sessionId)!.partyId).toBe(0);
      await leaveRoom(room, a);
      await leaveRoom(room, b);
    } finally {
      cleanup();
    }
  });

  it('SOC26-14: leader kick removes target and clears partyId', async () => {
    const { dbPath, cleanup } = seededDb();
    try {
      const room = await createRoom(dbPath);
      const a = await joinWithClass(room, { classId: 0, sex: 0 });
      const b = await joinWithClass(room, { classId: 0, sex: 0 });
      placePlayerNear(room, a.sessionId, 0, 0);
      placePlayerNear(room, b.sessionId, 0, 5);
      await formParty(room, a, b);
      await deliver(room, a, [['partyKick', { targetSessionId: b.sessionId }]]);
      expect(room.state.players.get(b.sessionId)!.partyId).toBe(0);
      const party = room.state.parties.get(String(room.state.players.get(a.sessionId)!.partyId))!;
      expect([...party.memberSessionIds]).toEqual([a.sessionId]);
      await leaveRoom(room, a);
      await leaveRoom(room, b);
    } finally {
      cleanup();
    }
  });

  it('SOC26-11: invite rejected when party already has 5 members', async () => {
    const { dbPath, cleanup } = seededDb();
    try {
      const room = await createRoom(dbPath);
      const leader = await joinWithClass(room, { classId: 0, sex: 0 });
      const m2 = await joinWithClass(room, { classId: 0, sex: 0 });
      const m3 = await joinWithClass(room, { classId: 0, sex: 0 });
      const m4 = await joinWithClass(room, { classId: 0, sex: 0 });
      const m5 = await joinWithClass(room, { classId: 0, sex: 0 });
      const outsider = await joinWithClass(room, { classId: 0, sex: 0 });
      for (const client of [leader, m2, m3, m4, m5, outsider]) {
        placePlayerNear(room, client.sessionId, 0, 0);
      }
      await formParty(room, leader, m2, m3, m4, m5);
      const partyId = room.state.players.get(leader.sessionId)!.partyId;
      expect(room.state.parties.get(String(partyId))!.memberSessionIds.length).toBe(5);

      let sixthInvite = false;
      outsider.onMessage('partyInvite', () => {
        sixthInvite = true;
      });
      leader.send('partyInvite', { targetSessionId: outsider.sessionId });
      tick(room);
      expect(sixthInvite).toBe(false);

      await Promise.all([leader, m2, m3, m4, m5, outsider].map((c) => c.leave(true)));
      await room.disconnect();
    } finally {
      cleanup();
    }
  });

  it('SOC26-12: party member cannot invite while already in party', async () => {
    const { dbPath, cleanup } = seededDb();
    try {
      const room = await createRoom(dbPath);
      const leader = await joinWithClass(room, { classId: 0, sex: 0 });
      const member = await joinWithClass(room, { classId: 0, sex: 0 });
      const target = await joinWithClass(room, { classId: 0, sex: 0 });
      placePlayerNear(room, leader.sessionId, 0, 0);
      placePlayerNear(room, member.sessionId, 0, 5);
      placePlayerNear(room, target.sessionId, 0, 8);
      await formParty(room, leader, member);

      let inviteReceived = false;
      target.onMessage('partyInvite', () => {
        inviteReceived = true;
      });
      member.send('partyInvite', { targetSessionId: target.sessionId });
      tick(room);
      expect(inviteReceived).toBe(false);

      await Promise.all([leader, member, target].map((c) => c.leave(true)));
      await room.disconnect();
    } finally {
      cleanup();
    }
  });

  it('SOC26-15: last member leave deletes PartyState', async () => {
    const { dbPath, cleanup } = seededDb();
    try {
      const room = await createRoom(dbPath);
      const a = await joinWithClass(room, { classId: 0, sex: 0 });
      const b = await joinWithClass(room, { classId: 0, sex: 0 });
      placePlayerNear(room, a.sessionId, 0, 0);
      placePlayerNear(room, b.sessionId, 0, 5);
      await formParty(room, a, b);
      const partyId = room.state.players.get(a.sessionId)!.partyId;
      await deliver(room, b, [['partyLeave', {}]]);
      await deliver(room, a, [['partyLeave', {}]]);
      expect(room.state.parties.has(String(partyId))).toBe(false);
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

  it('SOC26-22: in-range party member receives quest kill credit', async () => {
    const { dbPath, cleanup } = seededDb();
    try {
      const room = await createRoom(dbPath);
      const a = await joinWithClass(room, { classId: 0, sex: 0 });
      const b = await joinWithClass(room, { classId: 0, sex: 0 });
      placePlayerNear(room, a.sessionId, OUT_OF_PEACE.x, OUT_OF_PEACE.z);
      placePlayerNear(room, b.sessionId, OUT_OF_PEACE.x, OUT_OF_PEACE.z + 2);
      advanceQuestStep(room, a.sessionId, 255, 1, [0]);
      advanceQuestStep(room, b.sessionId, 255, 1, [0]);
      await formParty(room, a, b);
      await killGremlin(room, a);
      expect(getQuestEntry(room, a.sessionId, 255)?.step).toBe(2);
      expect(getQuestEntry(room, b.sessionId, 255)?.step).toBe(2);
      await leaveRoom(room, a);
      await leaveRoom(room, b);
    } finally {
      cleanup();
    }
  });

  it('SOC26-18: out-of-range party member receives 0 XP', async () => {
    const { dbPath, cleanup } = seededDb();
    try {
      const room = await createRoom(dbPath);
      const killer = await joinWithClass(room, { classId: 0, sex: 0 });
      const far = await joinWithClass(room, { classId: 0, sex: 0 });
      placePlayerNear(room, killer.sessionId, OUT_OF_PEACE.x, OUT_OF_PEACE.z);
      placePlayerNear(room, far.sessionId, OUT_OF_PEACE.x, OUT_OF_PEACE.z + 2);
      await formParty(room, killer, far);
      placePlayerNear(room, far.sessionId, OUT_OF_PEACE.x, OUT_OF_PEACE.z + 20);
      await killGremlin(room, killer);
      expect(room.state.players.get(killer.sessionId)!.xp).toBe(44);
      expect(room.state.players.get(far.sessionId)!.xp).toBe(0);
      await leaveRoom(room, killer);
      await leaveRoom(room, far);
    } finally {
      cleanup();
    }
  });

  it('SOC26-19: member >20 levels below highest receives 0 XP', async () => {
    const { dbPath, cleanup } = seededDb();
    try {
      const room = await createRoom(dbPath);
      const high = await joinWithClass(room, { classId: 0, sex: 0 });
      const low = await joinWithClass(room, { classId: 0, sex: 0 });
      placePlayerNear(room, high.sessionId, OUT_OF_PEACE.x, OUT_OF_PEACE.z);
      placePlayerNear(room, low.sessionId, OUT_OF_PEACE.x, OUT_OF_PEACE.z + 2);
      setPlayerLevel(room, high.sessionId, 25);
      setPlayerLevel(room, low.sessionId, 4);
      await formParty(room, high, low);
      await killGremlin(room, high);
      expect(room.state.players.get(low.sessionId)!.xp).toBe(0);
      expect(room.state.players.get(high.sessionId)!.xp).toBeGreaterThan(0);
      await leaveRoom(room, high);
      await leaveRoom(room, low);
    } finally {
      cleanup();
    }
  });

  it('SOC26-20: party kill drops go to in-range member inventory', async () => {
    const { dbPath, cleanup } = seededDb();
    try {
      const room = await createRoom(dbPath, alwaysDropRng());
      const killer = await joinWithClass(room, { classId: 0, sex: 0 });
      const partner = await joinWithClass(room, { classId: 0, sex: 0 });
      placePlayerNear(room, killer.sessionId, OUT_OF_PEACE.x, OUT_OF_PEACE.z);
      placePlayerNear(room, partner.sessionId, OUT_OF_PEACE.x, OUT_OF_PEACE.z + 2);
      await formParty(room, killer, partner);
      await killGremlin(room, killer);

      const killerItems = getPlayerItems(room, killer.sessionId);
      const partnerItems = getPlayerItems(room, partner.sessionId);
      const killerDrop = killerItems[GREMLIN_DROP_ITEM_ID] ?? 0;
      const partnerDrop = partnerItems[GREMLIN_DROP_ITEM_ID] ?? 0;
      expect(killerDrop + partnerDrop).toBeGreaterThan(0);
      expect(killerDrop === 0 || partnerDrop === 0).toBe(true);

      await leaveRoom(room, killer);
      await leaveRoom(room, partner);
    } finally {
      cleanup();
    }
  });
});

describe('TownRoom social — trade', () => {
  it('SOC26-23: tradeRequest within 3 units delivers message to target', async () => {
    const { dbPath, cleanup } = seededDb();
    try {
      const room = await createRoom(dbPath);
      const a = await joinWithClass(room, { classId: 0, sex: 0 });
      const b = await joinWithClass(room, { classId: 0, sex: 0 });
      placePlayerNear(room, a.sessionId, 10, 10);
      placePlayerNear(room, b.sessionId, 10, 11);

      const reqRecv = new Promise<unknown>((resolve) => b.onMessage('tradeRequest', resolve));
      a.send('tradeRequest', { targetSessionId: b.sessionId });
      const payload = await reqRecv;
      expect(payload).toMatchObject({ fromSessionId: a.sessionId });

      await leaveRoom(room, a);
      await leaveRoom(room, b);
    } finally {
      cleanup();
    }
  });

  it('SOC26-24: tradeAccept opens trade session for both players', async () => {
    const { dbPath, cleanup } = seededDb();
    try {
      const room = await createRoom(dbPath);
      const a = await joinWithClass(room, { classId: 0, sex: 0 });
      const b = await joinWithClass(room, { classId: 0, sex: 0 });
      placePlayerNear(room, a.sessionId, 10, 10);
      placePlayerNear(room, b.sessionId, 10, 11);

      a.send('tradeRequest', { targetSessionId: b.sessionId });
      await new Promise((r) => b.onMessage('tradeRequest', r));
      const openA = new Promise<unknown>((resolve) => a.onMessage('tradeOpen', resolve));
      const openB = new Promise<unknown>((resolve) => b.onMessage('tradeOpen', resolve));
      await deliver(room, b, [['tradeAccept', { fromSessionId: a.sessionId }]]);
      expect(await openA).toMatchObject({ status: 'open', partnerSessionId: b.sessionId });
      expect(await openB).toMatchObject({ status: 'open', partnerSessionId: a.sessionId });

      await leaveRoom(room, a);
      await leaveRoom(room, b);
    } finally {
      cleanup();
    }
  });

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

  it('SOC26-29: tradeConfirm rejects when players move >3 units apart', async () => {
    const { dbPath, cleanup } = seededDb();
    try {
      const room = await createRoom(dbPath);
      const a = await joinWithClass(room, { classId: 0, sex: 0 });
      const b = await joinWithClass(room, { classId: 0, sex: 0 });
      placePlayerNear(room, a.sessionId, 30, 30);
      placePlayerNear(room, b.sessionId, 30, 31);
      room.state.players.get(a.sessionId)!.adena = 100;
      room.state.players.get(b.sessionId)!.adena = 100;
      const beforeA = room.state.players.get(a.sessionId)!.adena;
      const beforeB = room.state.players.get(b.sessionId)!.adena;

      a.send('tradeRequest', { targetSessionId: b.sessionId });
      await new Promise((r) => b.onMessage('tradeRequest', r));
      await deliver(room, b, [['tradeAccept', { fromSessionId: a.sessionId }]]);
      await new Promise((r) => a.onMessage('tradeOpen', r));
      await deliver(room, a, [['tradeOffer', { items: [], adena: 10 }]]);
      await deliver(room, b, [['tradeOffer', { items: [], adena: 5 }]]);
      placePlayerNear(room, a.sessionId, 30, 30);
      placePlayerNear(room, b.sessionId, 30, 40);

      const errRecv = new Promise<unknown>((resolve) => a.onMessage('tradeError', resolve));
      await deliver(room, a, [['tradeConfirm', {}]]);
      await deliver(room, b, [['tradeConfirm', {}]]);
      await errRecv;

      expect(room.state.players.get(a.sessionId)!.adena).toBe(beforeA);
      expect(room.state.players.get(b.sessionId)!.adena).toBe(beforeB);
      await leaveRoom(room, a);
      await leaveRoom(room, b);
    } finally {
      cleanup();
    }
  });

  it('SOC26-27: tradeOffer rejects quest item in room', async () => {
    const { dbPath, cleanup } = seededDb();
    try {
      const room = await createRoom(dbPath);
      const a = await joinWithClass(room, { classId: 0, sex: 0 });
      const b = await joinWithClass(room, { classId: 0, sex: 0 });
      placePlayerNear(room, a.sessionId, 40, 40);
      placePlayerNear(room, b.sessionId, 40, 41);
      grantItem(room, a.sessionId, GOLEM_SHARD_ITEM_ID, 1);
      await openTrade(room, a, b);

      const errRecv = new Promise<unknown>((resolve) => a.onMessage('tradeError', resolve));
      await deliver(room, a, [
        ['tradeOffer', { items: [{ itemId: GOLEM_SHARD_ITEM_ID, count: 1 }], adena: 0 }],
      ]);
      const err = await errRecv;
      expect(err).toMatchObject({ error: expect.any(String) });
      expect(getPlayerItems(room, a.sessionId)[GOLEM_SHARD_ITEM_ID]).toBe(1);

      await leaveRoom(room, a);
      await leaveRoom(room, b);
    } finally {
      cleanup();
    }
  });

  it('SOC26-27: tradeOffer rejects equipped item in room', async () => {
    const { dbPath, cleanup } = seededDb();
    try {
      const room = await createRoom(dbPath);
      const a = await joinWithClass(room, { classId: 0, sex: 0 });
      const b = await joinWithClass(room, { classId: 0, sex: 0 });
      placePlayerNear(room, a.sessionId, 50, 50);
      placePlayerNear(room, b.sessionId, 50, 51);
      grantItem(room, a.sessionId, SQUIRES_SWORD, 1);
      await deliver(room, a, [['equip', { itemId: SQUIRES_SWORD }]]);
      await openTrade(room, a, b);

      const errRecv = new Promise<unknown>((resolve) => a.onMessage('tradeError', resolve));
      await deliver(room, a, [
        ['tradeOffer', { items: [{ itemId: SQUIRES_SWORD, count: 1 }], adena: 0 }],
      ]);
      await errRecv;
      expect(getPlayerItems(room, a.sessionId)[SQUIRES_SWORD] ?? 0).toBe(0);
      expect(room.state.players.get(a.sessionId)!.equippedWeaponItemId).toBe(SQUIRES_SWORD);

      await leaveRoom(room, a);
      await leaveRoom(room, b);
    } finally {
      cleanup();
    }
  });

  it('SOC26-28: tradeCancel clears session with no inventory change', async () => {
    const { dbPath, cleanup } = seededDb();
    try {
      const room = await createRoom(dbPath);
      const a = await joinWithClass(room, { classId: 0, sex: 0 });
      const b = await joinWithClass(room, { classId: 0, sex: 0 });
      placePlayerNear(room, a.sessionId, 60, 60);
      placePlayerNear(room, b.sessionId, 60, 61);
      grantItem(room, a.sessionId, SOULSHOT_ITEM_ID, 5);
      grantItem(room, b.sessionId, SOULSHOT_ITEM_ID, 3);
      room.state.players.get(a.sessionId)!.adena = 100;
      room.state.players.get(b.sessionId)!.adena = 50;
      const beforeA = { ...getPlayerItems(room, a.sessionId) };
      const beforeB = { ...getPlayerItems(room, b.sessionId) };
      const adenaBeforeA = room.state.players.get(a.sessionId)!.adena;
      const adenaBeforeB = room.state.players.get(b.sessionId)!.adena;

      await openTrade(room, a, b);
      await deliver(room, a, [
        ['tradeOffer', { items: [{ itemId: SOULSHOT_ITEM_ID, count: 2 }], adena: 10 }],
      ]);
      await deliver(room, b, [
        ['tradeOffer', { items: [{ itemId: SOULSHOT_ITEM_ID, count: 1 }], adena: 5 }],
      ]);

      const closedA = new Promise<void>((resolve) => a.onMessage('tradeClosed', () => resolve()));
      const closedB = new Promise<void>((resolve) => b.onMessage('tradeClosed', () => resolve()));
      await deliver(room, a, [['tradeCancel', {}]]);
      await Promise.all([closedA, closedB]);

      expect(getPlayerItems(room, a.sessionId)).toEqual(beforeA);
      expect(getPlayerItems(room, b.sessionId)).toEqual(beforeB);
      expect(room.state.players.get(a.sessionId)!.adena).toBe(adenaBeforeA);
      expect(room.state.players.get(b.sessionId)!.adena).toBe(adenaBeforeB);
      await leaveRoom(room, a);
      await leaveRoom(room, b);
    } finally {
      cleanup();
    }
  });

  it('SOC26-39: tradeRequest rejected while already in trade', async () => {
    const { dbPath, cleanup } = seededDb();
    try {
      const room = await createRoom(dbPath);
      const a = await joinWithClass(room, { classId: 0, sex: 0 });
      const b = await joinWithClass(room, { classId: 0, sex: 0 });
      const c = await joinWithClass(room, { classId: 0, sex: 0 });
      placePlayerNear(room, a.sessionId, 70, 70);
      placePlayerNear(room, b.sessionId, 70, 71);
      placePlayerNear(room, c.sessionId, 70, 72);

      await openTrade(room, a, b);

      let cReceived = false;
      c.onMessage('tradeRequest', () => {
        cReceived = true;
      });
      a.send('tradeRequest', { targetSessionId: c.sessionId });
      tick(room);
      expect(cReceived).toBe(false);

      await Promise.all([a, b, c].map((client) => client.leave(true)));
      await room.disconnect();
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

  it('SOC26-32: friendRemove deletes row and updates list', async () => {
    const { dbPath, cleanup } = seededDb();
    try {
      const room = await createRoom(dbPath);
      const a = await joinWithClass(room, { classId: 0, sex: 0 });
      const b = await joinWithClass(room, { classId: 0, sex: 0 });
      const addRecv = new Promise<{ friends: { characterId: string }[] }>((resolve) =>
        a.onMessage('friendsList', resolve)
      );
      await deliver(room, a, [['friendAdd', { targetSessionId: b.sessionId }]]);
      await addRecv;
      const bCharId = (room as { characterIds: Map<string, string> }).characterIds.get(b.sessionId)!;

      const removeRecv = new Promise<{ friends: { characterId: string }[] }>((resolve) =>
        a.onMessage('friendsList', resolve)
      );
      await deliver(room, a, [['friendRemove', { friendCharacterId: bCharId }]]);
      const list = await removeRecv;
      expect(list.friends).toHaveLength(0);

      await leaveRoom(room, a);
      await leaveRoom(room, b);
    } finally {
      cleanup();
    }
  });

  it('SOC26-35: friend online flag toggles on join and leave', async () => {
    const { dbPath, cleanup } = seededDb();
    try {
      const room = await createRoom(dbPath);
      const a = await joinWithClass(room, { classId: 0, sex: 0 });
      const b = await joinWithClass(room, { classId: 0, sex: 0 });
      const bCharId = (room as { characterIds: Map<string, string> }).characterIds.get(b.sessionId)!;

      const onlineRecv = new Promise<{ friends: { characterId: string; online: boolean }[] }>(
        (resolve) => a.onMessage('friendsList', resolve)
      );
      await deliver(room, a, [['friendAdd', { targetSessionId: b.sessionId }]]);
      const onlineList = await onlineRecv;
      expect(onlineList.friends.find((f) => f.characterId === bCharId)?.online).toBe(true);

      const offlineRecv = new Promise<{ friends: { characterId: string; online: boolean }[] }>(
        (resolve) => a.onMessage('friendsList', resolve)
      );
      await b.leave(true);
      const offlineList = await offlineRecv;
      expect(offlineList.friends.find((f) => f.characterId === bCharId)?.online).toBe(false);

      await room.disconnect();
    } finally {
      cleanup();
    }
  });
});
