# Phase 3 — Authoritative Server + Multiplayer Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and
follow its Execute flow and Critical Rules.** Do not search for skill files by
filesystem path. This repo wraps it with `spec-driven-execution` (Planner →
Implementer → Verifier, **autonomous-first**); honor server-authority (AD-001)
and the four test layers (AD-010).

**If the skill cannot be activated, STOP and tell the user — do not proceed
without it.**

---

**Design**: `.specs/features/phase-3-authoritative-server/design.md`
**Status**: Approved

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec — confirm before Execute.
> Guidelines found: `AGENTS.md` (4 test layers + server-authority + seeded RNG),
> `.cursor/skills/spec-driven-execution/SKILL.md` (test gate table),
> `AD-010` (gate commands).

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| Pure logic (`step`, intent validation, world constants) | unit | All branches; 1:1 to P3-R3/P3-R13; existing movement tests preserved | `libs/game-core/src/**/*.spec.ts` | `nx test game-core` |
| Character repository (Drizzle CRUD) | unit | create/load/save round-trip; starter stats; update position | `server/src/db/**/*.spec.ts` | `nx test server` |
| TownRoom (tick, messages, broadcast, persistence, reconnect) | room-integration (`@colyseus/testing`) | Every P3-R1,R3,R4,R8–R10 scenario; in-memory/temp DB per AD-011 | `server/src/rooms/**/*.spec.ts` | `nx test server` |
| Seed/data | none | No seed changes this phase | — | — |
| Client state wiring + remote meshes | unit (hook helpers) + e2e | Hook shape; renderer defers to integration e2e | `client/src/**/*.spec.ts`, `client-e2e/src/**/*.spec.ts` | `nx test client` / `nx e2e client-e2e` |
| Nx lib scaffold / schema-only | none | Build + lint gate | — | `nx run-many -t build lint` |

**Coverage Expectation provenance:** AGENTS.md Phase 3 emphasis = unit +
room-integration dominant; Playwright for two-browser + reconnect observability
via `__GAME_STATE__` (AD-009).

## Parallelism Assessment

> Generated from codebase — confirm before Execute.

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
| --------- | -------------- | --------------- | -------- |
| unit (game-core, repository) | Yes | Pure functions; temp DB per test file | AD-011 temp DB pattern |
| room-integration | Yes | `@colyseus/testing` `boot()` per suite; inject `:memory:` DB | Existing `TownRoom.spec.ts` |
| e2e (Playwright) | No | Shared dev server on :2567/:4200 | Phase 1–2 pattern |

## Gate Check Commands

> Generated from codebase — confirm before Execute.

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick | After server-only or lib-only tasks (unit/room-integration) | `nx test game-core` / `nx test server` / `nx test client` |
| Full | After e2e tasks or phase completion | `nx run-many -t build lint test && nx e2e client-e2e` |
| Build | After scaffold / schema-only tasks | `nx run-many -t build lint` |

> **Verifier (independent):** `nx affected -t test lint` (+ `nx e2e client-e2e`
> when client/e2e changed).

---

## Execution Plan

**3 phases** (>3 tasks → formal task list; Implementer runs sequentially).

### Phase 1: Shared core + DB foundation

```
T1 ──┬──→ T2
     └──→ T4
T3 ──────→ T4
```

(T1 and T3 are independent roots; T3 is `[P]` — order-free relative to T1.)

### Phase 2: Server authority

```
T1 ──→ T5
T1,T2,T5 ──→ T6 ──→ T7 ──→ T8
T4,T5,T6 ──→ T9 ──→ T10
```

### Phase 3: Client + E2E

```
T9 ──→ T11
T6,T7,T11 ──→ T12 ──→ T13
T12,T13 ──→ T14
T10,T14 ──→ T15
```

---

## Task Breakdown

### T1: Scaffold `libs/game-core` and move movement module `[server]`

**What**: Create the `game-core` Nx library and relocate the movement module + its spec into it verbatim, adding shared world constants.
**Where**: `libs/game-core/src/movement-system.ts`, `libs/game-core/src/world-constants.ts`, `libs/game-core/src/index.ts`, `libs/game-core/project.json`
**Depends on**: None
**Reuses**: `client/src/movement/movement-system.ts` + `client/src/movement/movement-system.spec.ts` (moved verbatim, AD-008)
**Requirement**: P3-R13

**Tools**:

- MCP: `context7` (Nx 23 library generator API) — fall back to NONE if offline
- Skill: NONE

**Done when**:

- [ ] `libs/game-core` exists with a `test` target; `step`/`createInitialMoveState` exported from `@nj/game-core`
- [ ] `world-constants.ts` exports `SPAWN_X`, `SPAWN_Z`, `SPAWN_Y`, `WORLD_MIN`, `WORLD_MAX`, `TERRAIN_SEED`
- [ ] Client imports updated to `@nj/game-core`; no duplicate `step()` remains in `client/src/movement`
- [ ] Gate check passes: `nx test game-core` and `nx test client`
- [ ] Test count: all former movement unit tests pass (no silent deletions)

**Tests**: unit
**Gate**: quick

**Commit**: `refactor(game-core): extract shared movement module into libs/game-core`

---

### T2: Add move-intent validation pure function `[server]`

**What**: Add `isValidMoveIntent(targetX, targetZ)` that rejects non-finite and out-of-bounds intents.
**Where**: `libs/game-core/src/validate-move-intent.ts` (+ spec)
**Depends on**: T1
**Reuses**: `WORLD_MIN`/`WORLD_MAX` from `world-constants.ts` (T1)
**Requirement**: P3-R3

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Accepts finite, in-bounds `(x,z)`; rejects `NaN`/`Infinity` and any coord outside `[WORLD_MIN, WORLD_MAX]`
- [ ] Exported from `@nj/game-core`
- [ ] Gate check passes: `nx test game-core`
- [ ] Test count: ≥5 unit tests (accept, NaN, Infinity, x out-of-bounds, z out-of-bounds) pass

**Tests**: unit
**Gate**: quick

**Commit**: `feat(game-core): add move-intent validation`

---

### T3: Add `characters` Drizzle table + schema SQL `[server]` `[P]`

**What**: Define the `characters` table in the Drizzle schema and create it in `applySchema()`.
**Where**: `server/src/db/schema.ts`, `server/src/db/client.ts`
**Depends on**: None
**Reuses**: existing table patterns (`monsters`, `npcs`) in `schema.ts` and `applySchema()` in `client.ts`
**Requirement**: P3-R7

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] `characters` table defined per `design.md` columns (`id`, `name`, `level`, `xp`, `hp`, `mp`, `x`, `y`, `z`, `updated_at`)
- [ ] `applySchema()` creates the table (`CREATE TABLE IF NOT EXISTS`)
- [ ] Gate check passes: `nx test server`
- [ ] Test count: ≥1 unit test opens a temp DB and round-trips an insert/select on `characters`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(db): add characters table`

---

### T4: Implement character repository `[server]`

**What**: Add a repository with `createCharacter`, `loadCharacter`, `saveCharacter`.
**Where**: `server/src/db/character-repository.ts` (+ spec)
**Depends on**: T1, T3
**Reuses**: `getDb` (`server/src/db/client.ts`), `characters` schema (T3), `SPAWN_Y`/`WORLD_*` constants (T1)
**Requirement**: P3-R7, P3-R9

**Tools**:

- MCP: `context7` (Drizzle ORM query/insert API)
- Skill: NONE

**Done when**:

- [ ] `createCharacter` returns a new UUID row with starter stats (level 1, xp 0, hp 100, mp 50) at spawn position
- [ ] `loadCharacter(id)` round-trips a saved row; returns null/undefined for unknown id
- [ ] `saveCharacter` updates position + stats + `updated_at`
- [ ] Gate check passes: `nx test server`
- [ ] Test count: ≥3 unit tests (create, load round-trip, save update) pass

**Tests**: unit
**Gate**: quick

**Commit**: `feat(db): add character repository (create/load/save)`

---

### T5: Extend `PlayerState` schema with stats + `connected` `[server]`

**What**: Add `hp`, `mp`, `xp`, `level`, `connected` fields to `PlayerState`.
**Where**: `server/src/rooms/schema/TownState.ts`
**Depends on**: T1
**Reuses**: existing `PlayerState`/`TownState` classes
**Requirement**: P3-R4

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] `PlayerState` exposes `hp`/`mp`/`xp`/`level`/`connected` with sane defaults
- [ ] Existing `TownRoom.spec.ts` join test asserts default stats on the joined player
- [ ] Gate check passes: `nx test server`
- [ ] Test count: existing join/leave tests still pass + ≥1 new default-stats assertion

**Tests**: room-integration
**Gate**: quick

**Commit**: `feat(server): extend PlayerState with stats and connected flag`

---

### T6: TownRoom simulation tick running shared `step()` `[server]`

**What**: Run a fixed 20 Hz simulation tick that advances each player via shared `step()` and syncs to schema.
**Where**: `server/src/rooms/TownRoom.ts`
**Depends on**: T1, T2, T5
**Reuses**: `step`/`createInitialMoveState` from `@nj/game-core` (T1), existing `onCreate`/`onJoin`
**Requirement**: P3-R1

**Tools**:

- MCP: `context7` (Colyseus 0.17 `setSimulationInterval` lifecycle)
- Skill: NONE

**Done when**:

- [ ] `onCreate` calls `setSimulationInterval(cb, 50)`; private `tickStates`/`pendingIntents` maps maintained
- [ ] Each tick runs `step()` and writes `x,y,z` to the player's schema; DB handle injectable via room options for tests
- [ ] Gate check passes: `nx test server`
- [ ] Test count: ≥1 room-integration test — enqueue intent, advance ticks, assert `player.x/z` moved from origin

**Tests**: room-integration
**Gate**: quick

**Commit**: `feat(server): add authoritative simulation tick`

---

### T7: TownRoom `onMessage('move')` intent handler `[server]`

**What**: Accept a client `"move"` message, validate it, and store it as the player's pending intent.
**Where**: `server/src/rooms/TownRoom.ts`
**Depends on**: T6
**Reuses**: `isValidMoveIntent` (T2), `pendingIntents` map (T6)
**Requirement**: P3-R2, P3-R3

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] `onMessage('move', …)` stores valid `{targetX,targetZ}`; invalid payloads (NaN, out-of-bounds) are silently ignored
- [ ] Gate check passes: `nx test server`
- [ ] Test count: ≥2 room-integration tests — valid intent moves player; invalid intent does not

**Tests**: room-integration
**Gate**: quick

**Commit**: `feat(server): validate and apply move intents`

---

### T8: Multi-client broadcast room-integration test `[server]`

**What**: Prove one client's server-driven movement is broadcast to another client's synced state.
**Where**: `server/src/rooms/TownRoom.spec.ts`
**Depends on**: T7
**Reuses**: `@colyseus/testing` harness from existing `TownRoom.spec.ts`
**Requirement**: P3-R4, P3-R11

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Two clients join one room; client A sends `move`; client B's synced state shows A's position changing
- [ ] Gate check passes: `nx test server`
- [ ] Test count: ≥1 two-client broadcast test passes

**Tests**: room-integration
**Gate**: quick

**Commit**: `test(server): assert multi-client position broadcast`

---

### T9: Character load/create on join `[server]`

**What**: On join, load by `options.characterId` or create a new character, populate state, and send the id back.
**Where**: `server/src/rooms/TownRoom.ts`
**Depends on**: T4, T5, T6
**Reuses**: character repository (T4), `PlayerState` stats (T5), `tickStates` (T6)
**Requirement**: P3-R9

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] `onJoin(client, options)` loads by `characterId` or creates new; populates `PlayerState` + `tickStates`; sends `characterId` to client
- [ ] Gate check passes: `nx test server`
- [ ] Test count: ≥2 room-integration tests (temp DB) — join without id creates a row; join with known id restores position

**Tests**: room-integration
**Gate**: quick

**Commit**: `feat(server): load or create character on join`

---

### T10: Persist on leave/drop + `allowReconnection` `[server]`

**What**: Persist character on leave/drop, support 30s reconnection, and debounce-save on movement.
**Where**: `server/src/rooms/TownRoom.ts`
**Depends on**: T9
**Reuses**: `saveCharacter` (T4), Colyseus `allowReconnection`/`onLeave`
**Requirement**: P3-R8, P3-R10

**Tools**:

- MCP: `context7` (Colyseus 0.17 `allowReconnection`/`onLeave` consented vs dropped)
- Skill: NONE

**Done when**:

- [ ] Consented `onLeave` saves + removes from state; drop saves, sets `connected=false`, calls `allowReconnection(client, 30)`; reconnect sets `connected=true`
- [ ] Debounced save (~5 s) on position change (test via injected short interval or package-private helper)
- [ ] After movement, `hp`/`mp`/`xp`/`level` remain unchanged on `PlayerState` and in the persisted row (spec persistence AC 7)
- [ ] Gate check passes: `nx test server`
- [ ] Test count: ≥3 room-integration tests — leave persists updated coords; drop+reconnect within window preserves the session; stats unchanged after move

**Tests**: room-integration
**Gate**: quick

**Commit**: `feat(server): persist characters and allow reconnection`

---

### T11: Client — persist `characterId` and hold `Room` reference `[client]`

**What**: Read/write `characterId` in `localStorage`, pass it on join, handle the server `characterId` message, and expose the `Room`.
**Where**: `client/src/net/room.ts`, `client/src/main.ts`
**Depends on**: T9
**Reuses**: `connect`/`connectSafe` (`net/room.ts`), `boot()` wiring (`main.ts`)
**Requirement**: P3-R9

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] `localStorage` key `nj.characterId` read on connect and passed to `joinOrCreate`; server `characterId` message persisted
- [ ] `connect`/`connectSafe` return the `Room` to `main.ts`
- [ ] Gate check passes: `nx test client`
- [ ] Test count: ≥1 client unit test (mock `localStorage` + room message); existing connect e2e remains green

**Tests**: unit
**Gate**: quick

**Commit**: `feat(client): persist characterId and expose room`

---

### T12: Client — wire state callbacks, remove local `step()` `[client]`

**What**: Drive the local player from room state and send `move` intents on click; delete client-side movement authority.
**Where**: `client/src/main.ts`, `client/src/scene/renderer.ts`
**Depends on**: T6, T7, T11
**Reuses**: `handleClick` (`renderer.ts`), `setPlayer`/`setTarget` (`test-hook.ts`), `@colyseus/sdk` state callbacks
**Requirement**: P3-R2, P3-R5

**Tools**:

- MCP: `context7` (`@colyseus/sdk` state-callbacks `getStateCallbacks`)
- Skill: NONE

**Done when**:

- [ ] Click sends `room.send('move', …)`; no local `step()` runs in the client tick
- [ ] Local mesh + follow camera read `room.state.players.get(sessionId)`
- [ ] Gate check passes: `nx run-many -t build lint test && nx e2e client-e2e` (smoke + connect specs)
- [ ] Test count: smoke e2e still proves click moves the player (now server-driven), no specs deleted

**Tests**: e2e
**Gate**: full

**Commit**: `feat(client): drive movement from server state`

---

### T13: Client — render remote player meshes `[client]`

**What**: Add/update/remove meshes for other players from `state.players`.
**Where**: `client/src/scene/renderer.ts`
**Depends on**: T12
**Reuses**: existing player mesh creation in `renderer.ts`, map-callback wiring (T12)
**Requirement**: P3-R6

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] `onAdd`/`onRemove`/`onChange` for other `sessionId`s create/remove/update remote capsules
- [ ] Remote-player map helper extracted and unit-tested
- [ ] Gate check passes: `nx test client`
- [ ] Test count: ≥1 client unit test for the remote-player map helper

**Tests**: unit
**Gate**: quick

**Commit**: `feat(client): render remote players`

---

### T14: Client — extend `__GAME_STATE__` with `others` + `characterId` `[client]`

**What**: Add `others` and `characterId` to the test hook and wire them from state callbacks.
**Where**: `client/src/test-hook.ts`
**Depends on**: T12, T13
**Reuses**: `GameState` interface + `setPlayer` pattern (`test-hook.ts`)
**Requirement**: P3-R12

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] `GameState` exposes `others` (array of `{id,x,y,z}` per design) and `characterId`; `setOthers` helper added
- [ ] Gate check passes: `nx test client`
- [ ] Test count: ≥1 client unit test for `setOthers`

**Tests**: unit
**Gate**: quick

**Commit**: `feat(client): expose multiplayer state in __GAME_STATE__`

---

### T15: E2E — two-browser multiplayer + reconnect `[client]`

**What**: Prove two browsers see each other move and that a character resumes on reconnect.
**Where**: `client-e2e/src/multiplayer.spec.ts`
**Depends on**: T10, T14
**Reuses**: existing Playwright connect/smoke specs under `client-e2e/src/`
**Requirement**: P3-R11, P3-R10, P3-R6

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Two browser contexts connect; A moves; B's `__GAME_STATE__.others` includes A with changed coords
- [ ] A disconnects and rejoins with the same `localStorage` `characterId`; position matches pre-disconnect within movement tolerance
- [ ] Gate check passes: `nx run-many -t build lint test && nx e2e client-e2e`
- [ ] Test count: ≥2 e2e scenarios (two-browser sync, reconnect-resume) pass

**Tests**: e2e
**Gate**: full

**Commit**: `test(client-e2e): two-browser multiplayer and reconnect`

---

## Parallel Execution Map

```
Phase 1 (Shared core + DB):
  T1 ──→ T2
  T3 [P]            (independent of T1)
  T1, T3 ──→ T4

Phase 2 (Server authority):
  T1 ──→ T5
  T1,T2,T5 ──→ T6 ──→ T7 ──→ T8
  T4,T5,T6 ──→ T9 ──→ T10

Phase 3 (Client + E2E — sequential; e2e not parallel-safe):
  T9 ──→ T11
  T6,T7,T11 ──→ T12 ──→ T13 ──→ T14
  T10,T14 ──→ T15
```

**Parallelism constraint:** A task marked `[P]` has no unfinished dependencies,
a parallel-safe test type, and no shared mutable state with other `[P]` tasks in
its phase. Only **T3** qualifies (independent root, parallel-safe unit test with
temp DB per AD-011). All e2e tasks (T12, T15) are sequential — e2e shares the
dev server on :2567/:4200.

---

## Task Granularity Check

| Task | Scope | Status |
| ---- | ----- | ------ |
| T1: Scaffold lib + move movement module | 1 lib + verbatim move | ✅ Cohesive |
| T2: Intent validation function | 1 function | ✅ Granular |
| T3: `characters` table + schema SQL | 1 table (2 cohesive files) | ✅ Cohesive |
| T4: Character repository | 1 module (3 fns) | ✅ Cohesive |
| T5: Extend PlayerState | 1 schema class | ✅ Granular |
| T6: Simulation tick | 1 room method | ✅ Granular |
| T7: `onMessage('move')` handler | 1 handler | ✅ Granular |
| T8: Multi-client broadcast test | 1 test file | ✅ Granular |
| T9: Load/create on join | 1 room method | ✅ Granular |
| T10: Persist + reconnection | 1 cohesive lifecycle | ✅ Cohesive |
| T11: client `characterId` + room ref | 1 concern (2 files) | ✅ Cohesive |
| T12: state callbacks; remove local step | 1 wiring concern | ✅ Cohesive |
| T13: remote player meshes | 1 renderer concern | ✅ Granular |
| T14: extend `__GAME_STATE__` | 1 hook file | ✅ Granular |
| T15: two-browser + reconnect e2e | 1 spec file | ✅ Granular |

All tasks atomic or cohesive single-concern → no split required.

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| ---- | ---------------------- | ------------- | ------ |
| T1 | None | root | ✅ Match |
| T2 | T1 | T1 → T2 | ✅ Match |
| T3 | None | root `[P]` | ✅ Match |
| T4 | T1, T3 | T1 → T4, T3 → T4 | ✅ Match |
| T5 | T1 | T1 → T5 | ✅ Match |
| T6 | T1, T2, T5 | T1,T2,T5 → T6 | ✅ Match |
| T7 | T6 | T6 → T7 | ✅ Match |
| T8 | T7 | T7 → T8 | ✅ Match |
| T9 | T4, T5, T6 | T4,T5,T6 → T9 | ✅ Match |
| T10 | T9 | T9 → T10 | ✅ Match |
| T11 | T9 | T9 → T11 | ✅ Match |
| T12 | T6, T7, T11 | T6,T7,T11 → T12 | ✅ Match |
| T13 | T12 | T12 → T13 | ✅ Match |
| T14 | T12, T13 | T12,T13 → T14 | ✅ Match |
| T15 | T10, T14 | T10,T14 → T15 | ✅ Match |

All `Depends on` fields reconcile with the Execution Plan arrows.

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| ---- | --------------------------- | --------------- | --------- | ------ |
| T1 | Pure logic + lib scaffold | unit | unit | ✅ OK |
| T2 | Pure logic (validation) | unit | unit | ✅ OK |
| T3 | Schema/table | unit (round-trip) | unit | ✅ OK |
| T4 | Character repository | unit | unit | ✅ OK |
| T5 | TownRoom schema | room-integration | room-integration | ✅ OK |
| T6 | TownRoom (tick) | room-integration | room-integration | ✅ OK |
| T7 | TownRoom (message) | room-integration | room-integration | ✅ OK |
| T8 | TownRoom (broadcast) | room-integration | room-integration | ✅ OK |
| T9 | TownRoom (join persistence) | room-integration | room-integration | ✅ OK |
| T10 | TownRoom (persistence/reconnect) | room-integration | room-integration | ✅ OK |
| T11 | Client state wiring | unit (+e2e at T15) | unit | ✅ OK |
| T12 | Client state wiring | e2e | e2e | ✅ OK |
| T13 | Client remote meshes | unit (+e2e at T15) | unit | ✅ OK |
| T14 | Client hook | unit | unit | ✅ OK |
| T15 | Client e2e | e2e | e2e | ✅ OK |

Every task's own code is tested in the task that creates it. The client wiring's
multiplayer/reconnect observability is proven by the dedicated e2e task T15 (the
two-browser test cannot run until T10 + T14 exist), not deferred from a task that
produces otherwise-unverified code.

---

## Requirement → Task Map

| Req ID | Tasks |
| ------ | ----- |
| P3-R1 | T6 |
| P3-R2 | T7, T12 |
| P3-R3 | T2, T7 |
| P3-R4 | T5, T8 |
| P3-R5 | T12 |
| P3-R6 | T13, T15 |
| P3-R7 | T3, T4 |
| P3-R8 | T10 |
| P3-R9 | T4, T9, T11 |
| P3-R10 | T10, T15 |
| P3-R11 | T8, T15 |
| P3-R12 | T14, T15 |
| P3-R13 | T1 |

---

## Ordered Task Summary

| # | Task | Layer | Test layer | Gate | Deps |
| - | ---- | ----- | ---------- | ---- | ---- |
| T1 | Scaffold `libs/game-core` + move movement | server | unit | quick | — |
| T2 | Intent validation function | server | unit | quick | T1 |
| T3 | `characters` Drizzle table | server | unit | quick | — `[P]` |
| T4 | Character repository | server | unit | quick | T1, T3 |
| T5 | Extend `PlayerState` schema | server | room-integration | quick | T1 |
| T6 | TownRoom simulation tick | server | room-integration | quick | T1, T2, T5 |
| T7 | `onMessage('move')` handler | server | room-integration | quick | T6 |
| T8 | Two-client broadcast test | server | room-integration | quick | T7 |
| T9 | Load/create character on join | server | room-integration | quick | T4, T5, T6 |
| T10 | Persist + `allowReconnection` | server | room-integration | quick | T9 |
| T11 | Client `characterId` + room ref | client | unit | quick | T9 |
| T12 | State callbacks; remove local step | client | e2e | full | T6, T7, T11 |
| T13 | Remote player meshes | client | unit | quick | T12 |
| T14 | Extend `__GAME_STATE__` | client | unit | quick | T12, T13 |
| T15 | Two-browser + reconnect E2E | client | e2e | full | T10, T14 |
