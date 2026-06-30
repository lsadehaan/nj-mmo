import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { snapEntityY } from '@nj/game-core';
import { getDb } from '../db/client';
import { runSeed, FIXTURE_DATA_DIR } from '../seed/seed';
import { TownState } from './schema/TownState';
import { initializeMobs } from './spawn-manager';

describe('spawn-manager', () => {
  let cleanup: () => void;

  afterEach(() => {
    cleanup?.();
  });

  function seededDb(): { db: ReturnType<typeof getDb>; dbPath: string } {
    const dir = mkdtempSync(join(tmpdir(), 'nj-spawn-mgr-'));
    const dbPath = join(dir, 'test.db');
    cleanup = () => rmSync(dir, { recursive: true, force: true });
    runSeed({ dataDir: FIXTURE_DATA_DIR, dbPath });
    return { db: getDb(dbPath), dbPath };
  }

  it('creates one MobState per mob_spawns row', () => {
    const { db } = seededDb();
    const state = new TownState();
    const runtime = initializeMobs(db, state);

    const fixtureRows = JSON.parse(
      readFileSync(join(FIXTURE_DATA_DIR, 'mob_spawns.json'), 'utf-8')
    ) as unknown[];
    expect(state.mobs.size).toBe(fixtureRows.length);
    expect(runtime.size).toBe(fixtureRows.length);
  });

  it('sets npcId, position, and maxHp from monster template', () => {
    const { db } = seededDb();
    const state = new TownState();
    initializeMobs(db, state);

    const fixtureGremlins = (
      JSON.parse(
        readFileSync(join(FIXTURE_DATA_DIR, 'mob_spawns.json'), 'utf-8')
      ) as { npcId: number }[]
    ).filter((r) => r.npcId === 20001).length;
    const gremlins = [...state.mobs.values()].filter((m) => m.npcId === 20001);
    expect(gremlins).toHaveLength(fixtureGremlins);
    expect(gremlins.length).toBeGreaterThan(0);
    const gremlin = gremlins[0]!;
    expect(gremlin!.hp).toBeCloseTo(41.145, 3);
    expect(gremlin!.maxHp).toBeCloseTo(41.145, 3);
    expect(gremlin!.y).toBeCloseTo(snapEntityY(gremlin!.x, gremlin!.z), 2);
    expect(Math.hypot(gremlin!.x, gremlin!.z)).toBeGreaterThan(0);
  });

  it('exposes combat stats on runtime map keyed by mob id', () => {
    const { db } = seededDb();
    const state = new TownState();
    const runtime = initializeMobs(db, state);

    const goblinState = [...state.mobs.values()].find((m) => m.npcId === 20003)!;
    const goblinRuntime = runtime.get(goblinState.id)!;

    expect(goblinRuntime.isAggressive).toBe(true);
    expect(goblinRuntime.aggroRangeWorld).toBe(45);
    expect(goblinRuntime.pDef).toBeGreaterThan(0);
    expect(goblinRuntime.exp).toBe(220);
    expect(goblinRuntime.respawnSec).toBe(27);
  });
});
