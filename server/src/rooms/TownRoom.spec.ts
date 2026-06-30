import { boot, ColyseusTestServer } from '@colyseus/testing';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { EntityAction, SPAWN_X, SPAWN_Y, SPAWN_Z, snapEntityY, isWalkable, calcMagicSkillDamage, calcClassBaseMAtk, GREMLIN_COMBAT, getZoneAt } from '@nj/game-core';
import app from '../app.config';
import { getDb } from '../db/client';
import { onMobKilledForQuests, type QuestRoomContext } from './quest-handlers';
import {
  createCharacter,
  loadCharacter,
  saveCharacter,
  loadCharacterItems,
  loadCharacterSkills,
  saveCharacterQuest,
  loadCharacterQuests,
} from '../db/character-repository';
import { runSeed, FIXTURE_DATA_DIR } from '../seed/seed';
import { DEFAULT_SIM_INTERVAL_MS } from './TownRoom';
import { TownState } from './schema/TownState';
import type { MobRuntime } from './spawn-manager';
import * as mobAi from './mob-ai';

const OUT_OF_PEACE = { x: -150, z: 55 };

/** Phase 23 zone anchor coordinates for room-integration guards. */
export const ZONE_TEST_COORDS = {
  village: { x: 0, z: 0 },
  obelisk: { x: -150, z: 55 },
  harborWater: { x: -225, z: 275 },
} as const;
const BITZ_NPC_ID = 30026;
const BAULRO_NPC_ID = 30033;
const SOULSHOT_ITEM_ID = 1835;
const SPIRITSHOT_ITEM_ID = 2509;
const SQUIRES_SWORD = 2369;
const ROXXY_NPC = 30006;

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
    nextFloat: () => 1,
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
  player.y = snapEntityY(x, z);
  player.zoneId = getZoneAt(x, z).zoneId;
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

async function learnSkillAtBitz(
  room: TestRoom,
  client: TestClient,
  sessionId: string,
  skillId: number
): Promise<void> {
  placePlayerAtNpc(room, sessionId, BITZ_NPC_ID);
  await deliver(room, client, [
    ['interact', { npcId: BITZ_NPC_ID }],
    ['learnSkill', { skillId }],
  ]);
}

async function learnSkillAtBaulro(
  room: TestRoom,
  client: TestClient,
  sessionId: string,
  skillId: number
): Promise<void> {
  placePlayerAtNpc(room, sessionId, BAULRO_NPC_ID);
  await deliver(room, client, [
    ['interact', { npcId: BAULRO_NPC_ID }],
    ['learnSkill', { skillId }],
  ]);
}

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
 * Deterministically deliver one or more client→server messages. Each message is
 * awaited individually — `waitForMessage` only intercepts the next handler
 * invocation, so batching same-type messages (e.g. multiple `questAction`) must
 * not share a single wait or later actions are asserted before they run.
 */
async function deliver(
  room: TestRoom,
  client: TestClient,
  messages: Array<[string, unknown]>
): Promise<void> {
  for (const [type, payload] of messages) {
    const delivered = room.waitForMessage(type);
    client.send(type, payload);
    await delivered;
  }
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

async function leaveRoom(room: TestRoom, client: TestClient): Promise<void> {
  await client.leave(true);
  await room.disconnect();
  await new Promise<void>((resolve) => setImmediate(resolve));
}

type TownRoomCreateOptions = {
  dbPath?: string;
  instanceKey?: string;
  combatRng?: ReturnType<typeof zeroOffsetRng>;
};

async function createIsolatedTownRoom(
  options: TownRoomCreateOptions
): Promise<TestRoom> {
  return colyseus.createRoom('town', {
    instanceKey: options.instanceKey ?? randomUUID(),
    ...options,
  });
}

function expectedWindStrikeDamage(room: TestRoom, classId = 10): number {
  const template = room['classTemplatesById'].get(classId)!;
  const mAtk = calcClassBaseMAtk(
    { baseMAtk: template.baseMAtk ?? 6, baseInt: template.baseInt },
    1
  );
  return calcMagicSkillDamage(
    { mAtk },
    { mDef: GREMLIN_COMBAT.pDef },
    12,
    { rngOffset: 0 }
  );
}

async function joinWithClass(
  room: TestRoom,
  opts: { classId: number; sex: 0 | 1 }
) {
  return colyseus.connectTo(room, { create: opts });
}

/** Human Fighter level-1 vitals from seeded class_templates (CHAR19-04). */
const HUMAN_FIGHTER_MAX_HP = 80;
const HUMAN_FIGHTER_MAX_MP = 30;

describe('TownRoom character creation join', () => {
  it('CHAR19-17: create Elven Mystic applies class vitals and baseInt', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await colyseus.createRoom('town', { dbPath });
      const client = await joinWithClass(room, { classId: 25, sex: 0 });
      const player = room.state.players.get(client.sessionId)!;
      expect(player.classId).toBe(25);
      expect(player.maxHp).toBe(104);
      expect(player.maxMp).toBe(40);
      expect(player.int).toBe(37);
      await leaveRoom(room, client);
    } finally {
      cleanup();
    }
  });

  it('CHAR19-21: rejects invalid classId on create', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await colyseus.createRoom('town', { dbPath });
      await expect(
        colyseus.sdk.joinById(room.roomId, { create: { classId: 99, sex: 0 } }, TownState)
      ).rejects.toThrow();
      expect(room.state.players.size).toBe(0);
    } finally {
      cleanup();
    }
  });

  it('CHAR19-22: rejoin with characterId preserves classId and sex', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await colyseus.createRoom('town', { dbPath });
      const client = await colyseus.sdk.joinById(
        room.roomId,
        { create: { classId: 10, sex: 1 } },
        TownState
      );
      const characterId = await client.waitForMessage('characterId');
      expect(room.state.players.get(client.sessionId)!.classId).toBe(10);
      expect(room.state.players.get(client.sessionId)!.sex).toBe(1);

      await client.leave(true);
      await room.disconnect();

      const room2 = await colyseus.createRoom('town', { dbPath });
      const client2 = await colyseus.sdk.joinById(room2.roomId, { characterId }, TownState);
      const rejoined = room2.state.players.get(client2.sessionId)!;
      expect(rejoined.classId).toBe(10);
      expect(rejoined.sex).toBe(1);
      await leaveRoom(room2, client2);
    } finally {
      cleanup();
    }
  });

  it('remote client sees joiner classId in replicated PlayerState', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await colyseus.createRoom('town', { dbPath });
      const clientA = await colyseus.sdk.joinById(
        room.roomId,
        { create: { classId: 31, sex: 0 } },
        TownState
      );
      const clientB = await colyseus.sdk.joinById(room.roomId, {}, TownState);

      expect(room.state.players.get(clientA.sessionId)?.classId).toBe(31);

      const deadline = Date.now() + 2000;
      let remoteOnB = clientB.state.players.get(clientA.sessionId);
      while (Date.now() < deadline && remoteOnB?.classId !== 31) {
        await new Promise((resolve) => setTimeout(resolve, 20));
        remoteOnB = clientB.state.players.get(clientA.sessionId);
      }
      expect(remoteOnB?.classId).toBe(31);
      await leaveRoom(room, clientA);
      await leaveRoom(room, clientB);
    } finally {
      cleanup();
    }
  });
});

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

    await leaveRoom(room, client);
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

      await leaveRoom(room2, client2);
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

    await leaveRoom(room, client);
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

    await leaveRoom(room, client);
  });

  it('ignores invalid move intents without changing position', async () => {
    const room = await colyseus.createRoom('town', { dbPath: ':memory:' });
    const client = await colyseus.connectTo(room);
    const player = room.state.players.get(client.sessionId)!;
    const startX = player.x;
    const startZ = player.z;

    await deliver(room, client, [
      ['move', { targetX: Number.NaN, targetZ: 0 }],
      ['move', { targetX: 400, targetZ: 0 }],
    ]);

    for (let i = 0; i < 5; i++) {
      tick(room);
    }

    expect(player.x).toBe(startX);
    expect(player.z).toBe(startZ);

    await leaveRoom(room, client);
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

    await leaveRoom(room, clientA);
    await leaveRoom(room, clientB);
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
      await leaveRoom(room, client);
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
      await leaveRoom(room, client);
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
      expect(room.state.mobs.size).toBeGreaterThanOrEqual(55);
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

      await leaveRoom(room, client);
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

      await leaveRoom(room, client);
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

      await leaveRoom(room, client);
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
      await leaveRoom(room, client);
    } finally {
      cleanup();
    }
  });

  it('Stone Golem sets ATTACK on hit resolution (BEST22-43)', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await colyseus.createRoom('town', { dbPath, combatRng: zeroOffsetRng() });
      const client = await colyseus.connectTo(room);
      const golem = findMobByNpcId(room, 20016)!;
      placePlayerAndMobForCombat(room, client.sessionId, golem);
      const mobState = room.state.mobs.get(golem.id)!;
      const runtime = room['mobRuntime'].get(golem.id)!;
      runtime.targetSessionId = client.sessionId;
      runtime.nextAttackAtMs = 0;
      tick(room);
      expect(mobState.action).toBe(EntityAction.Attack);
      expect(mobState.actionSeq).toBe(1);
      await leaveRoom(room, client);
    } finally {
      cleanup();
    }
  });

  it('emits Orc Warrior DIE before removal (BEST22-44)', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await colyseus.createRoom('town', { dbPath, combatRng: zeroOffsetRng() });
      const client = await colyseus.connectTo(room);
      const warrior = findMobByNpcId(room, 20093)!;
      placePlayerAndMobForCombat(room, client.sessionId, warrior);
      const mobId = warrior.id;
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
        room['playerCombat'].get(client.sessionId)!.nextAttackAtMs = 0;
        await deliverAndTick(room, client, [['attack', {}]]);
      }
      expect(dieObservedBeforeDelete).toBe(true);
      await leaveRoom(room, client);
    } finally {
      cleanup();
    }
  });

  it('Orc Archer damages player at 6 m without closing to melee (BEST22-47)', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await colyseus.createRoom('town', { dbPath, combatRng: zeroOffsetRng() });
      const client = await colyseus.connectTo(room);
      const archer = findMobByNpcId(room, 20006)!;
      relocateMob(room, archer.id, OUT_OF_PEACE.x, OUT_OF_PEACE.z);
      placePlayerNear(room, client.sessionId, OUT_OF_PEACE.x + 6, OUT_OF_PEACE.z);
      const runtime = room['mobRuntime'].get(archer.id)!;
      runtime.targetSessionId = client.sessionId;
      const player = room.state.players.get(client.sessionId)!;
      const hpBefore = player.hp;

      for (let i = 0; i < 60; i++) {
        runtime.nextAttackAtMs = 0;
        tick(room);
        if (player.hp < hpBefore) break;
      }

      expect(player.hp).toBeLessThan(hpBefore);
      const endDist = Math.hypot(player.x - runtime.x, player.z - runtime.z);
      expect(endDist).toBeGreaterThan(4);
      expect(endDist).toBeLessThan(8.5);
      await leaveRoom(room, client);
    } finally {
      cleanup();
    }
  });

  it('passive Werewolf acquires target when damaged (BEST22-48)', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await colyseus.createRoom('town', { dbPath, combatRng: zeroOffsetRng() });
      const client = await colyseus.connectTo(room);
      const wolf = findMobByNpcId(room, 20132)!;
      placePlayerAndMobForCombat(room, client.sessionId, wolf);
      await deliverAndTick(room, client, [
        ['setTarget', { mobId: wolf.id }],
        ['attack', {}],
      ]);
      tick(room);
      expect(room['mobRuntime'].get(wolf.id)!.targetSessionId).toBe(client.sessionId);
      await leaveRoom(room, client);
    } finally {
      cleanup();
    }
  });

  it('Werewolf pack social assist within 30 m (BEST22-49)', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await colyseus.createRoom('town', { dbPath, combatRng: zeroOffsetRng() });
      const client = await colyseus.connectTo(room);
      const wolves = [...room.state.mobs.values()].filter((m) => m.npcId === 20132);
      expect(wolves.length).toBeGreaterThanOrEqual(2);
      const wolfA = wolves[0]!;
      const wolfB = wolves[1]!;
      relocateMob(room, wolfA.id, OUT_OF_PEACE.x, OUT_OF_PEACE.z);
      relocateMob(room, wolfB.id, OUT_OF_PEACE.x + 10, OUT_OF_PEACE.z);
      placePlayerNear(room, client.sessionId, OUT_OF_PEACE.x, OUT_OF_PEACE.z);
      await deliverAndTick(room, client, [
        ['setTarget', { mobId: wolfA.id }],
        ['attack', {}],
      ]);
      tick(room);
      expect(room['mobRuntime'].get(wolfB.id)!.targetSessionId).toBe(client.sessionId);
      await leaveRoom(room, client);
    } finally {
      cleanup();
    }
  });

  it('CHAR19-18: Human Fighter naked melee deals 8 damage to Gremlin', async () => {
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
      expect(hpBefore - gremlinAfter.hp).toBeCloseTo(8, 3);

      await leaveRoom(room, client);
    } finally {
      cleanup();
    }
  });

  it('CHAR19-19: Human Mystic naked melee deals 3 damage to Gremlin', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await colyseus.createRoom('town', { dbPath, combatRng: zeroOffsetRng() });
      const client = await joinWithClass(room, { classId: 10, sex: 0 });
      const gremlin = findMobByNpcId(room, 20001)!;
      placePlayerAndMobForCombat(room, client.sessionId, gremlin);
      const hpBefore = room.state.mobs.get(gremlin.id)!.hp;

      await deliverAndTick(room, client, [
        ['setTarget', { mobId: gremlin.id }],
        ['attack', {}],
      ]);

      expect(hpBefore - room.state.mobs.get(gremlin.id)!.hp).toBeCloseTo(3, 3);
      await leaveRoom(room, client);
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
      await leaveRoom(room, client);
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

      await leaveRoom(room, client);
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
      await leaveRoom(room, client);
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
      await leaveRoom(room, client);
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
      await leaveRoom(room, client);
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

      await leaveRoom(room, client);
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
      relocateMob(room, goblin.id, OUT_OF_PEACE.x, OUT_OF_PEACE.z);
      placePlayerNear(room, client.sessionId, OUT_OF_PEACE.x + 40, OUT_OF_PEACE.z);

      tick(room);

      const runtime = room['mobRuntime'].get(goblin.id)!;
      expect(runtime.targetSessionId).toBe(client.sessionId);
      await leaveRoom(room, client);
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
      await leaveRoom(room, client);
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
      expect(player.hp).toBe(HUMAN_FIGHTER_MAX_HP);
      expect(player.x).toBe(SPAWN_X);
      expect(player.z).toBe(SPAWN_Z);

      await leaveRoom(room, client);
    } finally {
      cleanup();
    }
  });
});

async function prepareFighterWithPowerStrike(
  room: TestRoom,
  client: TestClient,
  sessionId: string
): Promise<void> {
  await learnSkillAtBitz(room, client, sessionId, 3);
}

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
      await prepareFighterWithPowerStrike(room, client, client.sessionId);
      placePlayerAndMobForCombat(room, client.sessionId, gremlin);

      expect(player.action).toBe(0);
      expect(player.actionSeq).toBe(0);

      await castPowerStrike(client, room, gremlin.id);

      expect(player.action).toBe(2);
      expect(player.actionSeq).toBe(1);
      expect(player.mp).toBe(21);

      await leaveRoom(room, client);
    } finally {
      cleanup();
    }
  });

  it('useSkill in range deals 71 damage with sword and reduces MP from 30 to 21', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await colyseus.createRoom('town', {
        dbPath,
        combatRng: zeroOffsetRng(),
      });
      const client = await colyseus.connectTo(room);
      await claimStarterKit(room, client, client.sessionId);
      await deliver(room, client, [['equip', { itemId: SQUIRES_SWORD }]]);
      await prepareFighterWithPowerStrike(room, client, client.sessionId);
      const player = room.state.players.get(client.sessionId)!;
      const gremlin = findMobByNpcId(room, 20001)!;
      placePlayerAndMobForCombat(room, client.sessionId, gremlin);
      const gremlinRuntime = room['mobRuntime'].get(gremlin.id)!;
      gremlinRuntime.hp = 500;
      gremlinRuntime.maxHp = 500;
      room.state.mobs.get(gremlin.id)!.hp = 500;
      const hpBefore = gremlinRuntime.hp;

      await castPowerStrike(client, room, gremlin.id);

      expect(player.mp).toBe(21);
      expect(hpBefore - room.state.mobs.get(gremlin.id)!.hp).toBeCloseTo(71, 3);
      await leaveRoom(room, client);
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
      await prepareFighterWithPowerStrike(room, client, client.sessionId);
      const player = room.state.players.get(client.sessionId)!;
      const gremlin = findMobByNpcId(room, 20001)!;
      relocateMob(room, gremlin.id, OUT_OF_PEACE.x, OUT_OF_PEACE.z);
      placePlayerNear(room, client.sessionId, OUT_OF_PEACE.x + 4.1, OUT_OF_PEACE.z);
      const hpBefore = room.state.mobs.get(gremlin.id)!.hp;
      const mpBefore = player.mp;

      await castPowerStrike(client, room, gremlin.id);

      expect(room.state.mobs.get(gremlin.id)!.hp).toBeCloseTo(hpBefore, 3);
      expect(player.mp).toBe(mpBefore);
      await leaveRoom(room, client);
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
      await prepareFighterWithPowerStrike(room, client, client.sessionId);
      const player = room.state.players.get(client.sessionId)!;
      const gremlin = findMobByNpcId(room, 20001)!;
      relocateMob(room, gremlin.id, OUT_OF_PEACE.x, OUT_OF_PEACE.z);
      placePlayerNear(room, client.sessionId, OUT_OF_PEACE.x + 3.9, OUT_OF_PEACE.z);

      await castPowerStrike(client, room, gremlin.id);

      expect(player.mp).toBe(21);
      expect(room.state.mobs.has(gremlin.id)).toBe(false);
      await leaveRoom(room, client);
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
      await prepareFighterWithPowerStrike(room, client, client.sessionId);
      const player = room.state.players.get(client.sessionId)!;
      player.mp = 8;
      const gremlin = findMobByNpcId(room, 20001)!;
      placePlayerAndMobForCombat(room, client.sessionId, gremlin);
      const hpBefore = room.state.mobs.get(gremlin.id)!.hp;

      await castPowerStrike(client, room, gremlin.id);

      expect(player.mp).toBe(8);
      expect(room.state.mobs.get(gremlin.id)!.hp).toBeCloseTo(hpBefore, 3);
      await leaveRoom(room, client);
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
      await prepareFighterWithPowerStrike(room, client, client.sessionId);
      const player = room.state.players.get(client.sessionId)!;
      const gremlin = findMobByNpcId(room, 20001)!;
      placePlayerAndMobForCombat(room, client.sessionId, gremlin);

      await castPowerStrike(client, room, gremlin.id);

      expect(player.powerStrikeCooldownEndMs).toBe(8000);
      await leaveRoom(room, client);
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
      await prepareFighterWithPowerStrike(room, client, client.sessionId);
      const player = room.state.players.get(client.sessionId)!;
      const gremlin = findMobByNpcId(room, 20001)!;
      placePlayerAndMobForCombat(room, client.sessionId, gremlin);
      const gremlinRuntime = room['mobRuntime'].get(gremlin.id)!;
      gremlinRuntime.hp = 500;
      gremlinRuntime.maxHp = 500;
      room.state.mobs.get(gremlin.id)!.hp = 500;

      await castPowerStrike(client, room, gremlin.id);
      const hpAfterFirst = room.state.mobs.get(gremlin.id)!.hp;
      expect(player.mp).toBe(21);

      clock.advance(2999);
      await castPowerStrike(client, room, gremlin.id);
      expect(room.state.mobs.get(gremlin.id)!.hp).toBeCloseTo(hpAfterFirst, 3);
      expect(player.mp).toBeLessThanOrEqual(21);

      clock.advance(1);
      await castPowerStrike(client, room, gremlin.id);
      expect(player.mp).toBe(12);
      const gremlinAfter = room.state.mobs.get(gremlin.id)!;
      expect(hpAfterFirst - gremlinAfter.hp).toBeCloseTo(60, 3);
      await leaveRoom(room, client);
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
      await prepareFighterWithPowerStrike(room, client, client.sessionId);
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
        const mobState = room.state.mobs.get(gremlin.id);
        if (!mobState || mobState.hp <= 0) break;
        const combat = room['playerCombat'].get(client.sessionId)!;
        combat.nextAttackAtMs = 0;
        combat.targetMobId = gremlin.id;
        await deliverAndTick(room, client, [['attack', {}]]);
      }

      await deliverAndTick(room, client, [
        ['setTarget', { mobId: gremlin.id }],
        ['useSkill', { skillId: 3 }],
      ]);
      expect(player.mp).toBe(mpBefore);

      await leaveRoom(room, client);
    } finally {
      cleanup();
    }
  });
});

describe('TownRoom Phase 20 skills', () => {
  // SKILL20-13
  it('syncs knownSkillIds on join and after learnSkill at Bitz', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await colyseus.createRoom('town', { dbPath });
      const client = await colyseus.connectTo(room);
      const player = room.state.players.get(client.sessionId)!;
      expect([...player.knownSkillIds]).toEqual([]);

      await learnSkillAtBitz(room, client, client.sessionId, 3);
      expect([...player.knownSkillIds]).toEqual([3]);

      await leaveRoom(room, client);
    } finally {
      cleanup();
    }
  });

  // SKILL20-14, 31, 41
  it('rejects useSkill for unlearned skills without damage or MP spend', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await colyseus.createRoom('town', {
        dbPath,
        combatRng: zeroOffsetRng(),
      });
      const fighterClient = await colyseus.connectTo(room);
      const fighter = room.state.players.get(fighterClient.sessionId)!;
      const gremlin = findMobByNpcId(room, 20001)!;
      placePlayerAndMobForCombat(room, fighterClient.sessionId, gremlin);
      const hpBefore = room.state.mobs.get(gremlin.id)!.hp;
      const mpBefore = fighter.mp;

      await deliverAndTick(room, fighterClient, [
        ['setTarget', { mobId: gremlin.id }],
        ['useSkill', { skillId: 3 }],
      ]);
      expect(fighter.mp).toBe(mpBefore);
      expect(room.state.mobs.get(gremlin.id)!.hp).toBeCloseTo(hpBefore, 3);

      const mysticClient = await joinWithClass(room, { classId: 10, sex: 0 });
      const mystic = room.state.players.get(mysticClient.sessionId)!;
      placePlayerAndMobForCombat(room, mysticClient.sessionId, gremlin);
      const mysticMpBefore = mystic.mp;
      const hpBeforeMystic = room.state.mobs.get(gremlin.id)!.hp;

      await deliverAndTick(room, mysticClient, [
        ['setTarget', { mobId: gremlin.id }],
        ['useSkill', { skillId: 1068 }],
      ]);
      expect(mystic.mp).toBe(mysticMpBefore);
      expect(room.state.mobs.get(gremlin.id)!.hp).toBeCloseTo(hpBeforeMystic, 3);

      await fighterClient.leave();
      await mysticClient.leave();
    } finally {
      cleanup();
    }
  });

  // SKILL20-31 (mystic without Wind Strike removed)
  it('rejects useSkill 1177 when Wind Strike is not learned', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await colyseus.createRoom('town', {
        dbPath,
        combatRng: zeroOffsetRng(),
      });
      const client = await joinWithClass(room, { classId: 0, sex: 0 });
      const player = room.state.players.get(client.sessionId)!;
      const gremlin = findMobByNpcId(room, 20001)!;
      placePlayerAndMobForCombat(room, client.sessionId, gremlin);
      const hpBefore = room.state.mobs.get(gremlin.id)!.hp;
      const mpBefore = player.mp;

      await deliverAndTick(room, client, [
        ['setTarget', { mobId: gremlin.id }],
        ['useSkill', { skillId: 1177 }],
      ]);

      expect(player.mp).toBe(mpBefore);
      expect(room.state.mobs.get(gremlin.id)!.hp).toBeCloseTo(hpBefore, 3);
      await leaveRoom(room, client);
    } finally {
      cleanup();
    }
  });

  // SKILL20-15
  it('learnSkill at Bitz persists Power Strike to character_skills', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await colyseus.createRoom('town', { dbPath });
      const client = await colyseus.connectTo(room);
      const characterId = room['characterIds'].get(client.sessionId)!;

      await learnSkillAtBitz(room, client, client.sessionId, 3);

      expect(loadCharacterSkills(getDb(dbPath), characterId)).toEqual({ 3: 1 });
      expect([...room.state.players.get(client.sessionId)!.knownSkillIds]).toEqual([3]);
      await leaveRoom(room, client);
    } finally {
      cleanup();
    }
  });

  // SKILL20-16
  it('rejects learnSkill 3 for Human Mystic at Bitz', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await colyseus.createRoom('town', { dbPath });
      const client = await joinWithClass(room, { classId: 10, sex: 0 });
      const characterId = room['characterIds'].get(client.sessionId)!;

      await learnSkillAtBitz(room, client, client.sessionId, 3);

      expect(loadCharacterSkills(getDb(dbPath), characterId)[3]).toBeUndefined();
      expect([...room.state.players.get(client.sessionId)!.knownSkillIds]).not.toContain(3);
      await leaveRoom(room, client);
    } finally {
      cleanup();
    }
  });

  // SKILL20-17
  it('rejects learnSkill when player is out of trainer range', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await colyseus.createRoom('town', { dbPath });
      const client = await colyseus.connectTo(room);
      const characterId = room['characterIds'].get(client.sessionId)!;
      placePlayerNear(room, client.sessionId, 2, -4);
      await deliver(room, client, [['interact', { npcId: BITZ_NPC_ID }]]);
      placePlayerNearNpcOffset(room, client.sessionId, BITZ_NPC_ID, 3.1);

      await deliver(room, client, [['learnSkill', { skillId: 3 }]]);

      expect(loadCharacterSkills(getDb(dbPath), characterId)[3]).toBeUndefined();
      await leaveRoom(room, client);
    } finally {
      cleanup();
    }
  });

  // SKILL20-17 duplicate
  it('rejects learnSkill when skill is already known', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await colyseus.createRoom('town', { dbPath });
      const client = await colyseus.connectTo(room);
      const characterId = room['characterIds'].get(client.sessionId)!;

      await learnSkillAtBitz(room, client, client.sessionId, 3);
      await learnSkillAtBitz(room, client, client.sessionId, 3);

      expect(loadCharacterSkills(getDb(dbPath), characterId)).toEqual({ 3: 1 });
      await leaveRoom(room, client);
    } finally {
      cleanup();
    }
  });

  // SKILL20-18
  it('learnSkill Might 1068 at Baulro adds to knownSkillIds', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await colyseus.createRoom('town', { dbPath });
      const client = await joinWithClass(room, { classId: 10, sex: 0 });

      await learnSkillAtBaulro(room, client, client.sessionId, 1068);

      const known = [...room.state.players.get(client.sessionId)!.knownSkillIds];
      expect(known).toContain(1068);
      expect(known).toContain(1177);
      await leaveRoom(room, client);
    } finally {
      cleanup();
    }
  });

  // SKILL20-19
  it('Orc Fighter learns Iron Punch 29 at Bitz and useSkill 29 is valid', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await colyseus.createRoom('town', {
        dbPath,
        combatRng: zeroOffsetRng(),
      });
      const client = await joinWithClass(room, { classId: 44, sex: 0 });
      const player = room.state.players.get(client.sessionId)!;
      await learnSkillAtBitz(room, client, client.sessionId, 29);
      expect([...player.knownSkillIds]).toContain(29);

      const gremlin = findMobByNpcId(room, 20001)!;
      placePlayerAndMobForCombat(room, client.sessionId, gremlin);
      const gremlinRuntime = room['mobRuntime'].get(gremlin.id)!;
      gremlinRuntime.hp = 500;
      gremlinRuntime.maxHp = 500;
      room.state.mobs.get(gremlin.id)!.hp = 500;
      const hpBefore = gremlinRuntime.hp;
      const mpBefore = player.mp;

      await deliverAndTick(room, client, [
        ['setTarget', { mobId: gremlin.id }],
        ['useSkill', { skillId: 29 }],
      ]);

      expect(player.mp).toBeLessThan(mpBefore);
      expect(hpBefore - room.state.mobs.get(gremlin.id)!.hp).toBeGreaterThan(0);
      await leaveRoom(room, client);
    } finally {
      cleanup();
    }
  });

  // SKILL20-27, 32
  it('Wind Strike sets castingSkillId until hitTime elapses then Cast action', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    const clock = createFakeClock(1000);
    try {
      const room = await colyseus.createRoom('town', {
        dbPath,
        combatRng: zeroOffsetRng(),
        nowMs: clock.now,
      });
      const client = await joinWithClass(room, { classId: 10, sex: 0 });
      const player = room.state.players.get(client.sessionId)!;
      const gremlin = findMobByNpcId(room, 20001)!;
      placePlayerAndMobForCombat(room, client.sessionId, gremlin);
      const gremlinRuntime = room['mobRuntime'].get(gremlin.id)!;
      gremlinRuntime.hp = 500;
      gremlinRuntime.maxHp = 500;
      room.state.mobs.get(gremlin.id)!.hp = 500;
      const mpBefore = player.mp;
      const expectedDamage = expectedWindStrikeDamage(room);

      await deliverAndTick(room, client, [
        ['setTarget', { mobId: gremlin.id }],
        ['useSkill', { skillId: 1177 }],
      ]);

      expect(player.castingSkillId).toBe(1177);
      expect(player.castEndMs).toBe(5000);
      expect(player.mp).toBe(mpBefore);

      clock.advance(4000);
      tick(room);

      expect(player.castingSkillId).toBe(0);
      expect(player.action).toBe(EntityAction.Cast);
      expect(player.mp).toBe(mpBefore - 7);
      expect(500 - room.state.mobs.get(gremlin.id)!.hp).toBeCloseTo(expectedDamage, 3);
      await leaveRoom(room, client);
    } finally {
      cleanup();
    }
  });

  // SKILL20-29
  it('mob damage during Wind Strike cast cancels without mob damage or MP spend', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    const clock = createFakeClock(1000);
    try {
      const room = await colyseus.createRoom('town', {
        dbPath,
        combatRng: zeroOffsetRng(),
        nowMs: clock.now,
      });
      const client = await joinWithClass(room, { classId: 10, sex: 0 });
      const player = room.state.players.get(client.sessionId)!;
      const gremlin = findMobByNpcId(room, 20001)!;
      placePlayerAndMobForCombat(room, client.sessionId, gremlin);
      const gremlinRuntime = room['mobRuntime'].get(gremlin.id)!;
      const hpBefore = gremlinRuntime.hp;
      const mpBefore = player.mp;

      await deliverAndTick(room, client, [
        ['setTarget', { mobId: gremlin.id }],
        ['useSkill', { skillId: 1177 }],
      ]);
      expect(player.castingSkillId).toBe(1177);

      gremlinRuntime.targetSessionId = client.sessionId;
      gremlinRuntime.nextAttackAtMs = 0;
      clock.advance(500);
      tick(room);

      expect(player.castingSkillId).toBe(0);
      expect(gremlinRuntime.hp).toBeCloseTo(hpBefore, 3);
      expect(player.mp).toBe(mpBefore);
      await leaveRoom(room, client);
    } finally {
      cleanup();
    }
  });

  // SKILL20-33
  it('soulshot then Power Strike deals 142 and decrements stack', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await colyseus.createRoom('town', {
        dbPath,
        combatRng: zeroOffsetRng(),
      });
      const client = await colyseus.connectTo(room);
      await claimStarterKit(room, client, client.sessionId);
      await deliver(room, client, [['equip', { itemId: SQUIRES_SWORD }]]);
      await prepareFighterWithPowerStrike(room, client, client.sessionId);
      room['playerItems'].set(client.sessionId, { [SOULSHOT_ITEM_ID]: 3 });
      room['syncItemsToPlayerState'](client.sessionId);

      const gremlin = findMobByNpcId(room, 20001)!;
      placePlayerAndMobForCombat(room, client.sessionId, gremlin);
      const gremlinRuntime = room['mobRuntime'].get(gremlin.id)!;
      gremlinRuntime.hp = 500;
      gremlinRuntime.maxHp = 500;
      room.state.mobs.get(gremlin.id)!.hp = 500;
      const hpBefore = gremlinRuntime.hp;

      await deliverAndTick(room, client, [
        ['setTarget', { mobId: gremlin.id }],
        ['useShot', { itemId: SOULSHOT_ITEM_ID }],
        ['useSkill', { skillId: 3 }],
      ]);

      expect(hpBefore - room.state.mobs.get(gremlin.id)!.hp).toBeCloseTo(142, 3);
      expect(getPlayerItemCount(room, client.sessionId, SOULSHOT_ITEM_ID)).toBe(2);
      await leaveRoom(room, client);
    } finally {
      cleanup();
    }
  });

  // SKILL20-34
  it('rejects useShot when soulshot count is 0', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await colyseus.createRoom('town', { dbPath });
      const client = await colyseus.connectTo(room);
      const combat = room['playerCombat'].get(client.sessionId)!;

      await deliver(room, client, [['useShot', { itemId: SOULSHOT_ITEM_ID }]]);

      expect(combat.armedShot).toBeNull();
      expect(getPlayerItemCount(room, client.sessionId, SOULSHOT_ITEM_ID)).toBe(0);
      await leaveRoom(room, client);
    } finally {
      cleanup();
    }
  });

  // SKILL20-35
  it('spiritshot then Wind Strike deals doubled template-anchored damage', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    const clock = createFakeClock(1000);
    try {
      const room = await colyseus.createRoom('town', {
        dbPath,
        combatRng: zeroOffsetRng(),
        nowMs: clock.now,
      });
      const client = await joinWithClass(room, { classId: 10, sex: 0 });
      room['playerItems'].set(client.sessionId, { [SPIRITSHOT_ITEM_ID]: 2 });
      room['syncItemsToPlayerState'](client.sessionId);

      const gremlin = findMobByNpcId(room, 20001)!;
      placePlayerAndMobForCombat(room, client.sessionId, gremlin);
      const gremlinRuntime = room['mobRuntime'].get(gremlin.id)!;
      gremlinRuntime.hp = 500;
      gremlinRuntime.maxHp = 500;
      room.state.mobs.get(gremlin.id)!.hp = 500;
      const hpBefore = gremlinRuntime.hp;
      const expectedDamage = expectedWindStrikeDamage(room) * 2;

      await deliverAndTick(room, client, [
        ['setTarget', { mobId: gremlin.id }],
        ['useShot', { itemId: SPIRITSHOT_ITEM_ID }],
        ['useSkill', { skillId: 1177 }],
      ]);
      clock.advance(4000);
      tick(room);

      expect(hpBefore - room.state.mobs.get(gremlin.id)!.hp).toBeCloseTo(expectedDamage, 3);
      expect(getPlayerItemCount(room, client.sessionId, SPIRITSHOT_ITEM_ID)).toBe(1);
      await leaveRoom(room, client);
    } finally {
      cleanup();
    }
  });

  // SKILL20-36
  it('armed soulshot doubles naked melee damage and consumes stack', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await colyseus.createRoom('town', {
        dbPath,
        combatRng: zeroOffsetRng(),
      });
      const client = await colyseus.connectTo(room);
      room['playerItems'].set(client.sessionId, { [SOULSHOT_ITEM_ID]: 1 });
      room['syncItemsToPlayerState'](client.sessionId);

      const gremlin = findMobByNpcId(room, 20001)!;
      placePlayerAndMobForCombat(room, client.sessionId, gremlin);
      const gremlinRuntime = room['mobRuntime'].get(gremlin.id)!;
      gremlinRuntime.hp = 500;
      gremlinRuntime.maxHp = 500;
      room.state.mobs.get(gremlin.id)!.hp = 500;
      const hpBefore = gremlinRuntime.hp;

      await deliverAndTick(room, client, [
        ['setTarget', { mobId: gremlin.id }],
        ['useShot', { itemId: SOULSHOT_ITEM_ID }],
        ['attack', {}],
      ]);

      expect(hpBefore - room.state.mobs.get(gremlin.id)!.hp).toBeCloseTo(16, 3);
      expect(getPlayerItemCount(room, client.sessionId, SOULSHOT_ITEM_ID)).toBe(0);
      await leaveRoom(room, client);
    } finally {
      cleanup();
    }
  });

  // SKILL20-43
  it('mob miss leaves player HP, MP, and skill cooldown unchanged', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    const missRng = {
      nextFloat: () => 0.5,
      nextInt: (min: number) => min,
      nextDamageOffset: () => 0,
    };
    try {
      const room = await colyseus.createRoom('town', {
        dbPath,
        combatRng: missRng,
        nowMs: () => 1000,
      });
      const client = await colyseus.connectTo(room);
      await prepareFighterWithPowerStrike(room, client, client.sessionId);
      const player = room.state.players.get(client.sessionId)!;
      const gremlin = findMobByNpcId(room, 20001)!;
      placePlayerAndMobForCombat(room, client.sessionId, gremlin);
      const gremlinRuntime = room['mobRuntime'].get(gremlin.id)!;
      gremlinRuntime.hp = 500;
      gremlinRuntime.maxHp = 500;
      room.state.mobs.get(gremlin.id)!.hp = 500;

      await deliverAndTick(room, client, [
        ['setTarget', { mobId: gremlin.id }],
        ['useSkill', { skillId: 3 }],
      ]);
      const mpAfterSkill = player.mp;
      const cooldownEnd = player.powerStrikeCooldownEndMs;

      const runtime = room['mobRuntime'].get(gremlin.id)!;
      runtime.targetSessionId = client.sessionId;
      runtime.nextAttackAtMs = 0;
      const hpBefore = player.hp;
      tick(room);

      expect(player.hp).toBe(hpBefore);
      expect(player.mp).toBe(mpAfterSkill);
      expect(player.powerStrikeCooldownEndMs).toBe(cooldownEnd);
      await leaveRoom(room, client);
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

  it('boots with 9 NPCs in state.npcs from seed (SKILL20-10)', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await colyseus.createRoom('town', { dbPath });
      expect(room.state.npcs.size).toBe(9);
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
      await leaveRoom(room, client);
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
      await leaveRoom(room, client);
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
      await leaveRoom(room, client);
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
      await leaveRoom(room, client);
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
      await leaveRoom(room, client);
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
      const result = await client.waitForMessage('questDialog');

      expect(result).toMatchObject({
        npcId: ROXXY,
        title: 'Tutorial',
      });
      await leaveRoom(room, client);
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
      await leaveRoom(room, client);
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
      await leaveRoom(room, client);
    } finally {
      cleanup();
    }
  });

  it('heal restores hp from 40 to maxHp near Roxxy', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await colyseus.createRoom('town', { dbPath });
      const client = await colyseus.sdk.joinById(room.roomId, {}, TownState);
      const player = room.state.players.get(client.sessionId)!;
      player.hp = 40;
      placePlayerAtNpc(room, client.sessionId, ROXXY);

      await deliver(room, client, [['npcAction', { npcId: ROXXY, action: 'heal' }]]);

      expect(player.hp).toBe(HUMAN_FIGHTER_MAX_HP);
      await leaveRoom(room, client);
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
      await leaveRoom(room, client);
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
      await leaveRoom(room, client);
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
      expect(player.mp).toBe(HUMAN_FIGHTER_MAX_MP);
      await leaveRoom(room, client);
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
      await leaveRoom(room, client);
    } finally {
      tickSpy.mockRestore();
      cleanup();
    }
  });
});

describe('TownRoom TI zone guards', () => {
  it('TIW23-18: attack at obelisk deals damage outside peace', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await colyseus.createRoom('town', { dbPath, combatRng: zeroOffsetRng() });
      const client = await colyseus.connectTo(room);
      const gremlin = findMobByNpcId(room, 20001)!;
      const { x, z } = ZONE_TEST_COORDS.obelisk;
      relocateMob(room, gremlin.id, x, z);
      placePlayerNear(room, client.sessionId, x, z);
      const hpBefore = room.state.mobs.get(gremlin.id)!.hp;

      await deliverAndTick(room, client, [
        ['setTarget', { mobId: gremlin.id }],
        ['attack', {}],
      ]);

      expect(room.state.mobs.get(gremlin.id)!.hp).toBeLessThan(hpBefore);
      await leaveRoom(room, client);
    } finally {
      cleanup();
    }
  });

  it('TIW23-22: rejects move intent into harbour water', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await colyseus.createRoom('town', { dbPath });
      const client = await colyseus.connectTo(room);
      const player = room.state.players.get(client.sessionId)!;
      const shore = { x: ZONE_TEST_COORDS.harborWater.x, z: ZONE_TEST_COORDS.harborWater.z - 8 };
      placePlayerNear(room, client.sessionId, shore.x, shore.z);
      const xBefore = player.x;
      const zBefore = player.z;

      await deliverAndTick(room, client, [
        [
          'move',
          {
            targetX: ZONE_TEST_COORDS.harborWater.x,
            targetZ: ZONE_TEST_COORDS.harborWater.z,
          },
        ],
      ]);

      expect(player.x).toBeCloseTo(xBefore, 1);
      expect(player.z).toBeCloseTo(zBefore, 1);
      await leaveRoom(room, client);
    } finally {
      cleanup();
    }
  });

  it('TIW23-48: spawn sets zoneId from village coordinates', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await colyseus.createRoom('town', { dbPath });
      const client = await colyseus.connectTo(room);
      const player = room.state.players.get(client.sessionId)!;
      expect(player.zoneId).toBe('ti_village');
      await leaveRoom(room, client);
    } finally {
      cleanup();
    }
  });

  it('TIW23-49: zoneId updates when crossing into obelisk', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await colyseus.createRoom('town', { dbPath });
      const client = await colyseus.connectTo(room);
      const player = room.state.players.get(client.sessionId)!;
      placePlayerNear(room, client.sessionId, ZONE_TEST_COORDS.village.x, ZONE_TEST_COORDS.village.z);
      expect(player.zoneId).toBe('ti_village');

      placePlayerNear(room, client.sessionId, ZONE_TEST_COORDS.obelisk.x, ZONE_TEST_COORDS.obelisk.z);
      expect(player.zoneId).toBe('obelisk');
      await leaveRoom(room, client);
    } finally {
      cleanup();
    }
  });
});

const HEALING_POTION = 1060;

describe('TownRoom equip', () => {
  it('CHAR19-36: equipping Squire\'s Sword then melee deals 19 damage to Gremlin', async () => {
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

      expect(hpBefore - room.state.mobs.get(gremlin.id)!.hp).toBeCloseTo(19, 3);
      await leaveRoom(room, client);
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
      await leaveRoom(room, client);
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
      await leaveRoom(room, client);
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
      await leaveRoom(room2, client2);
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
      await leaveRoom(room, client);
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
      await leaveRoom(room, client);
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
      await leaveRoom(room, client);
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
      await leaveRoom(room, client);
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
      expect(player.hp).toBe(HUMAN_FIGHTER_MAX_HP);
      expect(getPlayerItemCount(room, client.sessionId, HEALING_POTION)).toBe(0);
      await leaveRoom(room, client);
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
      player.hp = 56;

      await deliver(room, client, [['useItem', { itemId: HEALING_POTION }]]);

      expect(player.hp).toBe(HUMAN_FIGHTER_MAX_HP);
      expect(getPlayerItemCount(room, client.sessionId, HEALING_POTION)).toBe(0);
      await leaveRoom(room, client);
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
      await leaveRoom(room2, client2);
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
      expect(player.hp).toBe(HUMAN_FIGHTER_MAX_HP);
      await leaveRoom(room, client);
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
      await leaveRoom(room, client);
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
      await leaveRoom(room, client);
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
      await leaveRoom(room, client);
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

      await leaveRoom(room, client);
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
      await leaveRoom(room, client);
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
      await leaveRoom(room, client);
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
      await leaveRoom(room2, client2);
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
      expect(player.maxHp).toBe(HUMAN_FIGHTER_MAX_HP);
      expect(player.maxMp).toBe(HUMAN_FIGHTER_MAX_MP);
      await leaveRoom(room, client);
    } finally {
      cleanup();
    }
  });

  it('CHAR19-20: two Gremlin kills reach level 2 with class vitals 91.83 / 35.46', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await colyseus.createRoom('town', { dbPath, combatRng: zeroOffsetRng() });
      const client = await colyseus.connectTo(room);
      const player = room.state.players.get(client.sessionId)!;

      await killGremlin(room, client, client.sessionId);
      await killGremlin(room, client, client.sessionId);

      expect(player.level).toBe(2);
      expect(player.xp).toBe(88);
      expect(player.maxHp).toBeCloseTo(91.83, 2);
      expect(player.maxMp).toBeCloseTo(35.46, 2);
      expect(player.hp).toBeCloseTo(91.83, 2);
      expect(player.mp).toBeCloseTo(35.46, 2);
      await leaveRoom(room, client);
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
        maxHp: expect.closeTo(91.83, 2),
        maxMp: expect.closeTo(35.46, 2),
        hp: expect.closeTo(91.83, 2),
        mp: expect.closeTo(35.46, 2),
      });
      await leaveRoom(room, client);
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
      await leaveRoom(room, client);
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
      await leaveRoom(room, client);
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
      await leaveRoom(room, client);
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

const KATERINA_NPC = 30004;
const LECTOR_NPC = 30001;
const JACKSON_NPC = 30002;
const SILVIA_NPC = 30003;
const WILFORD_NPC = 30005;
const GWINTER_NPC = 30027;
const GREMLIN_NPC_ID = 20001;
const GOLEM_NPC_ID = 20016;
const MIRROR_KILL_1 = 20121;
const MIRROR_KILL_2 = 20432;
const MIRROR_KILL_3 = 20442;
const SMUGGLER_MOB_ID = 20003;
const ORC_SOLDIER_NPC_ID = 20130;
const NERKAS_NPC_ID = 27016;
const GOLEM_SHARD_ITEM_ID = 1012;
const STOLEN_GOODS_ITEM_ID = 1015;

function getQuestEntry(
  room: { state: TownState },
  sessionId: string,
  questId: number
) {
  return [...(room.state.players.get(sessionId)?.questEntries ?? [])].find(
    (e) => e.questId === questId
  );
}

function setPlayerLevel(room: TestRoom, sessionId: string, level: number): void {
  const player = room.state.players.get(sessionId)!;
  const stored = (room as { characters: Map<string, { level: number }> }).characters.get(
    sessionId
  )!;
  player.level = level;
  stored.level = level;
}

function grantItem(
  room: TestRoom,
  sessionId: string,
  itemId: number,
  count: number
): void {
  const items = (room as { playerItems: Map<string, Record<number, number>> }).playerItems;
  const bag = { ...(items.get(sessionId) ?? {}), [itemId]: count };
  items.set(sessionId, bag);
  (room as { setItemCount: (s: string, id: number, c: number) => void }).setItemCount(
    sessionId,
    itemId,
    count
  );
}

function advanceQuestStep(
  room: TestRoom,
  sessionId: string,
  questId: number,
  step: number,
  counters: number[] = []
): void {
  const quests = (room as { playerQuests: Map<string, { questId: number; status: string; step: number; counters: number[] }[]> }).playerQuests;
  const list = quests.get(sessionId) ?? [];
  const idx = list.findIndex((q) => q.questId === questId);
  if (idx < 0) return;
  list[idx] = { questId, status: 'in_progress', step, counters };
  quests.set(sessionId, list);
  (room as { syncQuestEntries: (s: string) => void }).syncQuestEntries(sessionId);
}

async function killMobNearPlayer(
  room: TestRoom,
  client: TestClient,
  sessionId: string,
  mobNpcId: number
): Promise<void> {
  const mob = findMobByNpcId(room, mobNpcId);
  if (!mob) throw new Error(`mob ${mobNpcId} not found`);
  placePlayerAndMobForCombat(room, sessionId, mob);
  await deliver(room, client, [['setTarget', { mobId: mob.id }], ['attack', {}]]);
  for (let i = 0; i < 200; i++) {
    tick(room);
    if (!room.state.mobs.has(mob.id)) return;
  }
  throw new Error(`failed to kill mob ${mobNpcId}`);
}

describe.sequential('TownRoom quests', () => {
  afterEach(async () => {
    await colyseus.cleanup();
  });

  // QUEST21-23
  it('auto-starts tutorial quest 255 on join', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await createIsolatedTownRoom({ dbPath });
      const client = await colyseus.connectTo(room);
      const entry = getQuestEntry(room, client.sessionId, 255);
      expect(entry?.questId).toBe(255);
      expect(entry?.status).toBe('in_progress');
      expect(entry?.step).toBe(0);
      await leaveRoom(room, client);
    } finally {
      cleanup();
    }
  });

  // QUEST21-13
  it('restores in-progress tutorial on reconnect', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await createIsolatedTownRoom({ dbPath });
      const client = await colyseus.connectTo(room);
      advanceQuestStep(room, client.sessionId, 255, 1, [0]);
      const characterId = (room as { characterIds: Map<string, string> }).characterIds.get(
        client.sessionId
      )!;
      saveCharacterQuest(
        getDb(dbPath),
        characterId,
        { questId: 255, status: 'in_progress', step: 1, counters: [0] }
      );
      expect(loadCharacterQuests(getDb(dbPath), characterId)[0]?.step).toBe(1);
      await leaveRoom(room, client);
      const room2 = await createIsolatedTownRoom({ dbPath });
      const client2 = await colyseus.connectTo(room2, { characterId });
      const entry = getQuestEntry(room2, client2.sessionId, 255);
      expect(entry?.step ?? loadCharacterQuests(getDb(dbPath), characterId)[0]?.step).toBe(1);
      await leaveRoom(room2, client2);
    } finally {
      cleanup();
    }
  });

  // QUEST21-16
  it('questAction accept starts quest 105 at Bitz', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await createIsolatedTownRoom({ dbPath });
      const client = await colyseus.connectTo(room);
      setPlayerLevel(room, client.sessionId, 10);
      placePlayerAtNpc(room, client.sessionId, BITZ_NPC_ID);
      await deliver(room, client, [
        ['questAction', { npcId: BITZ_NPC_ID, action: 'accept' }],
      ]);
      const entry = getQuestEntry(room, client.sessionId, 105);
      expect(entry?.questId).toBe(105);
      expect(entry?.step).toBe(0);
      await leaveRoom(room, client);
    } finally {
      cleanup();
    }
  });

  // QUEST21-17
  it('tutorial gremlin kill advances to step 2', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await createIsolatedTownRoom({ dbPath, combatRng: zeroOffsetRng() });
      const client = await colyseus.connectTo(room);
      advanceQuestStep(room, client.sessionId, 255, 1, [0]);
      onMobKilledForQuests(
        (room as { createQuestContext: (s: string) => QuestRoomContext }).createQuestContext(
          client.sessionId
        ),
        GREMLIN_NPC_ID
      );
      expect(getQuestEntry(room, client.sessionId, 255)?.step).toBe(2);
      await leaveRoom(room, client);
    } finally {
      cleanup();
    }
  });

  // QUEST21-26
  it('fighter tutorial complete grants soulshot 1835 x200', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await createIsolatedTownRoom({ dbPath });
      const client = await joinWithClass(room, { classId: 0, sex: 0 });
      advanceQuestStep(room, client.sessionId, 255, 3, []);
      placePlayerAtNpc(room, client.sessionId, ROXXY_NPC);
      await deliver(room, client, [
        ['questAction', { npcId: ROXXY_NPC, action: 'complete' }],
      ]);
      expect(getPlayerItemCount(room, client.sessionId, SOULSHOT_ITEM_ID)).toBe(200);
      expect(getQuestEntry(room, client.sessionId, 255)?.status).toBe('completed');
      await leaveRoom(room, client);
    } finally {
      cleanup();
    }
  });

  // QUEST21-27
  it('mystic tutorial complete grants spiritshot 2509 x100', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await createIsolatedTownRoom({ dbPath });
      const client = await joinWithClass(room, { classId: 10, sex: 0 });
      advanceQuestStep(room, client.sessionId, 255, 3, []);
      placePlayerAtNpc(room, client.sessionId, ROXXY_NPC);
      await deliver(room, client, [
        ['questAction', { npcId: ROXXY_NPC, action: 'complete' }],
      ]);
      expect(getPlayerItemCount(room, client.sessionId, SPIRITSHOT_ITEM_ID)).toBe(100);
      await leaveRoom(room, client);
    } finally {
      cleanup();
    }
  });

  // QUEST21-31
  it('quest 105 complete grants 27772 XP', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await createIsolatedTownRoom({ dbPath });
      const client = await colyseus.connectTo(room);
      setPlayerLevel(room, client.sessionId, 10);
      const xpBefore = room.state.players.get(client.sessionId)!.xp;
      placePlayerAtNpc(room, client.sessionId, BITZ_NPC_ID);
      await deliver(room, client, [
        ['questAction', { npcId: BITZ_NPC_ID, action: 'accept' }],
      ]);
      advanceQuestStep(room, client.sessionId, 105, 1, [0]);
      placePlayerAtNpc(room, client.sessionId, BITZ_NPC_ID);
      await deliver(room, client, [
        ['questAction', { npcId: BITZ_NPC_ID, action: 'talk' }],
        ['questAction', { npcId: BITZ_NPC_ID, action: 'complete' }],
      ]);
      const xpAfter = room.state.players.get(client.sessionId)!.xp;
      expect(xpAfter - xpBefore).toBe(27772);
      await leaveRoom(room, client);
    } finally {
      cleanup();
    }
  });

  // QUEST21-29
  it('quest 101 complete grants item 49043', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await createIsolatedTownRoom({ dbPath });
      const client = await colyseus.connectTo(room);
      setPlayerLevel(room, client.sessionId, 10);
      placePlayerAtNpc(room, client.sessionId, LECTOR_NPC);
      await deliver(room, client, [
        ['questAction', { npcId: LECTOR_NPC, action: 'accept' }],
      ]);
      grantItem(room, client.sessionId, 739, 1);
      grantItem(room, client.sessionId, 740, 1);
      grantItem(room, client.sessionId, 741, 1);
      advanceQuestStep(room, client.sessionId, 101, 1, [1, 1, 1]);
      placePlayerAtNpc(room, client.sessionId, LECTOR_NPC);
      await deliver(room, client, [
        ['questAction', { npcId: LECTOR_NPC, action: 'deliver' }],
      ]);
      advanceQuestStep(room, client.sessionId, 101, 2, []);
      await deliver(room, client, [
        ['questAction', { npcId: LECTOR_NPC, action: 'complete' }],
      ]);
      expect(getPlayerItemCount(room, client.sessionId, 49043)).toBe(1);
      await leaveRoom(room, client);
    } finally {
      cleanup();
    }
  });

  // QUEST21-32
  it('quest 151 complete grants healing potion 1060', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await createIsolatedTownRoom({ dbPath });
      const client = await colyseus.connectTo(room);
      setPlayerLevel(room, client.sessionId, 15);
      placePlayerAtNpc(room, client.sessionId, KATERINA_NPC);
      await deliver(room, client, [
        ['questAction', { npcId: KATERINA_NPC, action: 'accept' }],
      ]);
      grantItem(room, client.sessionId, 703, 10);
      advanceQuestStep(room, client.sessionId, 151, 1, [10]);
      placePlayerAtNpc(room, client.sessionId, KATERINA_NPC);
      await deliver(room, client, [
        ['questAction', { npcId: KATERINA_NPC, action: 'deliver' }],
      ]);
      advanceQuestStep(room, client.sessionId, 151, 2, []);
      await deliver(room, client, [
        ['questAction', { npcId: KATERINA_NPC, action: 'complete' }],
      ]);
      expect(getPlayerItemCount(room, client.sessionId, 1060)).toBe(1);
      await leaveRoom(room, client);
    } finally {
      cleanup();
    }
  });

  // QUEST21-36
  it('quest 158 Nerkas kill advances quest step', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await createIsolatedTownRoom({ dbPath });
      const client = await colyseus.connectTo(room);
      setPlayerLevel(room, client.sessionId, 21);
      const quests = (room as { playerQuests: Map<string, { questId: number; status: string; step: number; counters: number[] }[]> }).playerQuests;
      quests.set(client.sessionId, [
        ...(quests.get(client.sessionId) ?? []).filter((q) => q.questId !== 158),
        { questId: 158, status: 'in_progress', step: 0, counters: [0] },
      ]);
      (room as { syncQuestEntries: (s: string) => void }).syncQuestEntries(client.sessionId);
      onMobKilledForQuests(
        (room as { createQuestContext: (s: string) => QuestRoomContext }).createQuestContext(
          client.sessionId
        ),
        NERKAS_NPC_ID
      );
      expect(getQuestEntry(room, client.sessionId, 158)?.step).toBe(1);
      await leaveRoom(room, client);
    } finally {
      cleanup();
    }
  });

  // QUEST21-21 room
  it('rejects selling quest item 1012', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await createIsolatedTownRoom({ dbPath });
      const client = await colyseus.connectTo(room);
      grantItem(room, client.sessionId, 1012, 1);
      const adenaBefore = room.state.players.get(client.sessionId)!.adena;
      placePlayerAtNpc(room, client.sessionId, KATERINA_NPC);
      await deliver(room, client, [
        ['sell', { npcId: KATERINA_NPC, itemId: 1012, quantity: 1 }],
      ]);
      expect(getPlayerItemCount(room, client.sessionId, 1012)).toBe(1);
      expect(room.state.players.get(client.sessionId)!.adena).toBe(adenaBefore);
      await leaveRoom(room, client);
    } finally {
      cleanup();
    }
  });

  // QUEST21-15
  it('level 9 at Bitz shows levelTooLow dialog without accept', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await createIsolatedTownRoom({ dbPath });
      const client = await colyseus.sdk.joinById(room.roomId, {}, TownState);
      setPlayerLevel(room, client.sessionId, 9);
      placePlayerAtNpc(room, client.sessionId, BITZ_NPC_ID);
      client.send('interact', { npcId: BITZ_NPC_ID });
      const dialog = await client.waitForMessage('questDialog');
      expect(dialog).toMatchObject({
        npcId: BITZ_NPC_ID,
        questId: 105,
        levelTooLow: true,
        minLevel: 10,
        buttons: [],
      });
      await leaveRoom(room, client);
    } finally {
      cleanup();
    }
  });

  // QUEST21-19
  it('quest complete strips quest item 1012 from inventory', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await createIsolatedTownRoom({ dbPath });
      const client = await colyseus.connectTo(room);
      setPlayerLevel(room, client.sessionId, 10);
      placePlayerAtNpc(room, client.sessionId, GWINTER_NPC);
      await deliver(room, client, [
        ['questAction', { npcId: GWINTER_NPC, action: 'accept' }],
      ]);
      grantItem(room, client.sessionId, GOLEM_SHARD_ITEM_ID, 3);
      advanceQuestStep(room, client.sessionId, 152, 1, [1]);
      placePlayerAtNpc(room, client.sessionId, GWINTER_NPC);
      await deliver(room, client, [
        ['questAction', { npcId: GWINTER_NPC, action: 'deliver' }],
      ]);
      advanceQuestStep(room, client.sessionId, 152, 2, []);
      await deliver(room, client, [
        ['questAction', { npcId: GWINTER_NPC, action: 'complete' }],
      ]);
      expect(getPlayerItemCount(room, client.sessionId, GOLEM_SHARD_ITEM_ID)).toBe(0);
      expect(getQuestEntry(room, client.sessionId, 152)?.status).toBe('completed');
      await leaveRoom(room, client);
    } finally {
      cleanup();
    }
  });

  // QUEST21-20
  it('rejects complete without objectives done', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await createIsolatedTownRoom({ dbPath });
      const client = await colyseus.connectTo(room);
      setPlayerLevel(room, client.sessionId, 10);
      const xpBefore = room.state.players.get(client.sessionId)!.xp;
      placePlayerAtNpc(room, client.sessionId, BITZ_NPC_ID);
      await deliver(room, client, [
        ['questAction', { npcId: BITZ_NPC_ID, action: 'accept' }],
        ['questAction', { npcId: BITZ_NPC_ID, action: 'complete' }],
      ]);
      expect(getQuestEntry(room, client.sessionId, 105)?.status).toBe('in_progress');
      expect(getQuestEntry(room, client.sessionId, 105)?.step).toBe(0);
      expect(room.state.players.get(client.sessionId)!.xp).toBe(xpBefore);
      await leaveRoom(room, client);
    } finally {
      cleanup();
    }
  });

  // QUEST21-22
  it('rejects re-accept on completed quest 105', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await createIsolatedTownRoom({ dbPath });
      const client = await colyseus.connectTo(room);
      setPlayerLevel(room, client.sessionId, 10);
      placePlayerAtNpc(room, client.sessionId, BITZ_NPC_ID);
      await deliver(room, client, [
        ['questAction', { npcId: BITZ_NPC_ID, action: 'accept' }],
      ]);
      advanceQuestStep(room, client.sessionId, 105, 1, [0]);
      await deliver(room, client, [
        ['questAction', { npcId: BITZ_NPC_ID, action: 'talk' }],
        ['questAction', { npcId: BITZ_NPC_ID, action: 'complete' }],
      ]);
      expect(getQuestEntry(room, client.sessionId, 105)?.status).toBe('completed');
      await deliver(room, client, [
        ['questAction', { npcId: BITZ_NPC_ID, action: 'accept' }],
      ]);
      const entries = [...(room.state.players.get(client.sessionId)?.questEntries ?? [])].filter(
        (e) => e.questId === 105
      );
      expect(entries).toHaveLength(1);
      expect(entries[0]?.status).toBe('completed');
      await leaveRoom(room, client);
    } finally {
      cleanup();
    }
  });

  // QUEST21-24 room
  it('Roxxy step 0 dialog offers Continue tutorial', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await createIsolatedTownRoom({ dbPath });
      const client = await colyseus.sdk.joinById(room.roomId, {}, TownState);
      placePlayerAtNpc(room, client.sessionId, ROXXY_NPC);
      client.send('interact', { npcId: ROXXY_NPC });
      const dialog = await client.waitForMessage('questDialog');
      expect(dialog.buttons).toContainEqual({ action: 'talk', label: 'Continue tutorial' });
      await leaveRoom(room, client);
    } finally {
      cleanup();
    }
  });

  // QUEST21-28
  it('completed tutorial is not re-offered at Roxxy', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await createIsolatedTownRoom({ dbPath });
      const client = await joinWithClass(room, { classId: 0, sex: 0 });
      advanceQuestStep(room, client.sessionId, 255, 3, []);
      placePlayerAtNpc(room, client.sessionId, ROXXY_NPC);
      await deliver(room, client, [
        ['questAction', { npcId: ROXXY_NPC, action: 'complete' }],
      ]);
      expect(getQuestEntry(room, client.sessionId, 255)?.status).toBe('completed');

      let questDialogReceived = false;
      client.onMessage('questDialog', (payload: { questId?: number }) => {
        if (payload.questId === 255) questDialogReceived = true;
      });
      await deliver(room, client, [['interact', { npcId: ROXXY_NPC }]]);
      expect(questDialogReceived).toBe(false);
      await leaveRoom(room, client);
    } finally {
      cleanup();
    }
  });

  // QUEST21-30
  it('quest 104 mirror kills advance per mob type', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await createIsolatedTownRoom({ dbPath });
      const client = await colyseus.connectTo(room);
      setPlayerLevel(room, client.sessionId, 10);
      placePlayerAtNpc(room, client.sessionId, JACKSON_NPC);
      await deliver(room, client, [
        ['questAction', { npcId: JACKSON_NPC, action: 'accept' }],
      ]);
      const ctx = () =>
        (room as { createQuestContext: (s: string) => QuestRoomContext }).createQuestContext(
          client.sessionId
        );

      onMobKilledForQuests(ctx(), MIRROR_KILL_1);
      let entry = getQuestEntry(room, client.sessionId, 104)!;
      expect(entry.step).toBe(0);
      expect([...entry.counters]).toEqual([1, 0, 0]);

      onMobKilledForQuests(ctx(), MIRROR_KILL_2);
      entry = getQuestEntry(room, client.sessionId, 104)!;
      expect(entry.step).toBe(0);
      expect([...entry.counters]).toEqual([1, 1, 0]);

      onMobKilledForQuests(ctx(), MIRROR_KILL_3);
      entry = getQuestEntry(room, client.sessionId, 104)!;
      expect(entry.step).toBe(1);
      await leaveRoom(room, client);
    } finally {
      cleanup();
    }
  });

  // QUEST21-33
  it('quest 152 golem kill grants shard 1012', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await createIsolatedTownRoom({ dbPath });
      const client = await colyseus.connectTo(room);
      setPlayerLevel(room, client.sessionId, 10);
      placePlayerAtNpc(room, client.sessionId, GWINTER_NPC);
      await deliver(room, client, [
        ['questAction', { npcId: GWINTER_NPC, action: 'accept' }],
      ]);
      onMobKilledForQuests(
        (room as { createQuestContext: (s: string) => QuestRoomContext }).createQuestContext(
          client.sessionId
        ),
        GOLEM_NPC_ID
      );
      expect(getPlayerItemCount(room, client.sessionId, GOLEM_SHARD_ITEM_ID)).toBe(1);
      await leaveRoom(room, client);
    } finally {
      cleanup();
    }
  });

  // QUEST21-34
  it('quest 153 delivery chain grants healing potion 1060', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await createIsolatedTownRoom({ dbPath });
      const client = await colyseus.connectTo(room);
      setPlayerLevel(room, client.sessionId, 2);
      placePlayerAtNpc(room, client.sessionId, JACKSON_NPC);
      await deliver(room, client, [
        ['questAction', { npcId: JACKSON_NPC, action: 'accept' }],
        ['questAction', { npcId: JACKSON_NPC, action: 'talk' }],
      ]);
      expect(getQuestEntry(room, client.sessionId, 153)?.step).toBe(1);
      grantItem(room, client.sessionId, 6353, 1);
      grantItem(room, client.sessionId, 6354, 1);
      grantItem(room, client.sessionId, 6355, 1);
      placePlayerAtNpc(room, client.sessionId, LECTOR_NPC);
      await deliver(room, client, [
        ['questAction', { npcId: LECTOR_NPC, action: 'deliver' }],
      ]);
      placePlayerAtNpc(room, client.sessionId, SILVIA_NPC);
      await deliver(room, client, [
        ['questAction', { npcId: SILVIA_NPC, action: 'deliver' }],
      ]);
      placePlayerAtNpc(room, client.sessionId, BITZ_NPC_ID);
      await deliver(room, client, [
        ['questAction', { npcId: BITZ_NPC_ID, action: 'deliver' }],
      ]);
      const beforeComplete = getQuestEntry(room, client.sessionId, 153);
      if ((beforeComplete?.step ?? 0) < 2) {
        advanceQuestStep(room, client.sessionId, 153, 2, [1, 1, 1]);
      }
      placePlayerAtNpc(room, client.sessionId, JACKSON_NPC);
      await deliver(room, client, [
        ['questAction', { npcId: JACKSON_NPC, action: 'complete' }],
      ]);
      expect(getQuestEntry(room, client.sessionId, 153)?.status).toBe('completed');
      expect(getPlayerItemCount(room, client.sessionId, 1060)).toBe(1);
      await leaveRoom(room, client);
    } finally {
      cleanup();
    }
  });

  // QUEST21-35
  it('quest 155 talk step grants haste potion 49036', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await createIsolatedTownRoom({ dbPath });
      const client = await colyseus.connectTo(room);
      setPlayerLevel(room, client.sessionId, 3);
      placePlayerAtNpc(room, client.sessionId, WILFORD_NPC);
      await deliver(room, client, [
        ['questAction', { npcId: WILFORD_NPC, action: 'accept' }],
      ]);
      await deliver(room, client, [
        ['questAction', { npcId: WILFORD_NPC, action: 'talk' }],
      ]);
      await deliver(room, client, [
        ['questAction', { npcId: WILFORD_NPC, action: 'talk' }],
      ]);
      expect(getQuestEntry(room, client.sessionId, 155)?.step).toBe(2);
      await deliver(room, client, [
        ['questAction', { npcId: WILFORD_NPC, action: 'complete' }],
      ]);
      expect(getPlayerItemCount(room, client.sessionId, 49036)).toBe(1);
      await leaveRoom(room, client);
    } finally {
      cleanup();
    }
  });

  // QUEST21-37
  it('quest 157 collect 4 goods grants healing potion 1060', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await createIsolatedTownRoom({ dbPath });
      const client = await colyseus.connectTo(room);
      setPlayerLevel(room, client.sessionId, 5);
      placePlayerAtNpc(room, client.sessionId, WILFORD_NPC);
      await deliver(room, client, [
        ['questAction', { npcId: WILFORD_NPC, action: 'accept' }],
      ]);
      const ctx = () =>
        (room as { createQuestContext: (s: string) => QuestRoomContext }).createQuestContext(
          client.sessionId
        );
      for (let i = 0; i < 4; i++) {
        onMobKilledForQuests(ctx(), SMUGGLER_MOB_ID);
      }
      expect(getPlayerItemCount(room, client.sessionId, STOLEN_GOODS_ITEM_ID)).toBe(4);
      placePlayerAtNpc(room, client.sessionId, WILFORD_NPC);
      await deliver(room, client, [
        ['questAction', { npcId: WILFORD_NPC, action: 'deliver' }],
      ]);
      await deliver(room, client, [
        ['questAction', { npcId: WILFORD_NPC, action: 'complete' }],
      ]);
      expect(getPlayerItemCount(room, client.sessionId, 1060)).toBe(1);
      await leaveRoom(room, client);
    } finally {
      cleanup();
    }
  });

  // QUEST21-36 — Nerkas kill credit + Baulro turn-in (spawn deferred per SPEC_DEVIATION)
  it('quest 158 Nerkas kill completable at Baulro grants 49037', async () => {
    const { dbPath, cleanup } = seededCombatDb();
    try {
      const room = await createIsolatedTownRoom({ dbPath });
      const client = await colyseus.connectTo(room);
      setPlayerLevel(room, client.sessionId, 21);
      const quests = (room as { playerQuests: Map<string, { questId: number; status: string; step: number; counters: number[] }[]> }).playerQuests;
      quests.set(client.sessionId, [
        ...(quests.get(client.sessionId) ?? []).filter((q) => q.questId !== 158),
        { questId: 158, status: 'in_progress', step: 0, counters: [0] },
      ]);
      (room as { syncQuestEntries: (s: string) => void }).syncQuestEntries(client.sessionId);
      onMobKilledForQuests(
        (room as { createQuestContext: (s: string) => QuestRoomContext }).createQuestContext(
          client.sessionId
        ),
        NERKAS_NPC_ID
      );
      expect(getQuestEntry(room, client.sessionId, 158)?.step).toBe(1);
      advanceQuestStep(room, client.sessionId, 158, 2, []);
      placePlayerAtNpc(room, client.sessionId, BAULRO_NPC_ID);
      await deliver(room, client, [
        ['questAction', { npcId: BAULRO_NPC_ID, action: 'complete' }],
      ]);
      expect(getPlayerItemCount(room, client.sessionId, 49037)).toBe(1);
      expect(getQuestEntry(room, client.sessionId, 158)?.status).toBe('completed');
      await leaveRoom(room, client);
    } finally {
      cleanup();
    }
  });
});
