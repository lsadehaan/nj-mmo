import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it, expect, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { getDb } from './client';
import { characters, mobDrops, mobSpawns, monsters, items, merchantItems, npcSpawns, characterItems, recipes, armorSets, characterEquipment } from './schema';

describe('characters table', () => {
  let cleanup: () => void;
  afterEach(() => { cleanup?.(); });
  function tempDbPath(): string {
    const dir = mkdtempSync(join(tmpdir(), 'nj-characters-'));
    const dbPath = join(dir, 'test.db');
    cleanup = () => rmSync(dir, { recursive: true, force: true });
    return dbPath;
  }
  it('round-trips insert and select on characters', () => {
    const db = getDb(tempDbPath());
    const now = Date.now();
    const row = { id: 'test-uuid-1', name: 'Adventurer', level: 1, xp: 0, hp: 100, mp: 50, maxHp: 100, maxMp: 50, equippedWeaponItemId: null, adena: 1000, starterKitGranted: false, x: 0, y: 4.26, z: 0, updatedAt: now };
    db.insert(characters).values(row).run();
    const loaded = db.select().from(characters).where(eq(characters.id, row.id)).get();
    expect(loaded).toMatchObject(row);
  });
});

describe('combat schema tables', () => {
  let cleanup: () => void;
  afterEach(() => { cleanup?.(); });
  function tempDb() {
    const dir = mkdtempSync(join(tmpdir(), 'nj-schema-'));
    const dbPath = join(dir, 'test.db');
    cleanup = () => rmSync(dir, { recursive: true, force: true });
    return getDb(dbPath);
  }
  it('round-trips mob_drops insert and select', () => {
    const db = tempDb();
    db.insert(mobDrops).values({ npcId: 20003, itemId: 57, minCount: 13, maxCount: 30, chance: 70 }).run();
    const row = db.select().from(mobDrops).where(eq(mobDrops.npcId, 20003)).get();
    expect(row).toMatchObject({ npcId: 20003, itemId: 57, minCount: 13, maxCount: 30, chance: 70 });
  });
  it('round-trips mob_spawns insert and select', () => {
    const db = tempDb();
    db.insert(mobSpawns).values({ npcId: 20001, x: 12, y: 4.26, z: -18, respawnSec: 27 }).run();
    const row = db.select().from(mobSpawns).where(eq(mobSpawns.npcId, 20001)).get();
    expect(row).toMatchObject({ npcId: 20001, x: 12, y: 4.26, z: -18, respawnSec: 27 });
  });
  it('stores monster combat columns including aggro and respawn', () => {
    const db = tempDb();
    db.insert(monsters).values({
      npcId: 20001, name: 'Gremlin', level: 1, type: 'Monster', race: 'FAIRY', exp: 44, sp: 0,
      hp: 41.145, mp: 44.247, pAtk: 8.47458, pDef: 44.44444, attackSpeed: 253, random: 30,
      critical: 4.75, accuracy: 4.75, attackRange: 40, aggroRange: 0, isAggressive: false, respawnSec: 27,
    }).run();
    const row = db.select().from(monsters).where(eq(monsters.npcId, 20001)).get();
    expect(row?.pDef).toBeCloseTo(44.44444, 5);
    expect(row?.aggroRange).toBe(0);
    expect(row?.isAggressive).toBe(false);
    expect(row?.respawnSec).toBe(27);
  });
});

describe('items master table', () => {
  let cleanup: () => void;
  afterEach(() => { cleanup?.(); });
  function tempDb() {
    const dir = mkdtempSync(join(tmpdir(), 'nj-items-schema-'));
    const dbPath = join(dir, 'test.db');
    cleanup = () => rmSync(dir, { recursive: true, force: true });
    return getDb(dbPath);
  }

  it('round-trips weapon row with combat stats', () => {
    const db = tempDb();
    db.insert(items)
      .values({
        itemId: 2369,
        name: "Squire's Sword",
        type: 'weapon',
        pAtk: 6,
        randomDamage: 10,
        bodyPart: 'rhand',
      })
      .run();
    const row = db.select().from(items).where(eq(items.itemId, 2369)).get();
    expect(row).toMatchObject({
      itemId: 2369,
      name: "Squire's Sword",
      type: 'weapon',
      pAtk: 6,
      randomDamage: 10,
      bodyPart: 'rhand',
    });
  });

  it('round-trips consumable row with null combat columns', () => {
    const db = tempDb();
    db.insert(items)
      .values({ itemId: 1060, name: 'Healing Potion', type: 'consumable' })
      .run();
    const row = db.select().from(items).where(eq(items.itemId, 1060)).get();
    expect(row).toMatchObject({
      itemId: 1060,
      name: 'Healing Potion',
      type: 'consumable',
      pAtk: null,
      randomDamage: null,
      bodyPart: null,
    });
  });

  it('stores extended item columns (ITEM25-01)', () => {
    const db = tempDb();
    db.insert(items)
      .values({
        itemId: 58,
        name: 'Mithril Breastplate',
        type: 'armor',
        crystalType: 'D',
        pDef: 95,
        mDef: 26,
        bodyPart: 'chest',
        enchantEnabled: true,
        isStackable: false,
        weaponType: null,
        recipeId: null,
      })
      .run();
    const row = db.select().from(items).where(eq(items.itemId, 58)).get();
    expect(row).toMatchObject({
      crystalType: 'D',
      pDef: 95,
      mDef: 26,
      enchantEnabled: true,
      recipeId: null,
      weaponType: null,
      isStackable: false,
    });
  });

  it('creates recipes table with recipe_id PK (ITEM25-07)', () => {
    const db = tempDb();
    db.insert(recipes)
      .values({
        recipeId: 2,
        name: 'mk_broadsword',
        craftLevel: 1,
        successRate: 100,
        mpCost: 30,
        productItemId: 3,
        productCount: 1,
        ingredientsJson: JSON.stringify([
          { itemId: 2005, count: 1 },
          { itemId: 1869, count: 18 },
          { itemId: 1870, count: 18 },
        ]),
      })
      .run();
    const row = db.select().from(recipes).where(eq(recipes.recipeId, 2)).get();
    expect(row?.productItemId).toBe(3);
  });

  it('creates character_equipment with composite PK (ITEM25-17)', () => {
    const db = tempDb();
    db.insert(characterEquipment)
      .values({ characterId: 'c1', slot: 'rhand', itemId: 3, enchantLevel: 0 })
      .run();
    const row = db
      .select()
      .from(characterEquipment)
      .where(eq(characterEquipment.characterId, 'c1'))
      .get();
    expect(row).toMatchObject({ slot: 'rhand', itemId: 3, enchantLevel: 0 });
  });

  it('creates armor_sets table (ITEM25-09)', () => {
    const db = tempDb();
    db.insert(armorSets)
      .values({
        setId: 0,
        requiredItemIdsJson: JSON.stringify([23, 2386, 43]),
        pDefPercentBonus: 0.02,
        maxHpBonus: 41,
      })
      .run();
    const row = db.select().from(armorSets).where(eq(armorSets.setId, 0)).get();
    expect(row?.maxHpBonus).toBe(41);
  });
});

describe('phase 6 economy schema tables', () => {
  let cleanup: () => void;
  afterEach(() => { cleanup?.(); });
  function tempDb() {
    const dir = mkdtempSync(join(tmpdir(), 'nj-phase6-schema-'));
    const dbPath = join(dir, 'test.db');
    cleanup = () => rmSync(dir, { recursive: true, force: true });
    return getDb(dbPath);
  }

  it('round-trips merchant_items insert and select', () => {
    const db = tempDb();
    db.insert(merchantItems)
      .values({ npcId: 30004, itemId: 1060, name: 'Healing Potion', buyPrice: 103, sellPrice: 51 })
      .run();
    const row = db.select().from(merchantItems).where(eq(merchantItems.itemId, 1060)).get();
    expect(row).toMatchObject({
      npcId: 30004,
      itemId: 1060,
      name: 'Healing Potion',
      buyPrice: 103,
      sellPrice: 51,
    });
  });

  it('round-trips npc_spawns insert and select', () => {
    const db = tempDb();
    db.insert(npcSpawns).values({ npcId: 30004, x: -6, y: 4.26, z: -8 }).run();
    const row = db.select().from(npcSpawns).where(eq(npcSpawns.npcId, 30004)).get();
    expect(row).toMatchObject({ npcId: 30004, x: -6, y: 4.26, z: -8 });
  });

  it('round-trips character_items composite key and defaults adena to 1000', () => {
    const db = tempDb();
    const now = Date.now();
    db.insert(characters)
      .values({
        id: 'char-1',
        name: 'Adventurer',
        level: 1,
        xp: 0,
        hp: 100,
        mp: 50,
        maxHp: 100,
        maxMp: 50,
        equippedWeaponItemId: null,
        x: 0,
        y: 4.26,
        z: 0,
        updatedAt: now,
      })
      .run();
    const character = db.select().from(characters).where(eq(characters.id, 'char-1')).get();
    expect(character?.adena).toBe(1000);
    expect(character?.starterKitGranted).toBe(false);

    db.insert(characterItems)
      .values({ characterId: 'char-1', itemId: 1060, count: 2 })
      .run();
    const item = db
      .select()
      .from(characterItems)
      .where(eq(characterItems.characterId, 'char-1'))
      .get();
    expect(item).toMatchObject({ characterId: 'char-1', itemId: 1060, count: 2 });
  });
});
