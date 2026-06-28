# Phase 9 — Terrain Walkability & Collision Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and
follow its Execute flow and Critical Rules.** This repo wraps it with
`spec-driven-execution` (Planner → Implementer → Verifier, **autonomous-first**);
honor server-authority (AD-001) and the four test layers (AD-010).

**If the skill cannot be activated, STOP and tell the user — do not proceed
without it.**

---

**Design**: `.specs/features/phase-9-terrain-walkability/design.md`
**Status**: Draft

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec — confirm before Execute.
> Guidelines found: `AGENTS.md` (4 test layers + server-authority + seeded RNG +
> 10-second rule), `.specs/STATE.md` AD-009/AD-010/AD-014, existing patterns in
> `libs/game-core/src/world-constants.spec.ts`, `server/src/rooms/TownRoom.spec.ts`,
> `client-e2e/src/*.spec.ts`.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| Terrain height (`sampleHeight`, `snapEntityY`, derived `SPAWN_Y`) | unit | TERR-01/05 ACs; anchors `sampleHeight(0,0)=3.263961466789237`, `SPAWN_Y=4.263961466789237` | `libs/game-core/src/terrain.spec.ts` | `nx test game-core` |
| Walkability + blockers (`isWalkable`, `findPath`) | unit | TERR-06/10 ACs; slope anchor `(-42,75)→(-41,75)`; building `(0,5)→(0,-14)`; path `(0,20)→(0,-25)` | `libs/game-core/src/walkability.spec.ts`, `pathfinding.spec.ts` | `nx test game-core` |
| Path follow (`stepAlongPath`) | unit | Waypoint advance, arrival epsilon, intent replacement | `libs/game-core/src/movement-system.spec.ts` | `nx test game-core` |
| TownRoom Y snap + walk reject + pathing | room-integration | TERR-02/03/04/07/09/11 ACs; AD-014 `simulate()` harness | `server/src/rooms/TownRoom.spec.ts` | `nx test server` |
| Mob AI walkability | room-integration | TERR-08; mob does not enter building | `server/src/rooms/TownRoom.spec.ts` or `mob-ai.spec.ts` | `nx test server` |
| Client terrain import + path preview | unit | Shared import smoke; preview uses `findPath` | `client/src/scene/terrain.spec.ts` | `nx test client` |
| Pathing E2E | e2e | TERR-13; trail outside building AABB | `client-e2e/src/terrain-pathing.spec.ts` | `nx e2e client-e2e` |
| Three.js mesh builder only | none | Build gate | `client/src/scene/terrain.ts` | build gate |

## Parallelism Assessment

> Generated from codebase — confirm before Execute.

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
| --------- | -------------- | --------------- | -------- |
| Unit (`game-core`) | Yes | Pure functions | `libs/game-core/src/world-constants.spec.ts` |
| Unit (`client`) | Yes | Per-test jsdom/three | `client/src/scene/terrain.spec.ts` |
| Room integration (`server`) | Yes | `NJ_AUTOSIM=0` + per-test room + `:memory:` DB (AD-014) | `server/src/rooms/TownRoom.spec.ts` |
| E2E (`client-e2e`) | Yes | Per-test `?room=` instanceKey, 4 workers (AD-014) | `client-e2e/playwright.config.ts` |

## Gate Check Commands

> Generated from codebase (AD-010) — confirm before Execute.

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick (game-core) | After T1–T5, T10–T11 | `nx test game-core` |
| Quick (server) | After T7–T9, T13 | `nx test server` |
| Quick (client) | After T6, T14 | `nx test client` |
| Full | After T15 | `nx affected -t test lint` + `nx e2e client-e2e` |
| Build | Phase completion | `nx run-many -t build lint test` |

---

## Execution Plan

**5 phases** (14 tasks).

### Phase 1: Shared terrain (game-core) — Sequential

```
T1 → T2 → T3
```

### Phase 2: Walkability + blockers (game-core) — Sequential

```
T3 → T4 → T5
```

### Phase 3: Client + server Y snap — Parallel (distinct deps)

```
T3 ──→ T7
T5 ──→ T6
```

(`T7` only needs derived `SPAWN_Y`/terrain from Phase 1; `T6` needs blockers
from Phase 2. The two branches may run concurrently once their deps are met.)

### Phase 4: Walkability enforcement — Sequential

```
T6,T7,T5 → T8 → T9
```

### Phase 5: Pathfinding + E2E — Sequential

```
T9 → T10 → T11 → T12 → T13 → T14 → T15
```

> 5 phases → Execute **offers one sub-agent per phase** (sequential), then a
> fresh Verifier after T15.

---

## Task Breakdown

### T1: Shared terrain module (`game-core`)

**What**: Lift noise + `sampleHeight` + `TERRAIN_CONFIG` + `FEET_OFFSET` +
`snapEntityY` into `libs/game-core/src/terrain.ts`; export from `index.ts`.
**Where**: `libs/game-core/src/terrain.ts`, `libs/game-core/src/index.ts`
**Depends on**: None
**Reuses**: `client/src/scene/terrain.ts` (verbatim noise lift)
**Requirement**: TERR-01

**Tools**: MCP: NONE · Skill: `tlc-spec-driven`

**Done when**:
- [ ] `TERRAIN_CONFIG` matches `{ seed:42, size:200, segments:64, heightScale:10 }`
- [ ] `FEET_OFFSET = 1.0`; `snapEntityY` exported
- [ ] Quick gate passes: `nx test game-core` (T2 tests land in same commit or immediately after — see T2)

**Tests**: unit (co-located in T2)
**Gate**: quick

**Commit**: `feat(game-core): add shared terrain height sampling`

---

### T2: Terrain unit tests + anchors

**What**: `terrain.spec.ts` — determinism, `sampleHeight(0,0)` anchor, `snapEntityY`.
**Where**: `libs/game-core/src/terrain.spec.ts`
**Depends on**: T1
**Reuses**: Spec anchors from `spec.md`
**Requirement**: TERR-01, TERR-05

**Done when**:
- [ ] `sampleHeight(0,0)` === `3.263961466789237` (±`1e-10`)
- [ ] Identical inputs → identical outputs (two calls)
- [ ] `snapEntityY(0,0)` === `sampleHeight(0,0) + 1`
- [ ] Quick gate passes: `nx test game-core`; test count recorded

**Tests**: unit
**Gate**: quick

**Commit**: `test(game-core): terrain sampleHeight anchors`

---

### T3: Derive `SPAWN_Y` from `snapEntityY`

**What**: Replace hard-coded `SPAWN_Y` float with `snapEntityY(SPAWN_X, SPAWN_Z)`;
update `world-constants.spec.ts` to assert anchor `4.263961466789237`.
**Where**: `libs/game-core/src/world-constants.ts`, `world-constants.spec.ts`
**Depends on**: T1
**Reuses**: `terrain.snapEntityY`
**Requirement**: TERR-05

**Done when**:
- [ ] `SPAWN_Y` derived; anchor `4.263961466789237` (±`1e-10`)
- [ ] `player-death` / existing tests still pass
- [ ] Quick gate: `nx test game-core`

**Tests**: unit
**Gate**: quick

**Commit**: `refactor(game-core): derive SPAWN_Y from shared terrain`

---

### T4: World blockers + scatter lift

**What**: `world-blockers.ts` (building AABBs) + `world-scatter.ts` (lift
`scatterProps`); `getPropBlockers(seed)` with tree r=1.2, rock r=0.7.
**Where**: `libs/game-core/src/world-blockers.ts`, `world-scatter.ts`
**Depends on**: T1
**Reuses**: `village.ts` `BUILDING_LAYOUT`, `scatter.ts` algorithm
**Requirement**: TERR-06

**Done when**:
- [ ] Five building AABBs exported; centre `(0,-14)` half `4×3`
- [ ] `isBlocked(x,z)` true inside building at `(0,-14)`
- [ ] Unit test: building blocker coverage
- [ ] Quick gate: `nx test game-core`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(game-core): world blocker volumes + shared scatter`

---

### T5: `isWalkable` + unit tests

**What**: `walkability.ts` with bounds, slope, step-height, subdivisions, blockers.
**Where**: `libs/game-core/src/walkability.ts`, `walkability.spec.ts`
**Depends on**: T1, T4
**Reuses**: `WORLD_MIN`/`WORLD_MAX`, `sampleHeight`, blockers
**Requirement**: TERR-06

**Done when**:
- [ ] `MAX_STEP_HEIGHT=0.75`, `MAX_SLOPE_TANGENT=0.55`, `WALK_CHECK_SUBDIVISIONS=4`
- [ ] `(-42,75)→(-41,75)` → **false**; `(0,5)→(0,-14)` → **false**; `(20,20)→(21,20)` → **true**
- [ ] OOB → **false**
- [ ] Quick gate: `nx test game-core`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(game-core): isWalkable terrain slope and blockers`

---

### T6: Client terrain refactor `[P]`

**What**: Client `terrain.ts` imports `generateTerrain`/`sampleHeight` from
`game-core`; `village.ts`/`scatter.ts` import shared layout/scatter; delete
duplicated noise.
**Where**: `client/src/scene/terrain.ts`, `village.ts`, `scatter.ts`, `renderer.ts`
**Depends on**: T5
**Reuses**: `createTerrainMesh` stays client-side
**Requirement**: TERR-01

**Done when**:
- [ ] `client/src/scene/terrain.spec.ts` still green (determinism)
- [ ] Visual terrain unchanged (same seed/config)
- [ ] Quick gate: `nx test client`

**Tests**: unit
**Gate**: quick

**Commit**: `refactor(client): import shared terrain from game-core`

---

### T7: Server entity Y snap `[P]`

**What**: `TownRoom.simulate` sets `player.y = snapEntityY(x,z)` after movement;
`initializeNpcs` + `spawn-manager` init/respawn snap mob/NPC `y`.
**Where**: `server/src/rooms/TownRoom.ts`, `spawn-manager.ts`
**Depends on**: T3
**Reuses**: `snapEntityY`
**Requirement**: TERR-02, TERR-03, TERR-04

**Done when**:
- [ ] Room test: player move changes `y` to match `snapEntityY` at new `x,z`
- [ ] Room test: spawned mob `y === snapEntityY(spawnX, spawnZ)`
- [ ] Quick gate: `nx test server`

**Tests**: room-integration
**Gate**: quick

**Commit**: `feat(server): snap entity Y to shared terrain height`

---

### T8: TownRoom walkability rejection

**What**: After `step()`, reject `x,z` if `!isWalkable(prev, next)`; room tests
for building + slope.
**Where**: `server/src/rooms/TownRoom.ts`, `TownRoom.spec.ts`
**Depends on**: T5, T7
**Reuses**: `isWalkable`, existing `simulate()` helpers
**Requirement**: TERR-07, TERR-09

**Done when**:
- [ ] Move intents into `(0,-14)` do not enter building AABB
- [ ] Slope rejection test at `(-42,75)` if reachable (or unit-only + building room test)
- [ ] Existing movement tests updated to open-field coords where needed
- [ ] Quick gate: `nx test server`

**Tests**: room-integration
**Gate**: quick

**Commit**: `feat(server): reject unwalkable player steps in TownRoom`

---

### T9: Mob AI walkability

**What**: `mob-ai.ts` `moveToward` applies `isWalkable` before committing `x,z`.
**Where**: `server/src/rooms/mob-ai.ts`, tests
**Depends on**: T5, T8
**Reuses**: `isWalkable`
**Requirement**: TERR-08

**Done when**:
- [ ] Unit or room test: mob adjacent to building does not enter on wander/chase tick
- [ ] Quick gate: `nx test server`

**Tests**: room-integration
**Gate**: quick

**Commit**: `feat(server): mob movement respects isWalkable`

---

### T10: Walkability grid bake

**What**: `walkability-grid.ts` — lazy 190×190 bake from blockers + local slope.
**Where**: `libs/game-core/src/walkability-grid.ts`, `walkability-grid.spec.ts`
**Depends on**: T5
**Reuses**: `isBlocked`, `sampleHeight`, slope constants
**Requirement**: TERR-10

**Done when**:
- [ ] Cell `(0,-14)` unwalkable; open field cell `(20,20)` walkable
- [ ] Grid dimensions `190×190`
- [ ] Quick gate: `nx test game-core`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(game-core): bake 1m walkability grid`

---

### T11: A* pathfinding

**What**: `pathfinding.ts` — `findPath`, `snapToNearestWalkable`; 8-connected,
no corner cutting.
**Where**: `libs/game-core/src/pathfinding.ts`, `pathfinding.spec.ts`
**Depends on**: T10
**Reuses**: walkability grid
**Requirement**: TERR-10

**Done when**:
- [ ] `findPath({x:0,z:20},{x:0,z:-25})` returns non-empty path
- [ ] Every path vertex outside building AABB at `(0,-14)`
- [ ] Deterministic: same path on two calls
- [ ] Quick gate: `nx test game-core`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(game-core): grid A* pathfinding`

---

### T12: `stepAlongPath` in movement-system

**What**: `PathMoveState`, `stepAlongPath`, `createPathMoveState`; waypoint
advance at `ARRIVAL_EPSILON`.
**Where**: `libs/game-core/src/movement-system.ts`, `movement-system.spec.ts`
**Depends on**: T11
**Reuses**: existing `step` speed/epsilon
**Requirement**: TERR-11

**Done when**:
- [ ] Unit: 3-waypoint path reaches goal in bounded ticks
- [ ] Unit: new intent clears/replaces waypoints (via caller contract)
- [ ] Quick gate: `nx test game-core`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(game-core): stepAlongPath waypoint follower`

---

### T13: TownRoom path on move intent

**What**: On `"move"`: snap goal → `findPath` → store waypoints in tick state;
simulate uses `stepAlongPath`; segment validation via `isWalkable`.
**Where**: `server/src/rooms/TownRoom.ts`, `TownRoom.spec.ts`
**Depends on**: T12, T9
**Reuses**: `findPath`, `stepAlongPath`
**Requirement**: TERR-11

**Done when**:
- [ ] Room test: intent `(0,20)→(0,-25)` results in `z` approaching `-25` without entering building AABB
- [ ] Room test: each tick advance is walkable
- [ ] Quick gate: `nx test server`

**Tests**: room-integration
**Gate**: quick

**Commit**: `feat(server): authoritative path following on move intent`

---

### T14: Client path preview

**What**: Optional `THREE.Line` preview from `findPath` on click; same
`game-core` import; preview cleared on new click.
**Where**: `client/src/scene/renderer.ts` (+ small helper), unit smoke
**Depends on**: T6, T11
**Reuses**: `findPath`
**Requirement**: TERR-12

**Done when**:
- [ ] Unit: path helper returns ≥2 points for `(0,20)→(0,-25)`
- [ ] Quick gate: `nx test client`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(client): path preview line on click-to-move`

---

### T15: E2E terrain pathing

**What**: `client-e2e/src/terrain-pathing.spec.ts` — join isolated room, place
via intents at `(0,20)`, click `(0,-25)`, poll trail outside building AABB.
**Where**: `client-e2e/src/terrain-pathing.spec.ts`
**Depends on**: T13, T14
**Reuses**: `__sendMoveIntent__`, `__GAME_STATE__`, `game-page.ts` room isolation
**Requirement**: TERR-13

**Done when**:
- [ ] E2e records ≥5 position samples; all outside `|x|≤4 && |z+14|≤3`
- [ ] Full gate: `nx e2e client-e2e` + `nx run-many -t build lint test`
- [ ] Append **AD-018** to `.specs/STATE.md` (MVP walkability amends AD-006)

**Tests**: e2e
**Gate**: full

**Commit**: `test(e2e): click-to-move routes around village building`

---

## Parallel Execution Map

```
Phase 1:  T1 → T2 → T3

Phase 2:  T3 → T4 → T5

Phase 3:  T3 → T7  |  T5 → T6  (parallel when both deps met)

Phase 4:  T6,T7 → T8 → T9

Phase 5:  T9 → T10 → T11 → T12 → T13 → T14 → T15
```

---

## Task Granularity Check

| Task | Scope | Status |
| ---- | ----- | ------ |
| T1: terrain module | 1 lib file | ✅ Granular |
| T2: terrain tests | 1 spec file | ✅ Granular |
| T3: SPAWN_Y derive | 1 constant change | ✅ Granular |
| T4: blockers + scatter | 2 related lib files (cohesive) | ✅ Granular |
| T5: isWalkable | 1 function + spec | ✅ Granular |
| T6: client refactor | import wiring | ✅ Granular |
| T7: server Y snap | TownRoom + spawn-manager | ✅ Granular |
| T8: walk reject | TownRoom guard | ✅ Granular |
| T9: mob walkability | mob-ai guard | ✅ Granular |
| T10: grid bake | 1 module | ✅ Granular |
| T11: A* | 1 module | ✅ Granular |
| T12: stepAlongPath | movement extension | ✅ Granular |
| T13: TownRoom pathing | room wiring | ✅ Granular |
| T14: path preview | client UX | ✅ Granular |
| T15: e2e | 1 spec file | ✅ Granular |

---

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| ---- | ---------------------- | ------------- | ------ |
| T1 | None | Phase 1 root | ✅ |
| T2 | T1 | T1 → T2 | ✅ |
| T3 | T1 | T1 → T3 (via T2 chain) | ✅ |
| T4 | T1 | Phase 2 from T3 | ✅ (T3→T4) |
| T5 | T1, T4 | T4 → T5 | ✅ |
| T6 | T5 | T5 → T6 | ✅ |
| T7 | T3 | T3 → T7 | ✅ |
| T8 | T5, T7 | T6,T7 → T8 | ✅ |
| T9 | T5, T8 | T8 → T9 | ✅ |
| T10 | T5 | T9 → T10 | ✅ |
| T11 | T10 | T10 → T11 | ✅ |
| T12 | T11 | T11 → T12 | ✅ |
| T13 | T12, T9 | T12 → T13 | ✅ |
| T14 | T6, T11 | T13 → T14 | ✅ (T11 done; parallel to T13 chain after T12) |
| T15 | T13, T14 | T14 → T15 | ✅ |

---

## Test Co-location Validation

| Task | Code Layer | Matrix Requires | Task Says | Status |
| ---- | ---------- | --------------- | --------- | ------ |
| T1 | terrain | unit (T2) | none (T2 commits tests) | ✅ OK — T2 immediate |
| T2 | terrain | unit | unit | ✅ |
| T3 | world-constants | unit | unit | ✅ |
| T4 | blockers | unit | unit | ✅ |
| T5 | walkability | unit | unit | ✅ |
| T6 | client terrain | unit | unit | ✅ |
| T7 | TownRoom Y | room-integration | room-integration | ✅ |
| T8 | TownRoom walk | room-integration | room-integration | ✅ |
| T9 | mob-ai | room-integration | room-integration | ✅ |
| T10 | grid | unit | unit | ✅ |
| T11 | pathfinding | unit | unit | ✅ |
| T12 | movement | unit | unit | ✅ |
| T13 | TownRoom path | room-integration | room-integration | ✅ |
| T14 | client preview | unit | unit | ✅ |
| T15 | e2e | e2e | e2e | ✅ |
