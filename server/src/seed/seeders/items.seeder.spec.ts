import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it, expect, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { getDb } from '../../db/client';
import { items } from '../../db/schema';
import { runSeed, FIXTURE_DATA_DIR } from '../seed';
import { parseItemsXml } from '../parsers/items.parser';
import { readFileSync } from 'node:fs';

describe('items seeding', () => {
  let cleanup: () => void;

  afterEach(() => {
    cleanup?.();
  });

  function tempDbPath(): string {
    const dir = mkdtempSync(join(tmpdir(), 'nj-items-seed-'));
    const dbPath = join(dir, 'test.db');
    cleanup = () => rmSync(dir, { recursive: true, force: true });
    return dbPath;
  }

  it('parses Squire\'s Sword with pAtk=6 and bodyPart=rhand', () => {
    const xml = readFileSync(join(FIXTURE_DATA_DIR, 'items_subset.xml'), 'utf-8');
    const rows = parseItemsXml(xml);
    const sword = rows.find((r) => r.itemId === 2369);
    expect(sword).toEqual({
      itemId: 2369,
      name: "Squire's Sword",
      type: 'weapon',
      pAtk: 6,
      randomDamage: 10,
      bodyPart: 'rhand',
    });
  });

  it('seeds all five MVP items with correct types (SKILL20-07)', () => {
    const dbPath = tempDbPath();
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const db = getDb(dbPath);
    const rows = db.select().from(items).all();
    expect(rows).toHaveLength(5);
    expect(rows.find((r) => r.itemId === 1060)?.type).toBe('consumable');
    expect(rows.find((r) => r.itemId === 17)?.type).toBe('etc');
    expect(rows.find((r) => r.itemId === 1835)?.type).toBe('shot');
    expect(rows.find((r) => r.itemId === 2509)?.type).toBe('shot');
    expect(rows.find((r) => r.itemId === 2369)?.type).toBe('weapon');
  });

  it('runSeed is idempotent for items row count', () => {
    const dbPath = tempDbPath();
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const db = getDb(dbPath);
    const sword = db.select().from(items).where(eq(items.itemId, 2369)).get();
    expect(sword?.pAtk).toBe(6);
    expect(db.select().from(items).all()).toHaveLength(5);
  });
});
