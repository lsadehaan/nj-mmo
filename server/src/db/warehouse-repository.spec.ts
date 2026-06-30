import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { getDb } from './client';
import {
  countDistinctWarehouseItems,
  loadWarehouseItems,
  saveWarehouseItems,
} from './warehouse-repository';

describe('warehouse repository', () => {
  let cleanup: () => void;
  afterEach(() => {
    cleanup?.();
  });

  function tempDb() {
    const dir = mkdtempSync(join(tmpdir(), 'nj-wh-'));
    const dbPath = join(dir, 'test.db');
    cleanup = () => rmSync(dir, { recursive: true, force: true });
    return getDb(dbPath);
  }

  it('round-trips warehouse items (TOWN24-21)', () => {
    const db = tempDb();
    const characterId = 'char-1';
    saveWarehouseItems(db, characterId, { 1060: 3 });
    expect(loadWarehouseItems(db, characterId)).toEqual({ 1060: 3 });
  });

  it('counts distinct warehouse stacks', () => {
    expect(countDistinctWarehouseItems({ 1060: 3, 57: 1 })).toBe(2);
    expect(countDistinctWarehouseItems({ 1060: 0 })).toBe(0);
  });
});
