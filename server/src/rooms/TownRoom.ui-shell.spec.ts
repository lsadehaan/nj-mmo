import type { ColyseusTestServer } from '@colyseus/testing';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getDb } from '../db/client';
import {
  createCharacter,
  saveCharacterItems,
} from '../db/character-repository';
import { runSeed, FIXTURE_DATA_DIR } from '../seed/seed';
import { TownState } from './schema/TownState';
import { acquireTownRoomTestServer, releaseTownRoomTestServer } from './town-room-harness';

const SQUIRES_SWORD = 2369;

let colyseus: ColyseusTestServer;

beforeAll(async () => {
  colyseus = await acquireTownRoomTestServer();
}, 60_000);

afterAll(async () => {
  await releaseTownRoomTestServer();
});

function tempDbPath(): { dbPath: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), 'nj-ui-shell-'));
  const dbPath = join(dir, 'test.db');
  return { dbPath, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

function seededDb() {
  const { dbPath, cleanup } = tempDbPath();
  runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
  return { dbPath, cleanup };
}

async function leaveRoom(
  room: Awaited<ReturnType<ColyseusTestServer['createRoom']>>,
  client: Awaited<ReturnType<ColyseusTestServer['connectTo']>>
) {
  await client.leave(true);
  await room.disconnect();
  await new Promise<void>((resolve) => setImmediate(resolve));
}

describe('TownRoom ui-shell', () => {
  it('UI28-15: rejects join when characterId does not belong to accountName', async () => {
    const { dbPath, cleanup } = seededDb();
    try {
      const db = getDb(dbPath);
      const char = createCharacter(db, {
        accountName: 'hero1',
        name: 'Alpha',
        classId: 0,
        sex: 0,
      });
      const room = await colyseus.createRoom('town', {
        instanceKey: randomUUID(),
        dbPath,
      });
      await expect(
        colyseus.sdk.joinById(
          room.roomId,
          { characterId: char.id, accountName: 'other' },
          TownState
        )
      ).rejects.toThrow();
      expect(room.state.players.size).toBe(0);
      await room.disconnect();
    } finally {
      cleanup();
    }
  });

  it('UI28-23: replicates inventoryWeight 1600 with Squire\'s Sword in inventory', async () => {
    const { dbPath, cleanup } = seededDb();
    try {
      const db = getDb(dbPath);
      const char = createCharacter(db, {
        accountName: 'hero1',
        name: 'Carrier',
        classId: 0,
        sex: 0,
      });
      saveCharacterItems(db, char.id, { [SQUIRES_SWORD]: 1 });

      const room = await colyseus.createRoom('town', {
        instanceKey: randomUUID(),
        dbPath,
      });
      const client = await colyseus.sdk.joinById(
        room.roomId,
        { characterId: char.id, accountName: 'hero1' },
        TownState
      );
      const player = room.state.players.get(client.sessionId)!;
      expect(player.inventoryWeight).toBe(1600);
      expect(player.maxLoad).toBe(2967);
      expect(player.inventorySlotsUsed).toBe(1);
      await leaveRoom(room, client);
    } finally {
      cleanup();
    }
  });
});
