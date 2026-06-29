import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it, expect, afterEach } from 'vitest';
import { getDb } from '../../db/client';
import { mobSpawns } from '../../db/schema';
import { runSeed, FIXTURE_DATA_DIR } from '../seed';
import { TI_MOB_IDS } from '../paths';

describe('mob spawn seeding', () => {
  let cleanup: () => void;
  afterEach(() => { cleanup?.(); });
  function tempDbPath(): string {
    const dir = mkdtempSync(join(tmpdir(), 'nj-spawns-'));
    const dbPath = join(dir, 'test.db');
    cleanup = () => rmSync(dir, { recursive: true, force: true });
    return dbPath;
  }
  it('seeds at least 55 spawn rows in local metric coords (BEST22-19)', () => {
    const dbPath = tempDbPath();
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const rows = getDb(dbPath).select().from(mobSpawns).all();
    expect(rows.length).toBeGreaterThanOrEqual(55);
    for (const row of rows) {
      expect(row.x).toBeTypeOf('number');
      expect(row.z).toBeTypeOf('number');
      expect(row.y).toBeCloseTo(4.26, 2);
    }
  });
  it('includes all 23 TI monster npcIds (BEST22-18)', () => {
    const dbPath = tempDbPath();
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const npcIds = new Set(getDb(dbPath).select().from(mobSpawns).all().map((r) => r.npcId));
    for (const id of TI_MOB_IDS) expect(npcIds.has(id)).toBe(true);
  });
  it('defaults respawnSec to 27 for every spawn', () => {
    const dbPath = tempDbPath();
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    expect(getDb(dbPath).select().from(mobSpawns).all().every((r) => r.respawnSec === 27)).toBe(true);
  });
  it('is idempotent when run twice', () => {
    const dbPath = tempDbPath();
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const strip = (rows: { npcId: number; x: number; y: number; z: number; respawnSec: number }[]) =>
      rows.map(({ npcId, x, y, z, respawnSec }) => ({ npcId, x, y, z, respawnSec }));
    const first = strip(getDb(dbPath).select().from(mobSpawns).all());

    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    expect(strip(getDb(dbPath).select().from(mobSpawns).all())).toEqual(first);
  });
});
