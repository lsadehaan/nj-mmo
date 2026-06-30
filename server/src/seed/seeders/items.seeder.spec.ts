import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it, expect, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { getDb } from '../../db/client';
import { items, recipes, armorSets } from '../../db/schema';
import { runSeed, FIXTURE_DATA_DIR } from '../seed';
import { parseItemsXml } from '../parsers/items.parser';
import { parseRecipesXml } from '../parsers/recipes.parser';
import { TI_ITEM_IDS } from '../paths';

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

  it('parses Broadsword with pAtk=11 and NG crystal (ITEM25-04)', () => {
    const xml = readFileSync(join(FIXTURE_DATA_DIR, 'items_ti.xml'), 'utf-8');
    const rows = parseItemsXml(xml);
    const sword = rows.find((r) => r.itemId === 3);
    expect(sword).toMatchObject({
      itemId: 3,
      name: 'Broadsword',
      type: 'weapon',
      pAtk: 11,
      crystalType: null,
      bodyPart: 'rhand',
      enchantEnabled: false,
    });
  });

  it('parses Mithril Breastplate as D-grade enchantable (ITEM25-05)', () => {
    const xml = readFileSync(join(FIXTURE_DATA_DIR, 'items_ti.xml'), 'utf-8');
    const rows = parseItemsXml(xml);
    const chest = rows.find((r) => r.itemId === 58);
    expect(chest).toMatchObject({
      crystalType: 'D',
      pDef: 95,
      bodyPart: 'chest',
      enchantEnabled: true,
    });
  });

  it('parses Recipe: Broadsword with recipeId=2 (ITEM25-06)', () => {
    const xml = readFileSync(join(FIXTURE_DATA_DIR, 'items_ti.xml'), 'utf-8');
    const rows = parseItemsXml(xml);
    const recipe = rows.find((r) => r.itemId === 1786);
    expect(recipe).toMatchObject({ type: 'recipe', recipeId: 2 });
  });

  it('seeds one row per TI_ITEM_IDS (ITEM25-03)', () => {
    const dbPath = tempDbPath();
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const db = getDb(dbPath);
    const rows = db.select().from(items).all();
    const seededIds = new Set(rows.map((r) => r.itemId));
    for (const id of TI_ITEM_IDS) {
      expect(seededIds.has(id)).toBe(true);
    }
    expect(rows.length).toBeGreaterThanOrEqual(TI_ITEM_IDS.length);
  });

  it('seeds recipe 2 with Broadsword product and ingredients (ITEM25-08)', () => {
    const xml = readFileSync(join(FIXTURE_DATA_DIR, 'recipes_ti.xml'), 'utf-8');
    const parsed = parseRecipesXml(xml);
    const recipe2 = parsed.find((r) => r.recipeId === 2);
    expect(recipe2?.productItemId).toBe(3);
    expect(JSON.parse(recipe2!.ingredientsJson)).toEqual([
      { itemId: 2005, count: 1 },
      { itemId: 1869, count: 18 },
      { itemId: 1870, count: 18 },
    ]);

    const dbPath = tempDbPath();
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const db = getDb(dbPath);
    const row = db.select().from(recipes).where(eq(recipes.recipeId, 2)).get();
    expect(row?.mpCost).toBe(30);
    expect(row?.productItemId).toBe(3);
  });

  it('seeds Wooden and Mithril armor sets (ITEM25-09)', () => {
    const dbPath = tempDbPath();
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const db = getDb(dbPath);
    const sets = db.select().from(armorSets).all();
    expect(sets.map((s) => s.setId).sort()).toEqual([0, 1]);
    const wooden = sets.find((s) => s.setId === 0);
    expect(wooden?.maxHpBonus).toBe(41);
    expect(JSON.parse(wooden!.requiredItemIdsJson)).toEqual([23, 2386, 43]);
  });

  it('runSeed is idempotent for items row count (ITEM25-10)', () => {
    const dbPath = tempDbPath();
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const countAfterFirst = getDb(dbPath).select().from(items).all().length;
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const db = getDb(dbPath);
    expect(db.select().from(items).all().length).toBe(countAfterFirst);
    const sword = db.select().from(items).where(eq(items.itemId, 2369)).get();
    expect(sword?.pAtk).toBe(6);
  });

  it('seeds item weight anchors 2369 and 1060 (UI28-22)', () => {
    const dbPath = tempDbPath();
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    const db = getDb(dbPath);
    const sword = db.select().from(items).where(eq(items.itemId, 2369)).get();
    const potion = db.select().from(items).where(eq(items.itemId, 1060)).get();
    expect(sword?.weight).toBe(1600);
    expect(potion?.weight).toBe(5);
  });
});
