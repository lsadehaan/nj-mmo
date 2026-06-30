# Phase 23 — Full Talking Island World & Zones Tasks

## Execution Protocol (MANDATORY — do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and
follow its Execute flow and Critical Rules.** This repo wraps it with
`spec-driven-execution` (Planner → Implementer → Verifier, **autonomous-first**);
honor server-authority (AD-001) and the three test layers (AD-010) — **no Playwright**.

**Skill:** `game-designer` → `references/create-prop.md` for **T17–T18** (landmark GLBs).

**If the skill cannot be activated, STOP and tell the user — do not proceed without it.**

---

**Design**: `.specs/features/phase-23-ti-world/design.md`
**Spec**: `.specs/features/phase-23-ti-world/spec.md`
**Status**: Draft

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec — confirm before Execute.
> Guidelines found: `AGENTS.md` (three test layers post-MVP, determinism, AD-014),
> `.specs/STATE.md` AD-001/009/010/012/013/014/017/018.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| L2 coords + zones | unit | TIW23-01–16; all edge cases | `libs/game-core/src/*.spec.ts` | `nx test game-core` |
| Terrain + walkability | unit | TIW23-03–06, 22–23, 41–44 | `libs/game-core/src/*.spec.ts` | `nx test game-core` |
| Territory spawns | unit + seed | TIW23-24–35 | `server/src/seed/**/*.spec.ts` | `nx test server` |
| Zone guards | unit + room | TIW23-17–23, 48–49 | `server/src/rooms/*.spec.ts` | `nx test server` |
| Client zone hook | unit | TIW23-45–47 | `client/src/net/wireRoom.spec.ts`, `test-hook.spec.ts` | `nx test client` |
| Landmark manifest | unit | TIW23-36–38 | `client/src/scene/*.spec.ts` | `nx test client` |
| Landmark GLBs | none (visual gate) | TIW23-39–40 | `client/public/models/props/landmarks/` | `node scripts/visual-gate.mjs` |
| Schema / config | build | PlayerState zoneId | `server/src/rooms/schema/` | `nx build server` |

## Parallelism Assessment

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
| --------- | -------------- | --------------- | -------- |
| Unit (`game-core`, `client`) | Yes | Vitest per-file | Existing `*.spec.ts` |
| Unit (`server` seed) | Yes | Temp DB per test (AD-011) | `spawns.seeder.spec.ts` |
| Room integration | Yes | `NJ_AUTOSIM=0` + per-test room + temp DB (AD-014) | `TownRoom.spec.ts` |

## Gate Check Commands

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick (game-core) | After T1–T6, T9–T10 | `nx test game-core` |
| Quick (server) | After T7–T8, T11–T15, T20 | `nx test server` |
| Quick (client) | After T16, T19, T21 | `nx test client` |
| Full | After T21 | `nx affected -t test lint` |
| Build | Phase completion (T24) | `nx run-many -t build lint test` |
| Visual | After T22–T23 (before Verifier) | `node scripts/visual-gate.mjs` + `shoot-environment.mjs` |

**Speed contract:** Room tests use `NJ_AUTOSIM=0` + `deliver()`/`tick()` — no wall-clock
sleeps. Per-test cap ≤ **10 s** (AD-014).

---

## Execution Plan

**5 phases** (24 tasks).

### Phase 1: game-core foundation — Sequential

```
T1 → T2 → T3 → T4 → T5 → T6
```

### Phase 2: Seed & blockers — Sequential

```
T6 → T7 → T9 → T8 → T10
```

### Phase 3: Server authority — Sequential

```
T10 → T11 → T12 → T13 → T14 → T15
```

### Phase 4: Client world — Parallel GLBs then sequential

```
T15 ──┬→ T17 [P] landmark GLBs batch A
      └→ T18 [P] landmark GLBs batch B
T17, T18 → T16 → T19 → T20 → T21
```

### Phase 5: Visual gate & regression — Sequential

```
T21 → T22 → T23 → T24
```

---

## Task Breakdown

### T1: L2 coordinate mapper

**What**: Add `l2-coords.ts` with `L2_ANCHOR`, `L2_TO_LOCAL_SCALE`, `l2ToLocal`, `localToL2`.
**Where**: `libs/game-core/src/l2-coords.ts`
**Depends on**: None
**Reuses**: AD-013 convention
**Requirement**: TIW23-01, TIW23-02

**Tools**: MCP: NONE | Skill: NONE

**Done when**:

- [ ] Unit tests assert anchor, Obelisk, and round-trip within 0.01 m
- [ ] Exported from `@nj/game-core` index
- [ ] Gate: `nx test game-core` green

**Tests**: unit | **Gate**: quick (game-core)

**Commit**: `feat(game-core): add L2J to local coordinate mapper`

---

### T2: Expanded world bounds constants

**What**: Update `WORLD_MIN/MAX` to ±315; export `TERRAIN_SIZE = 640`.
**Where**: `libs/game-core/src/world-constants.ts`, `world-constants.spec.ts`
**Depends on**: T1
**Requirement**: TIW23-03

**Done when**:

- [ ] `validate-move-intent.spec.ts` updated for new bounds
- [ ] Gate: `nx test game-core`

**Tests**: unit | **Gate**: quick

**Commit**: `feat(game-core): expand TI world bounds to 640m`

---

### T3: TI zone registry

**What**: Add `ti-zones.ts` with six named polygons + `getZoneAt` / `isWaterZone` / `listTiZones`.
**Where**: `libs/game-core/src/ti-zones.ts`, `ti-zones.spec.ts`
**Depends on**: T1
**Requirement**: TIW23-07–14, TIW23-16

**Done when**:

- [ ] Anchor coordinate tests for all six zones pass
- [ ] Overlap tie-break tested
- [ ] `wilderness` fallback tested
- [ ] Gate: `nx test game-core`

**Tests**: unit | **Gate**: quick

**Commit**: `feat(game-core): add Talking Island named zone registry`

---

### T4: Peace zone delegation

**What**: Replace rectangle `PEACE_ZONE` with `isInPeaceZone` → `getZoneAt().type === 'peace'`.
**Where**: `libs/game-core/src/peace-zone.ts`, `peace-zone.spec.ts`
**Depends on**: T3
**Requirement**: TIW23-15

**Done when**:

- [ ] Village centre/peace samples pass; Obelisk sample returns false
- [ ] Gate: `nx test game-core`

**Tests**: unit | **Gate**: quick

**Commit**: `refactor(game-core): peace zone uses polygon registry`

---

### T5: Expanded terrain + region bias

**What**: `TERRAIN_CONFIG.size=640`, `segments=128`; region height bias by zone in `sampleHeight`.
**Where**: `libs/game-core/src/terrain.ts`, `terrain.spec.ts`
**Depends on**: T2, T3
**Requirement**: TIW23-04, TIW23-05

**Done when**:

- [ ] `SPAWN_Y` derived from terrain at origin
- [ ] Client `terrain.ts` still delegates to game-core
- [ ] Gate: `nx test game-core`

**Tests**: unit | **Gate**: quick

**Commit**: `feat(game-core): expand heightmap to 640m with zone bias`

---

### T6: Walkability water rejection

**What**: `isWalkable` returns false when destination is `water`; update walkability tests.
**Where**: `libs/game-core/src/walkability.ts`, `walkability.spec.ts`
**Depends on**: T3, T5
**Requirement**: TIW23-22, TIW23-23

**Done when**:

- [ ] Harbour water sample rejected; land sample accepted
- [ ] Gate: `nx test game-core`

**Tests**: unit | **Gate**: quick

**Commit**: `feat(game-core): reject movement into water zones`

---

### T7: Territory-based mob spawn regeneration

**What**: Add `territory-spawns.ts`; regenerate `mob_spawns.json` from L2J XML fixture +
  `territoryZoneMap`; keep Gremlin/Goblin tutorial rows.
**Where**: `server/src/seed/territory-spawns.ts`, `__fixtures__/mob_spawns.json`,
  `spawn-placement.spec.ts`
**Depends on**: T1, T3, T5, T6
**Requirement**: TIW23-24–31, TIW23-30

**Done when**:

- [ ] ≥55 spawn rows; all `TI_MOB_IDS` covered
- [ ] Zone distribution + level progression tests pass
- [ ] Gate: `nx test server`

**Tests**: unit + seed | **Gate**: quick (server)

**Commit**: `feat(server): remap mob spawns from L2J territories`

---

### T8: NPC spawn re-home from L2J coords

**What**: Regenerate `npc_spawns.json` via `l2ToLocal` from Gludio fixture coords.
**Where**: `server/src/seed/__fixtures__/npc_spawns.json`, `npc-spawns` seeder spec
**Depends on**: T1, T3, T9
**Requirement**: TIW23-32–35

**Done when**:

- [ ] All `TI_NPC_IDS` in peace village zone
- [ ] Katerina within 8 m of L2 grocery anchor
- [ ] Gate: `nx test server`

**Tests**: seed + unit | **Gate**: quick (server)

**Commit**: `feat(server): re-home TI NPC spawns from L2J coordinates`

---

### T9: Blockers, buildings, expanded scatter

**What**: Update `BUILDING_LAYOUT`, `LANDMARK_*` blockers, scatter defaults (`count=220`,
  `fieldMin/Max=±300`, `villageRadius=45`).
**Where**: `libs/game-core/src/world-blockers.ts`, `world-scatter.ts`, specs
**Depends on**: T3, T5
**Requirement**: TIW23-43, TIW23-44

**Done when**:

- [ ] Prop blocker count 220 ±5
- [ ] Landmark AABB tests pass
- [ ] Gate: `nx test game-core`

**Tests**: unit | **Gate**: quick

**Commit**: `feat(game-core): update blockers and scatter for expanded map`

---

### T10: Nav grid + pathfinding refresh

**What**: Re-bake walkability grid at new bounds; path test village → Obelisk.
**Where**: `libs/game-core/src/walkability-grid.ts`, `pathfinding.spec.ts`
**Depends on**: T5, T6, T9
**Requirement**: TIW23-41, TIW23-42

**Done when**:

- [ ] `bakeGrid()` completes &lt; 3 s in unit test
- [ ] `findPath((0,0), (-150,55))` non-empty
- [ ] Gate: `nx test game-core`

**Tests**: unit | **Gate**: quick

**Commit**: `feat(game-core): refresh nav grid for 640m world`

---

### T11: PlayerState.zoneId schema

**What**: Add `@type('string') zoneId` to `PlayerState` default `ti_village`.
**Where**: `server/src/rooms/schema/PlayerState.ts`
**Depends on**: T3
**Requirement**: TIW23-48

**Done when**:

- [ ] Schema compiles; Colyseus reflects field
- [ ] Gate: `nx build server`

**Tests**: none (build) | **Gate**: build

**Commit**: `feat(server): replicate zoneId on PlayerState`

---

### T12: TownRoom zone tick

**What**: Update `zoneId` on spawn and each movement tick from `getZoneAt`.
**Where**: `server/src/rooms/TownRoom.ts`
**Depends on**: T11
**Requirement**: TIW23-48, TIW23-49

**Done when**:

- [ ] Room test: move from village to Obelisk coords updates `zoneId`
- [ ] Gate: `nx test server`

**Tests**: room-integration | **Gate**: quick (server)

**Commit**: `feat(server): update player zone on movement tick`

---

### T13: Combat resolver zone guards

**What**: Ensure attack/skill/mob damage uses `isInPeaceZone` (zone-backed).
**Where**: `server/src/rooms/combat-resolver.ts`, `combat-resolver.spec.ts`
**Depends on**: T4
**Requirement**: TIW23-17–19

**Done when**:

- [ ] Unit tests: peace blocks, Obelisk allows
- [ ] Gate: `nx test server`

**Tests**: unit | **Gate**: quick

**Commit**: `fix(server): combat peace guard uses zone registry`

---

### T14: Mob AI zone guards

**What**: Aggro acquisition respects peace zones via updated helper.
**Where**: `server/src/rooms/mob-ai.ts`, `mob-ai.spec.ts`
**Depends on**: T4
**Requirement**: TIW23-21

**Done when**:

- [ ] Peace player ignored; wilderness player acquired
- [ ] Gate: `nx test server`

**Tests**: unit | **Gate**: quick

**Commit**: `fix(server): mob AI respects zone peace`

---

### T15: Room-integration zone guard suite

**What**: Add/update `TownRoom.spec.ts` cases for peace attack/skill/mob + water move reject.
**Where**: `server/src/rooms/TownRoom.spec.ts`
**Depends on**: T12, T13, T14, T6
**Requirement**: TIW23-17–20, TIW23-22

**Done when**:

- [ ] Uses `ZONE_TEST_COORDS` constants (village, obelisk, harbor water)
- [ ] Gate: `nx test server`

**Tests**: room-integration | **Gate**: quick

**Commit**: `test(server): room zone guard anchors for TI world`

---

### T16: Client expanded terrain renderer

**What**: Renderer imports new `TERRAIN_CONFIG`; camera far plane / scatter field widened.
**Where**: `client/src/scene/renderer.ts`, `renderer.spec.ts`
**Depends on**: T5, T9
**Requirement**: TIW23-04 (client half)

**Done when**:

- [ ] Terrain mesh spans 640 m; no runtime throw
- [ ] Gate: `nx test client`

**Tests**: unit | **Gate**: quick (client)

**Commit**: `feat(client): render expanded 640m TI terrain`

---

### T17: Landmark GLBs batch A [P]

**What**: Source/create `Obelisk.glb`, `ElvenRuins.glb`, `RuinsArch.glb` (static meshes).
**Where**: `client/public/models/props/landmarks/`
**Depends on**: T15 (coords stable)
**Requirement**: TIW23-36, TIW23-39

**Skill**: `game-designer` → `create-prop.md`

**Done when**:

- [ ] LICENSE.txt updated
- [ ] Structural visual-gate pass for these 3 files

**Tests**: none (visual) | **Gate**: visual (partial)

**Commit**: `assets(client): add Obelisk and Elven Ruins landmark GLBs`

---

### T18: Landmark GLBs batch B [P]

**What**: Source/create `HarborDock.glb`, `CaveEntrance.glb`, `FieldShrine.glb`.
**Where**: `client/public/models/props/landmarks/`
**Depends on**: T15
**Requirement**: TIW23-36, TIW23-39

**Skill**: `game-designer` → `create-prop.md`

**Done when**:

- [ ] LICENSE.txt updated
- [ ] Structural visual-gate pass for these 3 files

**Tests**: none (visual) | **Gate**: visual (partial)

**Commit**: `assets(client): add Harbor, Cave, and Field landmark GLBs`

---

### T19: Landmark renderer + manifest

**What**: `landmark-renderer.ts`, manifest entries, hook `environment.landmarks`.
**Where**: `client/src/scene/landmark-renderer.ts`, `environment-manifest.ts`,
  `environment-renderer.ts`, `landmark-placement.spec.ts`
**Depends on**: T17, T18, T16
**Requirement**: TIW23-36–38

**Done when**:

- [ ] Six landmarks placed within 15 m of anchors
- [ ] `__GAME_STATE__.environment.landmarks.count === 6`
- [ ] Gate: `nx test client`

**Tests**: unit | **Gate**: quick (client)

**Commit**: `feat(client): place TI landmark props on expanded map`

---

### T20: wireRoom + test-hook zone indicator

**What**: `GameState.zone`; wire `player.zoneId` from room state.
**Where**: `client/src/test-hook.ts`, `client/src/net/room.ts`, `wireRoom.spec.ts`,
  `test-hook.spec.ts`
**Depends on**: T11, T12
**Requirement**: TIW23-45–47

**Done when**:

- [ ] Mock move updates `zone.id` / `zone.type` / `displayName`
- [ ] Pre-join defaults `unknown`
- [ ] Gate: `nx test client`

**Tests**: unit | **Gate**: quick (client)

**Commit**: `feat(client): expose zone in __GAME_STATE__`

---

### T21: spawn-placement zone tier tests

**What**: Replace ring-tier table with zone-tier assertions in `spawn-placement.spec.ts`.
**Where**: `server/src/seed/spawn-placement.spec.ts`
**Depends on**: T7
**Requirement**: TIW23-27–29, TIW23-31

**Done when**:

- [ ] Zone monotonic level test passes
- [ ] Gate: `nx test server`

**Tests**: unit | **Gate**: quick (server)

**Commit**: `test(server): zone-based spawn placement guards`

---

### T22: Visual gate — landmarks

**What**: Run `node scripts/visual-gate.mjs`; fix any landmark FAILs.
**Where**: `scripts/visual-gate.mjs`, landmark GLBs
**Depends on**: T17, T18, T19
**Requirement**: TIW23-39

**Done when**:

- [ ] All 6 landmark GLBs PASS structural gate

**Tests**: none (visual) | **Gate**: visual

**Commit**: `chore(assets): visual gate PASS for TI landmarks`

---

### T23: Map overview screenshot

**What**: Extend `shoot-environment.mjs` with `map-overview` camera; capture PNG for Verifier.
**Where**: `scripts/shoot-environment.mjs`, `client/environment-lab.html`
**Depends on**: T19, T16
**Requirement**: TIW23-40

**Done when**:

- [ ] PNG artifact path documented in commit or `validation.md` template
- [ ] Human/Verifier perception check ready

**Tests**: none (visual) | **Gate**: visual

**Commit**: `chore(client): TI map overview environment screenshot`

---

### T24: Full regression gate

**What**: `nx run-many -t build lint test`; fix any drift from expanded world.
**Where**: repo-wide
**Depends on**: T1–T23
**Requirement**: TIW23-50

**Done when**:

- [ ] Full gate green
- [ ] No test timing regressions &gt; 10 s per file (AD-014)

**Tests**: all layers | **Gate**: build

**Commit**: `chore: phase 23 TI world gate green`

---

## Parallel Execution Map

```
Phase 1: T1 → T2 → T3 → T4 → T5 → T6
Phase 2: T7 → T9 → T8 → T10
Phase 3: T11 → T12 → T13 → T14 → T15
Phase 4: T15 → (T17 [P] | T18 [P]) → T16 → T19 → T20 → T21
Phase 5: T22 → T23 → T24
```

---

## Task Granularity Check

| Task | Scope | Status |
| ---- | ----- | ------ |
| T1: l2-coords | 1 module | ✅ Granular |
| T3: ti-zones | 1 registry | ✅ Granular |
| T7: territory spawns | 1 pipeline + fixture | ✅ Granular |
| T17: GLB batch A | 3 assets | ✅ Granular (asset batch) |
| T24: full gate | regression only | ✅ Granular |

---

## Diagram-Definition Cross-Check

| Task | Depends On (body) | Diagram Shows | Status |
| ---- | ----------------- | ------------- | ------ |
| T2 | T1 | T1→T2 | ✅ |
| T3 | T1 | T1→T3 | ✅ |
| T4 | T3 | T3→T4 | ✅ |
| T5 | T2, T3 | T2→T5, T3→T5 | ✅ |
| T6 | T3, T5 | T5→T6, T3→T6 | ✅ |
| T7 | T1,T3,T5,T6 | T6→T7 | ✅ |
| T8 | T1,T3,T9 | T9→T8 | ✅ |
| T9 | T3, T5 | T7→T9 | ✅ |
| T10 | T5,T6,T9 | T9→T10 | ✅ |
| T11 | T3 | T10→T11 | ✅ |
| T12 | T11 | T11→T12 | ✅ |
| T13 | T4 | T12→T13 | ✅ |
| T14 | T4 | T13→T14 | ✅ |
| T15 | T12,T13,T14,T6 | T14→T15 | ✅ |
| T16 | T5, T9 | T15→T16 | ✅ |
| T17 | T15 | T15→T17 | ✅ |
| T18 | T15 | T15→T18 | ✅ |
| T19 | T17,T18,T16 | T17/T18→T19 | ✅ |
| T20 | T11, T12 | T19→T20 | ✅ |
| T21 | T7 | T20→T21 | ✅ |
| T22 | T17,T18,T19 | T21→T22 | ✅ |
| T23 | T19, T16 | T22→T23 | ✅ |
| T24 | T1–T23 | T23→T24 | ✅ |

---

## Test Co-location Validation

| Task | Code Layer | Matrix Requires | Task Says | Status |
| ---- | ---------- | --------------- | --------- | ------ |
| T1 | game-core unit | unit | unit | ✅ |
| T7 | seed + unit | unit + seed | unit + seed | ✅ |
| T11 | schema | build | none (build) | ✅ |
| T15 | room | room-integration | room-integration | ✅ |
| T17 | GLB | none (visual) | none (visual) | ✅ |
| T20 | client unit | unit | unit | ✅ |
| T24 | all | all | all | ✅ |

---

## Requirement Traceability (tasks → ACs)

| Task | ACs |
| ---- | --- |
| T1 | 01–02 |
| T2 | 03 |
| T3 | 07–14, 16 |
| T4 | 15 |
| T5 | 04–05 |
| T6 | 22–23 |
| T7 | 24–31 |
| T8 | 32–35 |
| T9 | 43–44 |
| T10 | 41–42 |
| T11–T12 | 48–49 |
| T13–T15 | 17–20, 22 |
| T14 | 21 |
| T16 | 04 |
| T17–T19 | 36–38 |
| T20 | 45–47 |
| T21 | 27–29, 31 |
| T22–T23 | 39–40 |
| T24 | 50 |

**Coverage:** 50 ACs → 24 tasks, 0 unmapped.
