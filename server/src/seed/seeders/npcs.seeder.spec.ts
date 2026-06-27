import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it, expect, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { getDb } from '../../db/client';
import { npcs } from '../../db/schema';
import { runSeed, FIXTURE_DATA_DIR } from '../seed';

describe('NPC seeding', () => {
  let cleanup: () => void;

  afterEach(() => {
    cleanup?.();
  });

  function tempDbPath(): string {
    const dir = mkdtempSync(join(tmpdir(), 'nj-seed-'));
    const dbPath = join(dir, 'test.db');
    cleanup = () => rmSync(dir, { recursive: true, force: true });
    return dbPath;
  }

  it('seeds Katerina (30004, Grocer, Merchant)', () => {
    const dbPath = tempDbPath();
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const row = getDb(dbPath).select().from(npcs).where(eq(npcs.npcId, 30004)).get();
    expect(row).toEqual({
      npcId: 30004,
      name: 'Katerina',
      title: 'Grocer',
      type: 'Merchant',
      level: 70,
    });
  });

  it('seeds Roxxy (30006, Gatekeeper, Teleporter)', () => {
    const dbPath = tempDbPath();
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const row = getDb(dbPath).select().from(npcs).where(eq(npcs.npcId, 30006)).get();
    expect(row).toEqual({
      npcId: 30006,
      name: 'Roxxy',
      title: 'Gatekeeper',
      type: 'Teleporter',
      level: 70,
    });
  });
});
