import { and, eq } from 'drizzle-orm';
import { canAddFriend } from '@nj/game-core';
import type { AppDatabase } from './client';
import { characterFriends, characters } from './schema';

export interface FriendEntry {
  characterId: string;
  name: string;
}

export function loadFriends(db: AppDatabase, characterId: string): FriendEntry[] {
  const rows = db
    .select()
    .from(characterFriends)
    .where(eq(characterFriends.characterId, characterId))
    .all();

  const entries: FriendEntry[] = [];
  for (const row of rows) {
    const friend = db
      .select({ name: characters.name })
      .from(characters)
      .where(eq(characters.id, row.friendCharacterId))
      .get();
    entries.push({
      characterId: row.friendCharacterId,
      name: friend?.name ?? 'Unknown',
    });
  }
  return entries;
}

export function countFriends(db: AppDatabase, characterId: string): number {
  return db
    .select()
    .from(characterFriends)
    .where(eq(characterFriends.characterId, characterId))
    .all().length;
}

export function isFriend(
  db: AppDatabase,
  characterId: string,
  friendCharacterId: string
): boolean {
  const row = db
    .select()
    .from(characterFriends)
    .where(
      and(
        eq(characterFriends.characterId, characterId),
        eq(characterFriends.friendCharacterId, friendCharacterId)
      )
    )
    .get();
  return row !== undefined;
}

export type FriendMutationResult =
  | { ok: true }
  | { ok: false; error: string };

export function addFriend(
  db: AppDatabase,
  characterId: string,
  friendCharacterId: string,
  nowMs: number
): FriendMutationResult {
  const check = canAddFriend(
    countFriends(db, characterId),
    friendCharacterId,
    characterId,
    isFriend(db, characterId, friendCharacterId)
  );
  if (!check.ok) return check;

  const friendExists = db
    .select({ id: characters.id })
    .from(characters)
    .where(eq(characters.id, friendCharacterId))
    .get();
  if (!friendExists) return { ok: false, error: 'not_found' };

  db.insert(characterFriends)
    .values({
      characterId,
      friendCharacterId,
      createdAtMs: nowMs,
    })
    .run();

  if (!isFriend(db, friendCharacterId, characterId)) {
    const reverseCheck = canAddFriend(
      countFriends(db, friendCharacterId),
      characterId,
      friendCharacterId,
      false
    );
    if (reverseCheck.ok) {
      db.insert(characterFriends)
        .values({
          characterId: friendCharacterId,
          friendCharacterId: characterId,
          createdAtMs: nowMs,
        })
        .run();
    }
  }

  return { ok: true };
}

export function removeFriend(
  db: AppDatabase,
  characterId: string,
  friendCharacterId: string
): void {
  db.delete(characterFriends)
    .where(
      and(
        eq(characterFriends.characterId, characterId),
        eq(characterFriends.friendCharacterId, friendCharacterId)
      )
    )
    .run();
  db.delete(characterFriends)
    .where(
      and(
        eq(characterFriends.characterId, friendCharacterId),
        eq(characterFriends.friendCharacterId, characterId)
      )
    )
    .run();
}
