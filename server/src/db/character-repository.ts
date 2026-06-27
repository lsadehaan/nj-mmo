import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { SPAWN_X, SPAWN_Y, SPAWN_Z } from '@nj/game-core';
import type { AppDatabase } from './client';
import { characters, type Character } from './schema';

const STARTER_NAME = 'Adventurer';

export function createCharacter(db: AppDatabase): Character {
  const row: Character = {
    id: randomUUID(),
    name: STARTER_NAME,
    level: 1,
    xp: 0,
    hp: 100,
    mp: 50,
    adena: 1000,
    starterKitGranted: false,
    x: SPAWN_X,
    y: SPAWN_Y,
    z: SPAWN_Z,
    updatedAt: Date.now(),
  };
  db.insert(characters).values(row).run();
  return row;
}

export function loadCharacter(db: AppDatabase, id: string): Character | undefined {
  return db.select().from(characters).where(eq(characters.id, id)).get();
}

export function saveCharacter(db: AppDatabase, row: Character): void {
  const updatedAt = Date.now();
  db.insert(characters)
    .values({ ...row, updatedAt })
    .onConflictDoUpdate({
      target: characters.id,
      set: {
        name: row.name,
        level: row.level,
        xp: row.xp,
        hp: row.hp,
        mp: row.mp,
        adena: row.adena,
        starterKitGranted: row.starterKitGranted,
        x: row.x,
        y: row.y,
        z: row.z,
        updatedAt,
      },
    })
    .run();
}
