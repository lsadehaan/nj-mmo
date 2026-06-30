import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it, expect, afterEach } from 'vitest';
import { getDb } from './client';
import {
  loadEquipment,
  saveEquipmentSlot,
  migrateLegacyWeapon,
  clearEquipmentSlot,
} from './equipment-repository';

describe('equipment-repository', () => {
  let cleanup: () => void;

  afterEach(() => {
    cleanup?.();
  });

  function tempDb() {
    const dir = mkdtempSync(join(tmpdir(), 'nj-equip-repo-'));
    const dbPath = join(dir, 'test.db');
    cleanup = () => rmSync(dir, { recursive: true, force: true });
    return getDb(dbPath);
  }

  it('loads and saves equipment by slot (ITEM25-17)', () => {
    const db = tempDb();
    saveEquipmentSlot(db, 'char-1', 'chest', 23, 0);
    const rows = loadEquipment(db, 'char-1');
    expect(rows).toEqual([{ slot: 'chest', itemId: 23, enchantLevel: 0 }]);
  });

  it('migrates legacy equippedWeaponItemId 2369 to rhand (ITEM25-25)', () => {
    const db = tempDb();
    migrateLegacyWeapon(db, 'char-1', 2369);
    const rows = loadEquipment(db, 'char-1');
    expect(rows).toEqual([{ slot: 'rhand', itemId: 2369, enchantLevel: 0 }]);
  });

  it('clears slot on unequip', () => {
    const db = tempDb();
    saveEquipmentSlot(db, 'char-1', 'chest', 23, 0);
    clearEquipmentSlot(db, 'char-1', 'chest');
    expect(loadEquipment(db, 'char-1')).toEqual([]);
  });
});
