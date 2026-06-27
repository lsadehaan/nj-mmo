# Phase 1+2 — Foundation & World Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and
follow its Execute flow and Critical Rules.** Do not search for skill files by
filesystem path. The skill is the source of truth for the full flow (per-task
cycle, sub-agent delegation, adequacy review, Verifier, discrimination sensor).
This repo wraps it with the project skill `spec-driven-execution` (Planner →
Implementer → Verifier); honor server-authority and the four test layers.

**If the skill cannot be activated, STOP and tell the user — do not proceed
without it.**

---

**Design**: `.specs/features/phase-1-2-foundation-world/design.md`
**Status**: In Progress (T1 done)

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec — confirm before Execute.
> Guidelines found: `AGENTS.md` (4 test layers + server-authority + seeded RNG),
> `.cursor/skills/spec-driven-execution/SKILL.md` (test gate table). No existing
> test code yet (greenfield) → strong defaults applied, conformed to AGENTS.md.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| Pure logic (XML parsers, movement system, follow camera, terrain gen, scatter, village builder) | unit | All branches; 1:1 to spec ACs; every listed edge case has a test; randomness via injected seeded RNG | `server/src/**/*.spec.ts`, `client/src/**/*.spec.ts` | `nx test server` / `nx test client` |
| Colyseus room (`TownRoom`) | room integration (`@colyseus/testing`) | Join + leave + state present; no client-trust shortcuts | `server/src/rooms/**/*.spec.ts` | `nx test server` |
| Seed → SQLite | seed/data (Vitest, asserts DB rows) | Every seeded entity asserts authentic Classic values; idempotency; fail-loud on missing field | `server/src/seed/**/*.spec.ts` | `nx test server` |
| Client app / world / input integration | e2e (Playwright) | Happy path: boot + canvas mount + connected; click-to-move changes player pos via `window.__GAME_STATE__`; never assert pixels | `client-e2e/src/**/*.spec.ts` | `nx e2e client-e2e` |
| Schema / config / scaffold (Drizzle tables, Nx/Vite/Playwright config, server bootstrap, dev script) | none | Build + lint gate only | — | build gate only |

**Coverage Expectation provenance:** AGENTS.md mandates server-side testing of
game-outcome logic, the four layers, WebGL-not-DOM-testable rule (assert via
`window.__GAME_STATE__`), and seeded RNG determinism. Strong defaults fill depth
since no tests exist yet.

## Parallelism Assessment

> Generated from codebase — confirm before Execute.

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
| --------- | -------------- | --------------- | -------- |
| unit (pure logic) | Yes | No shared state; pure functions; seeded RNG injected per test | Modules import only plain types (design: movement/camera/terrain have no DOM/three/db deps) |
| room integration | Yes | `@colyseus/testing` boots an isolated in-process server per suite | Standard `@colyseus/testing` `boot()` per test file |
| seed/data | Yes | Each test creates a fresh temp/in-memory SQLite DB (never a shared file) | Design "Risks": per-test temp DB mitigation |
| e2e (Playwright) | No | Single shared dev server (server+client) + shared `window.__GAME_STATE__` | One webServer; global logical state |

## Gate Check Commands

> Generated from codebase — confirm before Execute.

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick | After tasks with unit / room / seed tests only | `nx test server` and/or `nx test client` |
| Full | After tasks that add or touch e2e behavior | `nx test server && nx test client && nx e2e client-e2e` |
| Build | After scaffold/schema/config-only tasks and at phase completion | `nx run-many -t build lint test` |

> **Verifier (independent):** re-derives coverage with `nx affected -t test lint`
> (add `nx e2e client-e2e` when the client/world changed), per AGENTS.md
> "run only what changed" + Nx caching.

---

## Execution Plan

**2 phases** (≤3 → executed inline by the orchestrator; no per-phase sub-agents
required).

### Phase 1: Foundation (mostly sequential, two parallel pairs)

```
T1 ──┬─→ T2 ──┬─→ T5 ─┐
     │        ├─→ T6 ─┤
     └─→ T3   │       │
T2,T3 ─→ T4   │       │
T6 ─→ T7 ─→ T8 ─→ T9 ─→ T10 ─→ T11
T4,T5 ─→ T12
```

### Phase 2: World (fan-out after terrain, converge on smoke)

```
T12 ─→ T13 ──┬─→ T14 ─┐
             ├─→ T15 ─┤
             └─→ T16 ─┼─→ T17 ─┐
                      └─→ T18 ─┤
T14,T15,T17,T18 ─────────────→ T19
```

---

## Task Breakdown

### T1: Initialize Nx workspace `[infra]`

**What**: Create the Nx 23 monorepo root (`nx.json`, `tsconfig.base.json`, root
`package.json`) with TypeScript 6, targeting `build`/`lint`/`test`/`e2e`.
**Where**: repo root.
**Depends on**: None
**Reuses**: n/a (greenfield)
**Requirement**: FND-01

**Tools**: MCP: NONE · Skill: `tlc-spec-driven`

**Done when**:
- [x] `nx.json`, `tsconfig.base.json`, root `package.json` exist; `npx nx report` runs
- [x] No TypeScript/config errors
- [x] Gate check passes: `nx run-many -t lint` (no projects yet → clean)

**Tests**: none · **Gate**: build
**Commit**: `chore(repo): initialize Nx workspace`

---

### T2: Scaffold `server` project `[infra]`

**What**: Create the `@nx/node` `server` project with `colyseus`,
`@colyseus/schema`, `@colyseus/tools`, and a `serve` target via `tsx`.
**Where**: `server/` (`project.json`, `server/src/`, deps in root/project).
**Depends on**: T1
**Reuses**: Nx workspace from T1
**Requirement**: FND-01

**Tools**: MCP: `user-context7` (verify Colyseus 0.17 bootstrap API) · Skill: `tlc-spec-driven`

**Done when**:
- [ ] `server` project builds (`nx build server`)
- [ ] Dependencies installed at locked versions
- [ ] Gate check passes: `nx build server`

**Tests**: none · **Gate**: build
**Commit**: `chore(server): scaffold @nx/node colyseus project`

---

### T3: Scaffold `client` project `[infra]` `[P]`

**What**: Create the `@nx/vite` `client` project (Vite 8) with `three` and
`@colyseus/sdk`; Vitest configured.
**Where**: `client/` (`project.json`, `client/src/`, `index.html`).
**Depends on**: T1
**Reuses**: Nx workspace from T1
**Requirement**: FND-01

**Tools**: MCP: `user-context7` (Vite 8 + @nx/vite) · Skill: `tlc-spec-driven`

**Done when**:
- [ ] `client` builds (`nx build client`) and `nx test client` runs (0 tests OK)
- [ ] `three` + `@colyseus/sdk` bundled by Vite (not CDN)
- [ ] Gate check passes: `nx build client`

**Tests**: none · **Gate**: build
**Commit**: `chore(client): scaffold @nx/vite three + sdk project`

---

### T4: Scaffold `client-e2e` + root `npm run dev` `[infra]`

**What**: Create the `@nx/playwright` `client-e2e` project with a `webServer`
config that boots server + client, and add a root `dev` script that runs both
concurrently.
**Where**: `client-e2e/` (`playwright.config.ts`), root `package.json` `scripts.dev`.
**Depends on**: T2, T3
**Reuses**: server (T2) + client (T3) serve targets
**Requirement**: FND-02

**Tools**: MCP: `user-context7` (@nx/playwright, Playwright 1.61 webServer) · Skill: `tlc-spec-driven`

**Done when**:
- [ ] `npm run dev` starts server + client concurrently (manual boot check)
- [ ] `nx e2e client-e2e` runs (0 specs OK) with webServer launching the app
- [ ] Gate check passes: `nx run-many -t build lint`

**Tests**: none (config/scaffold; first e2e spec lands in T12) · **Gate**: build
**Commit**: `chore(e2e): scaffold playwright project + npm run dev`

---

### T5: TownRoom stub + schema `[server]` `[P]`

**What**: Implement `TownRoom` (onJoin/onLeave) with `TownState { players:
MapSchema<PlayerState{x,y,z}> }` and register it as `"town"` via `@colyseus/tools`;
add the server entrypoint.
**Where**: `server/src/rooms/TownRoom.ts`, `server/src/rooms/schema/*.ts`,
`server/src/app.config.ts`, `server/src/index.ts`.
**Depends on**: T2
**Reuses**: colyseus deps from T2
**Requirement**: FND-03

**Tools**: MCP: `user-context7` (@colyseus/testing, schema 4) · Skill: `tlc-spec-driven`

**Done when**:
- [ ] A client can join `"town"`; player added to state; leave removes it
- [ ] `PlayerState` reserves `{x,y,z}` for Phase-3 authority (no movement msgs handled)
- [ ] Room-integration tests pass (join adds player, leave removes, state present)
- [ ] Gate check passes: `nx test server`
- [ ] Test count: ≥3 tests pass (no silent deletions)

**Tests**: room integration · **Gate**: quick
**Commit**: `feat(server): add TownRoom stub with join/leave and player schema`

---

### T6: Drizzle schema + DB client `[infra]` `[P]`

**What**: Define Drizzle tables `monsters`, `npcs`, `skills`, `experience`
(fields per design data models) + `getDb(path)` client + `drizzle.config.ts`.
**Where**: `server/src/db/schema.ts`, `server/src/db/client.ts`, `server/drizzle.config.ts`.
**Depends on**: T2
**Reuses**: server project from T2
**Requirement**: SEED-01..04 (schema substrate)

**Tools**: MCP: `user-context7` (Drizzle 0.45 + better-sqlite3 12) · Skill: `tlc-spec-driven`

**Done when**:
- [ ] Four tables defined matching design data models; types exported
- [ ] `getDb` opens a SQLite DB and applies the schema (migrate/push)
- [ ] Gate check passes: `nx build server`

**Tests**: none (schema/entity layer — build gate; values asserted by seed tests T8–T11) · **Gate**: build
**Commit**: `feat(server): add drizzle schema for monsters, npcs, skills, experience`

---

### T7: L2J XML parsers + fixtures `[seed]`

**What**: Pure parser functions (`parseMonsters`, `parseNpcs`,
`parsePowerStrike`, `parseExperience`) using `fast-xml-parser`, with a committed
fixture subset of the real L2J XML; parsers throw a descriptive error on missing
required fields.
**Where**: `server/src/seed/parsers/*.parser.ts`, `server/src/seed/__fixtures__/*.xml`.
**Depends on**: T6
**Reuses**: table types from `db/schema.ts` (T6)
**Requirement**: SEED-06 (fail-loud); substrate for SEED-01..04

**Tools**: MCP: `user-context7` (fast-xml-parser 5.9) · Skill: `tlc-spec-driven`

**Done when**:
- [ ] Parsers return typed records from fixture XML matching authentic values
- [ ] Each parser throws naming the entity id when a required attr is missing
- [ ] Unit tests: ≥1 happy-path per parser + ≥1 missing-field throw per parser
- [ ] Gate check passes: `nx test server`
- [ ] Test count: ≥8 tests pass (no silent deletions)

**Tests**: unit · **Gate**: quick
**Commit**: `feat(seed): add L2J xml parsers with fail-loud validation`

---

### T8: Seed runner + mob seeding `[seed]`

**What**: Idempotent seed runner (`runSeed({dataDir, dbPath})` resets seeded
tables in a transaction, returns counts) that seeds the 4 TI mobs.
**Where**: `server/src/seed/seed.ts`, `server/src/seed/seeders/monsters.seeder.ts`.
**Depends on**: T7
**Reuses**: parsers (T7), Drizzle client (T6)
**Requirement**: SEED-01, SEED-05

**Tools**: MCP: NONE · Skill: `tlc-spec-driven`

**Done when**:
- [ ] Seeds Gremlin(20001/lvl1/exp44), Bearded Keltir(20481/lvl1/exp44),
      Wolf(20120/lvl4/exp176), Goblin(20003/lvl5/exp220) with hp/mp/race values
- [ ] Re-running `runSeed` yields an identical DB (idempotent)
- [ ] Seed/data tests assert each mob's authentic values + idempotency, against a fresh temp DB
- [ ] Gate check passes: `nx test server`
- [ ] Test count: ≥5 tests pass (no silent deletions)

**Tests**: seed/data · **Gate**: quick
**Commit**: `feat(seed): seed 4 Talking Island mobs with idempotent runner`

---

### T9: NPC seeding `[seed]`

**What**: Add NPC seeder for Katerina (Grocer, 30004) and Roxxy (Gatekeeper,
30006); register in the runner.
**Where**: `server/src/seed/seeders/npcs.seeder.ts`, `server/src/seed/seed.ts` (register).
**Depends on**: T8
**Reuses**: runner (T8), npc parser (T7)
**Requirement**: SEED-02

**Tools**: MCP: NONE · Skill: `tlc-spec-driven`

**Done when**:
- [ ] Seeds Katerina(30004, "Grocer", Merchant) and Roxxy(30006, "Gatekeeper", Teleporter)
- [ ] Seed/data tests assert both NPC rows against a fresh temp DB
- [ ] Gate check passes: `nx test server`
- [ ] Test count: ≥2 tests pass (no silent deletions)

**Tests**: seed/data · **Gate**: quick
**Commit**: `feat(seed): seed Talking Island merchant and gatekeeper NPCs`

---

### T10: Power Strike skill seeding `[seed]`

**What**: Add skill seeder for Power Strike; register in the runner.
**Where**: `server/src/seed/seeders/skills.seeder.ts`, `server/src/seed/seed.ts` (register).
**Depends on**: T9
**Reuses**: runner (T8), skill parser (T7)
**Requirement**: SEED-03

**Tools**: MCP: NONE · Skill: `tlc-spec-driven`

**Done when**:
- [ ] Seeds Power Strike (id 3, "Power Strike", maxLevel 9, mpConsumeL1 9,
      reuseDelay 3000, operateType A1, targetType ENEMY, castRange 40)
- [ ] Seed/data test asserts the skill row against a fresh temp DB
- [ ] Gate check passes: `nx test server`
- [ ] Test count: ≥1 test passes (no silent deletions)

**Tests**: seed/data · **Gate**: quick
**Commit**: `feat(seed): seed Power Strike skill definition`

---

### T11: XP/level curve seeding `[seed]`

**What**: Add experience seeder for the full Classic curve; register in the runner.
**Where**: `server/src/seed/seeders/experience.seeder.ts`, `server/src/seed/seed.ts` (register).
**Depends on**: T10
**Reuses**: runner (T8), experience parser (T7)
**Requirement**: SEED-04

**Tools**: MCP: NONE · Skill: `tlc-spec-driven`

**Done when**:
- [ ] Seeds the experience table where xpToNextLevel L2=68, L3=364, L10=48230, maxLevel row present
- [ ] Seed/data test asserts the spot values + row count against a fresh temp DB
- [ ] Gate check passes: `nx test server`
- [ ] Test count: ≥1 test passes (no silent deletions)

**Tests**: seed/data · **Gate**: quick
**Commit**: `feat(seed): seed Classic XP level curve`

---

### T12: Client boot + net connect + test hook `[client]`

**What**: Client boots, connects to `"town"` via `@colyseus/sdk`, and publishes
`window.__GAME_STATE__ = { connected, ready, player }`; add a Phase-1 Playwright
connect smoke.
**Where**: `client/src/main.ts`, `client/src/net/room.ts`, `client/src/test-hook.ts`,
`client-e2e/src/connect.spec.ts`.
**Depends on**: T4, T5
**Reuses**: e2e webServer (T4), TownRoom (T5), sdk (T3)
**Requirement**: FND-04

**Tools**: MCP: `user-context7` (@colyseus/sdk 0.17) · Skill: `tlc-spec-driven`

**Done when**:
- [ ] On load the client joins `"town"` and sets `__GAME_STATE__.connected=true`
- [ ] On connection failure the page still loads with `connected=false` (no crash)
- [ ] e2e smoke asserts the page loads and `__GAME_STATE__.connected === true`
- [ ] Gate check passes: `nx test server && nx test client && nx e2e client-e2e`
- [ ] Test count: ≥1 e2e test passes (no silent deletions)

**Tests**: e2e · **Gate**: full
**Commit**: `feat(client): connect to TownRoom and publish game-state hook`

---

### T13: Procedural low-poly terrain `[client]`

**What**: Pure terrain generator (`generateTerrain(seed,opts)` →
vertices/indices/heights + `sampleHeight(x,z)`) and a flat-shaded mesh builder.
**Where**: `client/src/scene/terrain.ts`.
**Depends on**: T12
**Reuses**: n/a
**Requirement**: WLD-01, WLD-04 (determinism)

**Tools**: MCP: `user-context7` (three 0.185 flatShading/geometry) · Skill: `tlc-spec-driven`

**Done when**:
- [ ] `generateTerrain` is pure and deterministic for a given seed
- [ ] `sampleHeight` returns expected heights at known points; flat shading configured
- [ ] Unit tests: deterministic output (same seed → identical), `sampleHeight` correctness
- [ ] Gate check passes: `nx test client`
- [ ] Test count: ≥3 tests pass (no silent deletions)

**Tests**: unit · **Gate**: quick
**Commit**: `feat(client): add deterministic low-poly heightmap terrain`

---

### T14: Village builder `[client]` `[P]`

**What**: `buildVillage(opts)` returning placement specs for a ground patch, 5
low-poly buildings, and a peace-zone marker.
**Where**: `client/src/scene/village.ts`.
**Depends on**: T13
**Reuses**: terrain `sampleHeight` (T13)
**Requirement**: WLD-02

**Tools**: MCP: NONE · Skill: `tlc-spec-driven`

**Done when**:
- [ ] Returns exactly 5 buildings + 1 ground patch + 1 peace-zone marker spec
- [ ] Building/marker positions are deterministic and sit on terrain height
- [ ] Unit tests assert counts + deterministic placement
- [ ] Gate check passes: `nx test client`
- [ ] Test count: ≥2 tests pass (no silent deletions)

**Tests**: unit · **Gate**: quick
**Commit**: `feat(client): build low-poly village with peace-zone marker`

---

### T15: Scatter props + field `[client]` `[P]`

**What**: `scatterProps(seed, terrain, opts)` deterministically placing trees and
rocks across the surrounding field via injected seeded RNG.
**Where**: `client/src/scene/scatter.ts`.
**Depends on**: T13
**Reuses**: terrain `sampleHeight` (T13)
**Requirement**: WLD-03, WLD-04 (determinism)

**Tools**: MCP: NONE · Skill: `tlc-spec-driven`

**Done when**:
- [ ] Same seed → identical prop set (count + positions); props rest on terrain
- [ ] Props avoid the village ground patch (field/surround placement)
- [ ] Unit tests assert determinism + village-exclusion via injected seeded RNG
- [ ] Gate check passes: `nx test client`
- [ ] Test count: ≥2 tests pass (no silent deletions)

**Tests**: unit · **Gate**: quick
**Commit**: `feat(client): scatter trees and rocks across the field`

---

### T16: Movement system (pure) `[client]` `[P]`

**What**: Pure `step(state, intent, dt, speed)` advancing the player toward the
target, stopping within epsilon — the Phase-3-migratable core (no three/DOM).
**Where**: `client/src/movement/movement-system.ts`.
**Depends on**: T13
**Reuses**: shared move types
**Requirement**: MOVE-02, MOVE-05 (no-target/ignore-null)

**Tools**: MCP: NONE · Skill: `tlc-spec-driven`

**Done when**:
- [ ] Advances toward target at fixed speed; stops within epsilon; no-op at target
- [ ] `null` intent leaves state unchanged; no NaN
- [ ] Imports nothing from three/DOM/sdk (migration boundary)
- [ ] Unit tests cover advance, arrival epsilon, null-intent, already-at-target
- [ ] Gate check passes: `nx test client`
- [ ] Test count: ≥4 tests pass (no silent deletions)

**Tests**: unit · **Gate**: quick
**Commit**: `feat(client): add pure movement system (server-migratable)`

---

### T17: Click-to-move raycast intent `[client]`

**What**: `raycastGround(ev, camera, terrainMesh)` mapping a screen click to a
world `{x,z}` (or `null` on miss) and producing a `MovementIntent`.
**Where**: `client/src/input/click-to-move.ts`.
**Depends on**: T13, T16
**Reuses**: terrain mesh (T13), `MovementIntent` type (T16)
**Requirement**: MOVE-01, MOVE-05

**Tools**: MCP: `user-context7` (three Raycaster 0.185) · Skill: `tlc-spec-driven`

**Done when**:
- [ ] A hit produces an intent at the hit world position
- [ ] A miss returns `null` and yields no intent (target unchanged)
- [ ] Unit tests assert hit→intent and miss→null with an injected camera/ray
- [ ] Gate check passes: `nx test client`
- [ ] Test count: ≥2 tests pass (no silent deletions)

**Tests**: unit · **Gate**: quick
**Commit**: `feat(client): map ground clicks to movement intents`

---

### T18: L2-style follow camera `[client]` `[P]`

**What**: `computeCameraPosition(playerPos, offset)` (pure) + `applyTo(camera,
playerPos)` keeping the player framed at a fixed offset/height.
**Where**: `client/src/camera/follow-camera.ts`.
**Depends on**: T16
**Reuses**: player state shape (T16)
**Requirement**: MOVE-03

**Tools**: MCP: `user-context7` (three Camera) · Skill: `tlc-spec-driven`

**Done when**:
- [ ] `computeCameraPosition` returns player + offset; pure/deterministic
- [ ] Camera stays at fixed offset as player position changes
- [ ] Unit tests assert offset math across several player positions
- [ ] Gate check passes: `nx test client`
- [ ] Test count: ≥2 tests pass (no silent deletions)

**Tests**: unit · **Gate**: quick
**Commit**: `feat(client): add L2-style follow camera`

---

### T19: Assemble render loop + movement smoke `[client]`

**What**: Wire terrain + village + scatter + input + movement + camera + hook
into the render loop, and add the Playwright movement smoke (boot, canvas mount,
click moves player via `window.__GAME_STATE__`).
**Where**: `client/src/scene/renderer.ts`, `client/src/main.ts` (wire),
`client-e2e/src/smoke.spec.ts`.
**Depends on**: T14, T15, T17, T18
**Reuses**: all Phase-2 modules + the test hook (T12)
**Requirement**: WLD-01..04, MOVE-01..04, E2E-01, E2E-02

**Tools**: MCP: `user-playwright` (drive the smoke), `user-context7` (three render loop) · Skill: `tlc-spec-driven`

**Done when**:
- [ ] Scene renders terrain + village (5 buildings + marker) + scatter; canvas mounts
- [ ] Per-frame loop calls movement `step` and updates camera + `__GAME_STATE__.player`
- [ ] e2e: canvas mounted + `connected===true`; a ground click changes `__GAME_STATE__.player` from its initial value
- [ ] Gate check passes: `nx test server && nx test client && nx e2e client-e2e`
- [ ] Test count: ≥2 e2e tests pass (no silent deletions)

**Tests**: e2e · **Gate**: full
**Commit**: `feat(client): assemble world render loop with click-to-move smoke`

---

## Parallel Execution Map

```
Phase 1 (Foundation):
  T1
   ├──→ T2 ──┬──→ T5 [P]  } parallel after T2
   │         └──→ T6 [P]  }
   └──→ T3 [P]            (T2, T3 parallel after T1)
  T2, T3 ──→ T4
  T6 ──→ T7 ──→ T8 ──→ T9 ──→ T10 ──→ T11   (seed chain, sequential — shared runner file)
  T4, T5 ──→ T12

Phase 2 (World):
  T12 ──→ T13
  T13 ──┬──→ T14 [P]
        ├──→ T15 [P]   } order-free after T13
        └──→ T16 [P]
  T16 ──┬──→ T17        (T17 also needs T13)
        └──→ T18 [P]    } T17, T18 order-free w.r.t. each other
  T14, T15, T17, T18 ──→ T19
```

**Parallelism constraint:** A `[P]` task has no unfinished deps, a parallel-safe
test type, and no shared mutable state with other `[P]` tasks in the phase. The
seed chain (T8→T11) is intentionally sequential because the tasks edit the shared
`seed.ts` runner registration. `[P]` is ordering info, not a directive to spawn a
sub-agent per task. With 2 phases, execution is inline (no per-phase workers).

---

## Task Granularity Check

| Task | Scope | Status |
| ---- | ----- | ------ |
| T1: Nx workspace init | 1 config set | ✅ Granular |
| T2: server scaffold | 1 project | ✅ Granular |
| T3: client scaffold | 1 project | ✅ Granular |
| T4: e2e scaffold + dev script | 1 project + 1 script | ✅ Granular |
| T5: TownRoom + schema | 1 room + its schema (cohesive) | ✅ Granular |
| T6: Drizzle schema + client | schema + thin client (cohesive) | ✅ Granular |
| T7: XML parsers + fixtures | 1 parser module set (cohesive) | ✅ Granular |
| T8: runner + mob seeder | 1 runner + 1 seeder (cohesive) | ✅ Granular |
| T9: NPC seeder | 1 seeder | ✅ Granular |
| T10: skill seeder | 1 seeder | ✅ Granular |
| T11: experience seeder | 1 seeder | ✅ Granular |
| T12: boot + net + hook | 1 client boot path (cohesive) | ✅ Granular |
| T13: terrain | 1 module | ✅ Granular |
| T14: village | 1 module | ✅ Granular |
| T15: scatter | 1 module | ✅ Granular |
| T16: movement system | 1 module | ✅ Granular |
| T17: click-to-move | 1 module | ✅ Granular |
| T18: follow camera | 1 module | ✅ Granular |
| T19: assemble + smoke | render-loop wiring + smoke (cohesive) | ✅ Granular |

---

## Diagram-Definition Cross-Check

| Task | Depends On (body) | Diagram Shows | Status |
| ---- | ----------------- | ------------- | ------ |
| T1 | None | (root) | ✅ Match |
| T2 | T1 | T1→T2 | ✅ Match |
| T3 | T1 | T1→T3 | ✅ Match |
| T4 | T2, T3 | T2,T3→T4 | ✅ Match |
| T5 | T2 | T2→T5 | ✅ Match |
| T6 | T2 | T2→T6 | ✅ Match |
| T7 | T6 | T6→T7 | ✅ Match |
| T8 | T7 | T7→T8 | ✅ Match |
| T9 | T8 | T8→T9 | ✅ Match |
| T10 | T9 | T9→T10 | ✅ Match |
| T11 | T10 | T10→T11 | ✅ Match |
| T12 | T4, T5 | T4,T5→T12 | ✅ Match |
| T13 | T12 | T12→T13 | ✅ Match |
| T14 | T13 | T13→T14 | ✅ Match |
| T15 | T13 | T13→T15 | ✅ Match |
| T16 | T13 | T13→T16 | ✅ Match |
| T17 | T13, T16 | T13→T17, T16→T17 | ✅ Match |
| T18 | T16 | T16→T18 | ✅ Match |
| T19 | T14, T15, T17, T18 | T14,T15,T17,T18→T19 | ✅ Match |

All `[P]` tasks are mutually independent: {T3} vs {T2-subtree timing}; {T5,T6}
share only T2 (not each other); {T14,T15,T16} share only T13; {T17,T18} share
only T16 and do not depend on each other. ✅

---

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| ---- | --------------------------- | --------------- | --------- | ------ |
| T1 | Nx config | none | none | ✅ OK |
| T2 | scaffold/config | none | none | ✅ OK |
| T3 | scaffold/config | none | none | ✅ OK |
| T4 | scaffold/config + dev script | none | none | ✅ OK |
| T5 | Colyseus room | room integration | room integration | ✅ OK |
| T6 | Drizzle schema/entity | none (build gate) | none | ✅ OK |
| T7 | pure parsers | unit | unit | ✅ OK |
| T8 | seed → SQLite | seed/data | seed/data | ✅ OK |
| T9 | seed → SQLite | seed/data | seed/data | ✅ OK |
| T10 | seed → SQLite | seed/data | seed/data | ✅ OK |
| T11 | seed → SQLite | seed/data | seed/data | ✅ OK |
| T12 | client app/integration | e2e | e2e | ✅ OK |
| T13 | pure logic (terrain) | unit | unit | ✅ OK |
| T14 | pure logic (village) | unit | unit | ✅ OK |
| T15 | pure logic (scatter) | unit | unit | ✅ OK |
| T16 | pure logic (movement) | unit | unit | ✅ OK |
| T17 | pure logic (input map) | unit | unit | ✅ OK |
| T18 | pure logic (camera) | unit | unit | ✅ OK |
| T19 | client world integration | e2e | e2e | ✅ OK |

**Notes:** T6 (schema) is "none" per matrix — its values are proven by the seed
tests T8–T11, but those tests target the *seed* layer (writing+reading rows), not
deferred schema tests, so this is not test deferral. T12 and T19 each create
client-app/world behavior whose required layer is e2e, and each includes its own
e2e spec — no e2e is deferred to a later task. ✅ No violations.

---

## Tools (MCPs & Skills) summary

- **Skill (all tasks):** `tlc-spec-driven` (Execute flow), wrapped by the project
  `spec-driven-execution` orchestration.
- **`user-context7`:** version-correct API lookups for Colyseus 0.17, Drizzle
  0.45 / better-sqlite3 12, fast-xml-parser 5.9, three 0.185, Vite 8 / @nx
  plugins, Playwright 1.61.
- **`user-playwright`:** drive/inspect the e2e smoke (T19; T12 connect smoke).
- No other MCPs required. Randomness (scatter) uses an **injected seeded RNG**
  per AGENTS.md determinism rule.
