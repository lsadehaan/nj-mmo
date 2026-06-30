import type { ColyseusTestServer } from '@colyseus/testing';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SPAWN_X, SPAWN_Z, snapEntityY, getZoneAt, registerStrBonusEntries, EntityAction } from '@nj/game-core';
import { runSeed, FIXTURE_DATA_DIR } from '../seed/seed';
import { DEFAULT_SIM_INTERVAL_MS } from './TownRoom';
import type { MobRuntime } from './spawn-manager';
import { acquireTownRoomTestServer, releaseTownRoomTestServer } from './town-room-harness';

const OUT_OF_PEACE = { x: -150, z: 55 };
const GREMLIN_NPC_ID = 20001;
const BITZ_NPC_ID = 30026;
const BIOTIN_NPC_ID = 30031;
const POWER_STRIKE_SKILL_ID = 3;

let colyseus: ColyseusTestServer;

beforeAll(async () => {
  colyseus = await acquireTownRoomTestServer();
}, 60_000);

afterAll(async () => {
  await releaseTownRoomTestServer();
});

function tempDbPath(): { dbPath: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), 'nj-prog-'));
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

async function leaveRoom(room: TestRoom, client: TestClient) {
  await client.leave(true);
  await room.disconnect();
  await new Promise<void>((resolve) => setImmediate(resolve));
}

async function createRoom(dbPath: string, opts: { nowMs?: () => number; combatRng?: ReturnType<typeof zeroOffsetRng> } = {}) {
  return colyseus.createRoom('town', {
    instanceKey: randomUUID(),
    dbPath,
    combatRng: opts.combatRng ?? zeroOffsetRng(),
    nowMs: opts.nowMs,
  });
}

function setPlayerProgress(
  room: TestRoom,
  sessionId: string,
  patch: { level?: number; xp?: number; hp?: number; sp?: number; adena?: number; karma?: number }
) {
  const player = room.state.players.get(sessionId)!;
  const stored = (room as { characters: Map<string, Record<string, number>> }).characters.get(
    sessionId
  )!;
  if (patch.level !== undefined) {
    player.level = patch.level;
    stored.level = patch.level;
  }
  if (patch.xp !== undefined) {
    player.xp = patch.xp;
    stored.xp = patch.xp;
  }
  if (patch.hp !== undefined) player.hp = patch.hp;
  if (patch.sp !== undefined) {
    player.sp = patch.sp;
    stored.sp = patch.sp;
  }
  if (patch.adena !== undefined) {
    player.adena = patch.adena;
    stored.adena = patch.adena;
  }
  if (patch.karma !== undefined) {
    player.karma = patch.karma;
    stored.karma = patch.karma;
  }
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

function findMobByNpcId(room: TestRoom, npcId: number) {
  return [...room.state.mobs.values()].find((m) => m.npcId === npcId);
}

function relocateMob(room: TestRoom, mobId: string, x: number, z: number) {
  const runtime = (room as { mobRuntime: Map<string, MobRuntime> }).mobRuntime.get(mobId)!;
  runtime.x = x;
  runtime.z = z;
  const mob = room.state.mobs.get(mobId)!;
  mob.x = x;
  mob.z = z;
}

function placePlayerAndMobForCombat(room: TestRoom, sessionId: string, mobId: string) {
  relocateMob(room, mobId, OUT_OF_PEACE.x, OUT_OF_PEACE.z);
  placePlayerNear(room, sessionId, OUT_OF_PEACE.x, OUT_OF_PEACE.z);
}

function killMob(room: TestRoom, sessionId: string, mobId: string) {
  const runtime = (room as { mobRuntime: Map<string, MobRuntime> }).mobRuntime.get(mobId)!;
  placePlayerAndMobForCombat(room, sessionId, mobId);
  const combat = (room as {
    playerCombat: Map<string, { targetMobId: string | null; attackPending: boolean; nextAttackAtMs: number }>;
  }).playerCombat.get(sessionId)!;
  combat.targetMobId = mobId;
  combat.nextAttackAtMs = 0;
  combat.attackPending = true;
  runtime.hp = 1;
  tick(room);
}

function killPlayerViaMob(room: TestRoom, sessionId: string, mobId: string) {
  relocateMob(room, mobId, OUT_OF_PEACE.x, OUT_OF_PEACE.z);
  placePlayerNear(room, sessionId, OUT_OF_PEACE.x, OUT_OF_PEACE.z);
  const player = room.state.players.get(sessionId)!;
  const runtime = (room as { mobRuntime: Map<string, MobRuntime> }).mobRuntime.get(mobId)!;
  player.hp = 1;
  runtime.targetSessionId = sessionId;
  runtime.nextAttackAtMs = 0;
  tick(room);
}

function openTrainerNearBitz(room: TestRoom, sessionId: string) {
  const npc = [...room.state.npcs.values()].find((n) => n.npcId === BITZ_NPC_ID)!;
  placePlayerNear(room, sessionId, npc.x, npc.z);
  (room as { playerCombat: Map<string, { openTrainerNpcId: number }> }).playerCombat.get(
    sessionId
  )!.openTrainerNpcId = BITZ_NPC_ID;
}

async function learnPowerStrike(
  room: TestRoom,
  client: TestClient,
  sessionId: string
): Promise<void> {
  setPlayerProgress(room, sessionId, { sp: 5000 });
  openTrainerNearBitz(room, sessionId);
  await deliver(room, client, [['learnSkill', { skillId: POWER_STRIKE_SKILL_ID }]]);
}

async function dealMeleeHitToMob(
  room: TestRoom,
  client: TestClient,
  sessionId: string,
  mobId: string
): Promise<number> {
  const mob = room.state.mobs.get(mobId)!;
  const hpBefore = mob.hp;
  const combat = (room as {
    playerCombat: Map<string, { nextAttackAtMs: number }>;
  }).playerCombat.get(sessionId)!;
  combat.nextAttackAtMs = 0;
  await deliver(room, client, [
    ['setTarget', { mobId }],
    ['attack', {}],
  ]);
  tick(room);
  return hpBefore - mob.hp;
}

function prepareMobForHits(room: TestRoom, sessionId: string, mobId: string) {
  const runtime = (room as { mobRuntime: Map<string, MobRuntime> }).mobRuntime.get(mobId)!;
  runtime.hp = 50_000;
  runtime.maxHp = 50_000;
  room.state.mobs.get(mobId)!.hp = 50_000;
  placePlayerAndMobForCombat(room, sessionId, mobId);
}

describe('TownRoom progression (PROG27)', () => {
  it('PROG27-05: level 10 death loses 2039 XP and records expBeforeDeath', async () => {
    const { dbPath, cleanup } = seededDb();
    try {
      const room = await createRoom(dbPath);
      const client = await colyseus.connectTo(room);
      setPlayerProgress(room, client.sessionId, { level: 10, xp: 50000 });
      const gremlin = findMobByNpcId(room, GREMLIN_NPC_ID)!;
      killPlayerViaMob(room, client.sessionId, gremlin.id);
      const player = room.state.players.get(client.sessionId)!;
      expect(player.xp).toBe(47961);
      expect(player.expBeforeDeath).toBe(50000);
      await leaveRoom(room, client);
    } finally {
      cleanup();
    }
  });

  it('PROG27-06: level 9 death preserves XP', async () => {
    const { dbPath, cleanup } = seededDb();
    try {
      const room = await createRoom(dbPath);
      const client = await colyseus.connectTo(room);
      setPlayerProgress(room, client.sessionId, { level: 9, xp: 40000 });
      const gremlin = findMobByNpcId(room, GREMLIN_NPC_ID)!;
      killPlayerViaMob(room, client.sessionId, gremlin.id);
      expect(room.state.players.get(client.sessionId)!.xp).toBe(40000);
      await leaveRoom(room, client);
    } finally {
      cleanup();
    }
  });

  it('PROG27-07: death respawns at town spawn with full HP/MP', async () => {
    const { dbPath, cleanup } = seededDb();
    try {
      const room = await createRoom(dbPath);
      const client = await colyseus.connectTo(room);
      const player = room.state.players.get(client.sessionId)!;
      const gremlin = findMobByNpcId(room, GREMLIN_NPC_ID)!;
      killPlayerViaMob(room, client.sessionId, gremlin.id);
      expect(player.hp).toBe(player.maxHp);
      expect(player.mp).toBe(player.maxMp);
      expect(player.x).toBe(SPAWN_X);
      expect(player.z).toBe(SPAWN_Z);
      await leaveRoom(room, client);
    } finally {
      cleanup();
    }
  });

  it('PROG27-07b: dead player holds the death pose and ignores moves, then stands up', async () => {
    const { dbPath, cleanup } = seededDb();
    try {
      let clock = 1_000_000;
      const room = await createRoom(dbPath, { nowMs: () => clock });
      const client = await colyseus.connectTo(room);
      const player = room.state.players.get(client.sessionId)!;
      const gremlin = findMobByNpcId(room, GREMLIN_NPC_ID)!;

      killPlayerViaMob(room, client.sessionId, gremlin.id);
      // Respawned at town with full HP, playing the death clip.
      expect(player.action).toBe(EntityAction.Die);
      const restX = player.x;
      const restZ = player.z;

      // A move queued during the freeze must not slide the corpse.
      await deliver(room, client, [['move', { targetX: restX + 20, targetZ: restZ + 20 }]]);
      tick(room);
      expect(player.x).toBe(restX);
      expect(player.z).toBe(restZ);
      expect(player.action).toBe(EntityAction.Die);

      // Once the death freeze elapses, the player stands back up (action cleared).
      clock += 2000;
      tick(room);
      expect(player.action).toBe(EntityAction.None);

      await leaveRoom(room, client);
    } finally {
      cleanup();
    }
  });

  it('PROG27-08: death delevel refreshes maxHp/maxMp', async () => {
    const { dbPath, cleanup } = seededDb();
    try {
      const room = await createRoom(dbPath);
      const client = await colyseus.connectTo(room);
      setPlayerProgress(room, client.sessionId, { level: 11, xp: 72000 });
      const player = room.state.players.get(client.sessionId)!;
      const prevMaxHp = player.maxHp;
      const gremlin = findMobByNpcId(room, GREMLIN_NPC_ID)!;
      killPlayerViaMob(room, client.sessionId, gremlin.id);
      expect(player.level).toBe(10);
      expect(player.maxHp).not.toBe(prevMaxHp);
      await leaveRoom(room, client);
    } finally {
      cleanup();
    }
  });

  it('PROG27-11: Biotin restoreExp restores XP and deducts adena', async () => {
    const { dbPath, cleanup } = seededDb();
    try {
      const room = await createRoom(dbPath);
      const client = await colyseus.connectTo(room);
      const player = room.state.players.get(client.sessionId)!;
      player.xp = 47961;
      player.expBeforeDeath = 50000;
      player.adena = 50000;
      const biotin = [...room.state.npcs.values()].find((n) => n.npcId === BIOTIN_NPC_ID)!;
      placePlayerNear(room, client.sessionId, biotin.x, biotin.z);
      await deliver(room, client, [['npcAction', { npcId: BIOTIN_NPC_ID, action: 'restoreExp' }]]);
      expect(player.xp).toBe(50000);
      expect(player.adena).toBe(50000 - 2039 * 10);
      expect(player.expBeforeDeath).toBe(0);
      await leaveRoom(room, client);
    } finally {
      cleanup();
    }
  });

  it('PROG27-12: restoreExp rejects insufficient adena', async () => {
    const { dbPath, cleanup } = seededDb();
    try {
      const room = await createRoom(dbPath);
      const client = await colyseus.connectTo(room);
      const player = room.state.players.get(client.sessionId)!;
      player.xp = 47961;
      player.expBeforeDeath = 50000;
      player.adena = 100;
      const biotin = [...room.state.npcs.values()].find((n) => n.npcId === BIOTIN_NPC_ID)!;
      placePlayerNear(room, client.sessionId, biotin.x, biotin.z);
      await deliver(room, client, [['npcAction', { npcId: BIOTIN_NPC_ID, action: 'restoreExp' }]]);
      expect(player.xp).toBe(47961);
      expect(player.adena).toBe(100);
      await leaveRoom(room, client);
    } finally {
      cleanup();
    }
  });

  it('PROG27-16: level 20 player gains no XP from Gremlin kill', async () => {
    const { dbPath, cleanup } = seededDb();
    try {
      const room = await createRoom(dbPath);
      const client = await colyseus.connectTo(room);
      setPlayerProgress(room, client.sessionId, { level: 20, xp: 835864 });
      const gremlin = findMobByNpcId(room, GREMLIN_NPC_ID)!;
      killMob(room, client.sessionId, gremlin.id);
      expect(room.state.players.get(client.sessionId)!.xp).toBe(835864);
      await leaveRoom(room, client);
    } finally {
      cleanup();
    }
  });

  it('PROG27-17: solo Gremlin kill grants SP', async () => {
    const { dbPath, cleanup } = seededDb();
    try {
      const room = await createRoom(dbPath);
      const client = await colyseus.connectTo(room);
      setPlayerProgress(room, client.sessionId, { sp: 0 });
      const gremlin = findMobByNpcId(room, GREMLIN_NPC_ID)!;
      killMob(room, client.sessionId, gremlin.id);
      expect(room.state.players.get(client.sessionId)!.sp).toBe(7);
      await leaveRoom(room, client);
    } finally {
      cleanup();
    }
  });

  it('PROG27-18: learnSkill rejects when SP insufficient', async () => {
    const { dbPath, cleanup } = seededDb();
    try {
      const room = await createRoom(dbPath);
      const client = await colyseus.connectTo(room);
      setPlayerProgress(room, client.sessionId, { sp: 0 });
      openTrainerNearBitz(room, client.sessionId);
      await deliver(room, client, [['learnSkill', { skillId: POWER_STRIKE_SKILL_ID }]]);
      const skills = (room as { playerSkills: Map<string, Record<number, number>> }).playerSkills.get(
        client.sessionId
      )!;
      expect(skills[POWER_STRIKE_SKILL_ID]).toBeUndefined();
      await leaveRoom(room, client);
    } finally {
      cleanup();
    }
  });

  it('PROG27-19: learnSkill deducts SP on success', async () => {
    const { dbPath, cleanup } = seededDb();
    try {
      const room = await createRoom(dbPath);
      const client = await colyseus.connectTo(room);
      setPlayerProgress(room, client.sessionId, { sp: 5000 });
      openTrainerNearBitz(room, client.sessionId);
      const before = room.state.players.get(client.sessionId)!.sp;
      await deliver(room, client, [['learnSkill', { skillId: POWER_STRIKE_SKILL_ID }]]);
      const after = room.state.players.get(client.sessionId)!.sp;
      expect(after).toBeLessThan(before);
      await leaveRoom(room, client);
    } finally {
      cleanup();
    }
  });

  it('PROG27-25: resetStats at Bitz refunds points for adena', async () => {
    const { dbPath, cleanup } = seededDb();
    try {
      const room = await createRoom(dbPath);
      const client = await colyseus.connectTo(room);
      const player = room.state.players.get(client.sessionId)!;
      player.level = 12;
      player.bonusStr = 3;
      player.unspentStatPoints = 0;
      player.adena = 20000;
      openTrainerNearBitz(room, client.sessionId);
      await deliver(room, client, [['resetStats', {}]]);
      expect(player.bonusStr).toBe(0);
      expect(player.unspentStatPoints).toBe(11);
      expect(player.adena).toBe(20000 - 12000);
      await leaveRoom(room, client);
    } finally {
      cleanup();
    }
  });

  it('PROG27-26: resetStats rejects out of trainer range', async () => {
    const { dbPath, cleanup } = seededDb();
    try {
      const room = await createRoom(dbPath);
      const client = await colyseus.connectTo(room);
      placePlayerNear(room, client.sessionId, OUT_OF_PEACE.x, OUT_OF_PEACE.z);
      (room as { playerCombat: Map<string, { openTrainerNpcId: number }> }).playerCombat.get(
        client.sessionId
      )!.openTrainerNpcId = BITZ_NPC_ID;
      const before = room.state.players.get(client.sessionId)!.bonusStr;
      await deliver(room, client, [['resetStats', {}]]);
      expect(room.state.players.get(client.sessionId)!.bonusStr).toBe(before);
      await leaveRoom(room, client);
    } finally {
      cleanup();
    }
  });

  it('PROG27-28: stat reset lowers melee damage on next hit', async () => {
    registerStrBonusEntries({ 41: 1.24, 42: 1.29, 43: 1.33 });
    const { dbPath, cleanup } = seededDb();
    try {
      const room = await createRoom(dbPath);
      const client = await colyseus.connectTo(room);
      const player = room.state.players.get(client.sessionId)!;
      const stored = (room as { characters: Map<string, Record<string, number>> }).characters.get(
        client.sessionId
      )!;
      player.level = 12;
      player.unspentStatPoints = 3;
      player.adena = 20_000;
      stored.level = 12;
      stored.unspentStatPoints = 3;
      stored.adena = 20_000;

      const gremlin = findMobByNpcId(room, GREMLIN_NPC_ID)!;
      prepareMobForHits(room, client.sessionId, gremlin.id);

      for (let i = 0; i < 3; i++) {
        await deliver(room, client, [['allocateStat', { stat: 'str' }]]);
      }
      expect(player.bonusStr).toBe(3);

      const damageWithBonus = await dealMeleeHitToMob(
        room,
        client,
        client.sessionId,
        gremlin.id
      );
      expect(damageWithBonus).toBeGreaterThan(0);

      openTrainerNearBitz(room, client.sessionId);
      await deliver(room, client, [['resetStats', {}]]);
      expect(player.bonusStr).toBe(0);

      prepareMobForHits(room, client.sessionId, gremlin.id);
      const damageAfterReset = await dealMeleeHitToMob(
        room,
        client,
        client.sessionId,
        gremlin.id
      );
      expect(damageAfterReset).toBeLessThan(damageWithBonus);

      await leaveRoom(room, client);
    } finally {
      cleanup();
    }
  });

  it('PROG27-29: togglePvp sets flag for 120s', async () => {
    const clock = { now: 1000 };
    const { dbPath, cleanup } = seededDb();
    try {
      const room = await createRoom(dbPath, { nowMs: () => clock.now });
      const client = await colyseus.connectTo(room);
      placePlayerNear(room, client.sessionId, OUT_OF_PEACE.x, OUT_OF_PEACE.z);
      await deliver(room, client, [['togglePvp', {}]]);
      const player = room.state.players.get(client.sessionId)!;
      expect(player.pvpFlag).toBe(1);
      expect(player.pvpFlagEndMs).toBe(1000 + 120000);
      await leaveRoom(room, client);
    } finally {
      cleanup();
    }
  });

  it('PROG27-30: expired pvp flag clears on tick', async () => {
    const clock = { now: 0 };
    const { dbPath, cleanup } = seededDb();
    try {
      const room = await createRoom(dbPath, { nowMs: () => clock.now });
      const client = await colyseus.connectTo(room);
      placePlayerNear(room, client.sessionId, OUT_OF_PEACE.x, OUT_OF_PEACE.z);
      await deliver(room, client, [['togglePvp', {}]]);
      clock.now = 120001;
      tick(room);
      expect(room.state.players.get(client.sessionId)!.pvpFlag).toBe(0);
      await leaveRoom(room, client);
    } finally {
      cleanup();
    }
  });

  it('PROG27-31: PK on innocent decreases karma by 720', async () => {
    const { dbPath, cleanup } = seededDb();
    try {
      const room = await createRoom(dbPath);
      const killer = await colyseus.connectTo(room);
      const victim = await colyseus.connectTo(room);
      const victimPlayer = room.state.players.get(victim.sessionId)!;
      (room as { pendingPlayerKiller: Map<string, string> }).pendingPlayerKiller.set(
        victim.sessionId,
        killer.sessionId
      );
      victimPlayer.hp = 0;
      tick(room);
      expect(room.state.players.get(killer.sessionId)!.karma).toBe(-720);
      await leaveRoom(room, killer);
      await leaveRoom(room, victim);
    } finally {
      cleanup();
    }
  });

  it('PROG27-32: flagged kill does not decrease karma', async () => {
    const clock = { now: 1000 };
    const { dbPath, cleanup } = seededDb();
    try {
      const room = await createRoom(dbPath, { nowMs: () => clock.now });
      const killer = await colyseus.connectTo(room);
      const victim = await colyseus.connectTo(room);
      const victimPlayer = room.state.players.get(victim.sessionId)!;
      victimPlayer.pvpFlag = 1;
      victimPlayer.pvpFlagEndMs = 999_999;
      const victimStored = (room as { characters: Map<string, { pvpFlagEndMs: number }> }).characters.get(
        victim.sessionId
      )!;
      victimStored.pvpFlagEndMs = 999_999;
      (room as { pendingPlayerKiller: Map<string, string> }).pendingPlayerKiller.set(
        victim.sessionId,
        killer.sessionId
      );
      victimPlayer.hp = 0;
      tick(room);
      expect(room.state.players.get(killer.sessionId)!.karma).toBe(0);
      await leaveRoom(room, killer);
      await leaveRoom(room, victim);
    } finally {
      cleanup();
    }
  });

  it('PROG27-33: flagged kill increments pvpKills', async () => {
    const clock = { now: 1000 };
    const { dbPath, cleanup } = seededDb();
    try {
      const room = await createRoom(dbPath, { nowMs: () => clock.now });
      const killer = await colyseus.connectTo(room);
      const victim = await colyseus.connectTo(room);
      const victimPlayer = room.state.players.get(victim.sessionId)!;
      victimPlayer.pvpFlag = 1;
      victimPlayer.pvpFlagEndMs = 999_999;
      const victimStored = (room as { characters: Map<string, { pvpFlagEndMs: number }> }).characters.get(
        victim.sessionId
      )!;
      victimStored.pvpFlagEndMs = 999_999;
      (room as { pendingPlayerKiller: Map<string, string> }).pendingPlayerKiller.set(
        victim.sessionId,
        killer.sessionId
      );
      victimPlayer.hp = 0;
      tick(room);
      const stored = (room as { characters: Map<string, { pvpKills: number }> }).characters.get(
        killer.sessionId
      )!;
      expect(stored.pvpKills).toBe(1);
      await leaveRoom(room, killer);
      await leaveRoom(room, victim);
    } finally {
      cleanup();
    }
  });

  it('PROG27-35: togglePvp in peace zone rejects', async () => {
    const { dbPath, cleanup } = seededDb();
    try {
      const room = await createRoom(dbPath);
      const client = await colyseus.connectTo(room);
      placePlayerNear(room, client.sessionId, 0, 0);
      await deliver(room, client, [['togglePvp', {}]]);
      expect(room.state.players.get(client.sessionId)!.pvpFlag).toBe(0);
      await leaveRoom(room, client);
    } finally {
      cleanup();
    }
  });

  it('PROG27-40: attack in peace zone deals 0 damage', async () => {
    const { dbPath, cleanup } = seededDb();
    try {
      const room = await createRoom(dbPath);
      const killer = await colyseus.connectTo(room);
      const victim = await colyseus.connectTo(room);
      placePlayerNear(room, killer.sessionId, 0, 0);
      placePlayerNear(room, victim.sessionId, 0, 0);
      await deliver(room, victim, [['togglePvp', {}]]);
      const hpBefore = room.state.players.get(victim.sessionId)!.hp;
      await deliver(room, killer, [
        ['setTargetPlayer', { sessionId: victim.sessionId }],
        ['attack', {}],
      ]);
      tick(room);
      expect(room.state.players.get(victim.sessionId)!.hp).toBe(hpBefore);
      await leaveRoom(room, killer);
      await leaveRoom(room, victim);
    } finally {
      cleanup();
    }
  });

  it('PROG27-41: two-session PvP hit reduces flagged player HP', async () => {
    const clock = { now: 1000 };
    const { dbPath, cleanup } = seededDb();
    try {
      const room = await createRoom(dbPath, { nowMs: () => clock.now });
      const attacker = await colyseus.connectTo(room);
      const flagged = await colyseus.connectTo(room);
      placePlayerNear(room, attacker.sessionId, OUT_OF_PEACE.x, OUT_OF_PEACE.z);
      placePlayerNear(room, flagged.sessionId, OUT_OF_PEACE.x, OUT_OF_PEACE.z);
      await deliver(room, flagged, [['togglePvp', {}]]);
      const hpBefore = room.state.players.get(flagged.sessionId)!.hp;
      const attackerCombat = (room as {
        playerCombat: Map<string, { nextAttackAtMs: number }>;
      }).playerCombat.get(attacker.sessionId)!;
      attackerCombat.nextAttackAtMs = 0;
      await deliver(room, attacker, [
        ['setTargetPlayer', { sessionId: flagged.sessionId }],
        ['attack', {}],
      ]);
      for (let i = 0; i < 5; i++) {
        tick(room);
        if (room.state.players.get(flagged.sessionId)!.hp < hpBefore) break;
      }
      expect(room.state.players.get(flagged.sessionId)!.hp).toBeLessThan(hpBefore);
      await leaveRoom(room, attacker);
      await leaveRoom(room, flagged);
    } finally {
      cleanup();
    }
  });

  it('PROG27-39: PvP kill records killer through combat', async () => {
    const clock = { now: 1000 };
    const { dbPath, cleanup } = seededDb();
    try {
      const room = await createRoom(dbPath, { nowMs: () => clock.now });
      const killer = await colyseus.connectTo(room);
      const victim = await colyseus.connectTo(room);
      placePlayerNear(room, killer.sessionId, OUT_OF_PEACE.x, OUT_OF_PEACE.z);
      placePlayerNear(room, victim.sessionId, OUT_OF_PEACE.x, OUT_OF_PEACE.z);
      await deliver(room, victim, [['togglePvp', {}]]);
      const victimPlayer = room.state.players.get(victim.sessionId)!;
      victimPlayer.hp = 30;
      victimPlayer.level = 1;

      const killerCombat = (room as {
        playerCombat: Map<string, { nextAttackAtMs: number }>;
      }).playerCombat.get(killer.sessionId)!;
      killerCombat.nextAttackAtMs = 0;
      await deliver(room, killer, [
        ['setTargetPlayer', { sessionId: victim.sessionId }],
        ['attack', {}],
      ]);

      for (let i = 0; i < 20; i++) {
        tick(room);
        if (room.state.players.get(victim.sessionId)!.x === SPAWN_X) break;
        killerCombat.nextAttackAtMs = 0;
        killerCombat.attackPending = true;
      }

      expect(victimPlayer.x).toBe(SPAWN_X);
      expect(victimPlayer.z).toBe(SPAWN_Z);
      expect(victimPlayer.hp).toBe(victimPlayer.maxHp);
      const killerStored = (room as { characters: Map<string, { pvpKills: number }> }).characters.get(
        killer.sessionId
      )!;
      expect(killerStored.pvpKills).toBe(1);
      await leaveRoom(room, killer);
      await leaveRoom(room, victim);
    } finally {
      cleanup();
    }
  });

  it('PROG27-42: useSkill damages flagged PvP player', async () => {
    const clock = { now: 1000 };
    const { dbPath, cleanup } = seededDb();
    try {
      const room = await createRoom(dbPath, { nowMs: () => clock.now });
      const attacker = await colyseus.connectTo(room);
      const flagged = await colyseus.connectTo(room);
      await learnPowerStrike(room, attacker, attacker.sessionId);
      placePlayerNear(room, attacker.sessionId, OUT_OF_PEACE.x, OUT_OF_PEACE.z);
      placePlayerNear(room, flagged.sessionId, OUT_OF_PEACE.x, OUT_OF_PEACE.z);
      await deliver(room, flagged, [['togglePvp', {}]]);
      const flaggedPlayer = room.state.players.get(flagged.sessionId)!;
      flaggedPlayer.hp = 50_000;
      const hpBefore = flaggedPlayer.hp;
      await deliver(room, attacker, [
        ['setTargetPlayer', { sessionId: flagged.sessionId }],
        ['useSkill', { skillId: POWER_STRIKE_SKILL_ID }],
      ]);
      tick(room);
      expect(flaggedPlayer.hp).toBeLessThan(hpBefore);
      await leaveRoom(room, attacker);
      await leaveRoom(room, flagged);
    } finally {
      cleanup();
    }
  });

  it('PROG27-44: self-target for PvP rejects', async () => {
    const { dbPath, cleanup } = seededDb();
    try {
      const room = await createRoom(dbPath);
      const client = await colyseus.connectTo(room);
      placePlayerNear(room, client.sessionId, OUT_OF_PEACE.x, OUT_OF_PEACE.z);
      await deliver(room, client, [['togglePvp', {}]]);
      const combat = (room as {
        playerCombat: Map<string, { targetPlayerSessionId: string | null }>;
      }).playerCombat.get(client.sessionId)!;
      await deliver(room, client, [['setTargetPlayer', { sessionId: client.sessionId }]]);
      expect(combat.targetPlayerSessionId).toBeNull();
      await leaveRoom(room, client);
    } finally {
      cleanup();
    }
  });

  it('PROG27-46: level 1 Gremlin kill still grants +44 XP', async () => {
    const { dbPath, cleanup } = seededDb();
    try {
      const room = await createRoom(dbPath);
      const client = await colyseus.connectTo(room);
      setPlayerProgress(room, client.sessionId, { level: 1, xp: 0 });
      const gremlin = findMobByNpcId(room, GREMLIN_NPC_ID)!;
      killMob(room, client.sessionId, gremlin.id);
      expect(room.state.players.get(client.sessionId)!.xp).toBe(44);
      await leaveRoom(room, client);
    } finally {
      cleanup();
    }
  });
});
