import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { getDb } from './client';
import { createCharacter } from './character-repository';
import {
  addFriend,
  loadFriends,
  removeFriend,
  countFriends,
  isFriend,
} from './friends-repository';
import { FRIENDS_MAX } from '@nj/game-core';

describe('friends repository (SOC26-31, SOC26-32, SOC26-33, SOC26-34)', () => {
  let cleanup: () => void;
  afterEach(() => {
    cleanup?.();
  });

  function tempDb() {
    const dir = mkdtempSync(join(tmpdir(), 'nj-friends-'));
    const dbPath = join(dir, 'test.db');
    cleanup = () => rmSync(dir, { recursive: true, force: true });
    return getDb(dbPath);
  }

  it('SOC26-31: add friend persists and loads', () => {
    const db = tempDb();
    const a = createCharacter(db);
    const b = createCharacter(db);
    const result = addFriend(db, a.id, b.id, Date.now());
    expect(result.ok).toBe(true);
    expect(loadFriends(db, a.id).some((f) => f.characterId === b.id)).toBe(true);
    expect(isFriend(db, a.id, b.id)).toBe(true);
  });

  it('SOC26-32: remove friend deletes row', () => {
    const db = tempDb();
    const a = createCharacter(db);
    const b = createCharacter(db);
    addFriend(db, a.id, b.id, Date.now());
    removeFriend(db, a.id, b.id);
    expect(isFriend(db, a.id, b.id)).toBe(false);
    expect(loadFriends(db, a.id)).toHaveLength(0);
  });

  it('SOC26-34: duplicate add rejects', () => {
    const db = tempDb();
    const a = createCharacter(db);
    const b = createCharacter(db);
    addFriend(db, a.id, b.id, Date.now());
    const dup = addFriend(db, a.id, b.id, Date.now());
    expect(dup.ok).toBe(false);
  });

  it('SOC26-33: cap enforced at 50', () => {
    const db = tempDb();
    const self = createCharacter(db);
    for (let i = 0; i < FRIENDS_MAX; i++) {
      const other = createCharacter(db);
      addFriend(db, self.id, other.id, Date.now());
    }
    const overflow = createCharacter(db);
    const result = addFriend(db, self.id, overflow.id, Date.now());
    expect(result.ok).toBe(false);
    expect(countFriends(db, self.id)).toBe(FRIENDS_MAX);
  });
});
