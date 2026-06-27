# Phase 4 — Combat on the Server Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and
follow its Execute flow and Critical Rules.** Do not search for skill files by
filesystem path. This repo wraps it with `spec-driven-execution` (Planner →
Implementer → Verifier, **autonomous-first**); honor server-authority (AD-001)
and the four test layers (AD-010).

**If the skill cannot be activated, STOP and tell the user — do not proceed
without it.**

---

**Design**: `.specs/features/phase-4-server-combat/design.md`
**Status**: Done

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec — confirm before Execute.
> Guidelines found: `AGENTS.md` (4 test layers + server-authority + seeded RNG),
> `.cursor/skills/spec-driven-execution/SKILL.md` (test gate table),
> `AD-010` (gate commands), `AD-011` (temp DB per seed test).

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| Pure combat logic (RNG, damage, timing, range, XP, drops) | unit | All branches; 1:1 to P4-R01–R04,R12–R14; exact L2J anchors (17, 15, 1666, 3.9/4.0/4.1, 44, 88, 57/22) | `libs/game-core/src/**/*.spec.ts` | `nx test game-core` |
| Drizzle combat schema (`mob_drops`, `mob_spawns`, monster cols) | unit | Round-trip insert/select; column presence | `server/src/db/schema.spec.ts` | `nx test server` |
| L2J parsers + seeders (monsters, drops, spawns) | seed | Authentic Classic values; idempotent re-seed row content | `server/src/seed/**/*.spec.ts` | `nx test server` |
| Spawn manager, mob AI, combat resolver | unit | 1:1 to P4-R07–R10,R14; aggro 45, retaliate, wander | `server/src/rooms/{spawn-manager,mob-ai,combat-resolver}.spec.ts` | `nx test server` |
| TownRoom combat integration | room-integration (`@colyseus/testing`) | P4-R05,R11–R16; in-memory/temp DB; injectable `nowMs`/`combatRng` | `server/src/rooms/TownRoom.spec.ts` | `nx test server` |
| Client mob render + test hook | unit | HP bar from server snapshot; hook fields not locally mutated | `client/src/scene/mobs.spec.ts`, `client/src/test-hook.spec.ts` | `nx test client` |
| Combat player loop | e2e (Playwright) | Kill grants `player.xp > 0` via `__GAME_STATE__` | `client-e2e/src/combat.spec.ts` | `nx e2e client-e2e` |
| Schema-only / CLI scaffold | none | Build + lint gate | — | `nx run-many -t build lint` |

**Coverage Expectation provenance:** AGENTS.md Phase 4 emphasis = unit +
room-integration dominant; seed for L2J values; Playwright for kill/XP path
(AD-009). Listed edge cases are spec-noted but room tests deferred (validation
gap).

## Parallelism Assessment

> Generated from codebase — confirm before Execute.

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
| --------- | -------------- | --------------- | -------- |
| unit (game-core) | Yes | Pure functions; no shared state | `libs/game-core/src/*.spec.ts` |
| unit + seed (server) | Yes | Temp DB per test (`mkdtempSync`); AD-011 | `server/src/seed/**/*.spec.ts`, `schema.spec.ts` |
| room-integration | Yes | `@colyseus/testing` `boot()` per suite; inject `:memory:`/`mkdtemp` DB | `TownRoom.spec.ts` `seededCombatDb()` |
| e2e (Playwright) | No | Shared dev server + single `town` room; `workers: 1` | `client-e2e/playwright.config.ts` |

## Gate Check Commands

> Generated from codebase — confirm before Execute.

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick (game-core) | After T1–T4 | `nx test game-core` |
| Quick (server) | After T5–T14 | `nx test server` |
| Quick (client) | After T15 | `nx test client` |
| Full | After T16 / phase completion | `nx affected -t test lint --base=f5ba027` and `nx e2e client-e2e` |
| Build | After schema-only tasks | `nx run-many -t build lint` |

> **Verifier (independent):** `nx affected -t test lint --base=f5ba027` +
> `nx e2e client-e2e`; discrimination sensor on combat mutants.

---

## Execution Plan

**4 phases** (16 tasks; verified @ `0c1d5c7`).

### Phase 1: game-core combat primitives (Sequential + parallel roots)

```
     ┌──→ T2
T1 ──┼──→ T4
     └──
T3 (parallel root) [P]
```

### Phase 2: Seed + schema (Parallel after roots)

```
T5 ──┐
T6 ──┼──→ T7 ──→ T8
     └──→ T9 [P]
```

### Phase 3: Server combat modules (Sequential)

```
T10 ──→ T11 ──→ T12 ──→ T13 ──→ T14
```

### Phase 4: Client + E2E (Sequential)

```
T14 ──→ T15 ──→ T16
```

---

## Task Breakdown

### T1: Add seeded RNG for deterministic combat rolls `[game-core]`

**What**: Implement `createSeededRng` with `nextFloat`, `nextInt`, and `nextDamageOffset`.
**Where**: `libs/game-core/src/seeded-rng.ts` (+ `seeded-rng.spec.ts`), export from `index.ts`
**Depends on**: None
**Reuses**: LCG pattern (numerical recipes); AD-010 injected RNG contract
**Requirement**: P4-R01

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Same seed replays identical `nextFloat` sequence
- [ ] `nextDamageOffset(10)` stays within ±10 inclusive
- [ ] Mixed-call sequence is deterministic across `nextFloat`/`nextInt`/`nextDamageOffset`
- [ ] Gate check passes: `nx test game-core`
- [ ] Test count: **7** tests pass in `seeded-rng.spec.ts` (no silent deletions)

**Tests**: unit
**Gate**: quick (game-core)

**Commit**: `feat(game-core): add seeded RNG for deterministic combat rolls`

---

### T2: Add L2J melee damage, attack timing, and range formulas `[game-core]`

**What**: Add `calcMeleeDamage`, `calculateAttackIntervalMs`, `isInMeleeRange`, and `STARTER_COMBAT` / `GREMLIN_COMBAT` constants.
**Where**: `libs/game-core/src/combat/melee-damage.ts`, `attack-timing.ts`, `combat-range.ts`, `starter-combat.ts` (+ specs)
**Depends on**: T1
**Reuses**: `MELEE_WEAPON_MODIFIER=77`; L2J `Formulas.calcPhysDam` / `getAttackInterval`
**Requirement**: P4-R02, P4-R03, P4-R04

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Starter vs Gremlin: damage **17** (offset 0), **15** (offset −10)
- [ ] `calculateAttackIntervalMs(300)` === **1666**
- [ ] Range 3.9/4.0/4.1 @ meleeRange 4.0 → true/true/false
- [ ] Gate check passes: `nx test game-core`
- [ ] Test count: **13** new combat formula tests pass (no silent deletions)

**Tests**: unit
**Gate**: quick (game-core)

**Commit**: `feat(game-core): add L2J melee damage and attack timing formulas`

---

### T3: Add cumulative XP grant and level-up helper `[game-core]` `[P]`

**What**: Implement `grantXp(currentLevel, currentXp, addXp, curve)` using cumulative thresholds.
**Where**: `libs/game-core/src/experience.ts` (+ `experience.spec.ts`)
**Depends on**: None
**Reuses**: `ExperienceCurveRow` shape from seeded `experience` table
**Requirement**: P4-R12, P4-R13

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] `grantXp(1,0,44)` → `{ level:1, xp:44 }`
- [ ] `grantXp(1,44,44)` → `{ level:2, xp:88 }`
- [ ] Multi-level jump and zero-grant edge cases covered
- [ ] Gate check passes: `nx test game-core`
- [ ] Test count: **6** tests pass in `experience.spec.ts`

**Tests**: unit
**Gate**: quick (game-core)

**Commit**: `feat(game-core): add cumulative XP grant and level-up helper`

---

### T4: Add seeded mob drop roll resolver `[game-core]`

**What**: Implement `rollDrops(dropRows, rng)` with L2J percentage chance and count range.
**Where**: `libs/game-core/src/drop-roll.ts` (+ `drop-roll.spec.ts`); `GOBLIN_ADENA_DROP_SEED=150338`
**Depends on**: T1
**Reuses**: `SeededRng` from T1; Goblin adena row constants
**Requirement**: P4-R14

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Seed **150338** + Goblin row → `[{ itemId:57, count:22 }]`
- [ ] Failed chance roll returns `[]` without calling `nextInt`
- [ ] Gate check passes: `nx test game-core`
- [ ] Test count: **4** tests pass in `drop-roll.spec.ts`; **37** total game-core tests green

**Tests**: unit
**Gate**: quick (game-core)

**Commit**: `feat(game-core): add seeded mob drop roll resolver`

---

### T5: Extend monster parser with L2J combat stats `[server]` `[P]`

**What**: Parse combat columns from L2J `monsters.xml` fixture (`pAtk`, `pDef`, `attackSpeed`, `random`, ranges, aggro, `isAggressive`).
**Where**: `server/src/seed/parsers/monsters.parser.ts`, `server/src/seed/parsers/parsers.spec.ts`
**Depends on**: None
**Reuses**: Existing monster parser from Phase 1 seed; `DEFAULT_RESPAWN_SEC=27`
**Requirement**: P4-R17

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Gremlin parses with `exp:44`, `pDef≈44.44`, passive aggro
- [ ] Goblin parses `isAggressive:true`, `aggroRange:450`
- [ ] Gate check passes: `nx test server`
- [ ] Test count: parser combat assertions pass in `parsers.spec.ts`

**Tests**: seed
**Gate**: quick (server)

**Commit**: `feat(seed): extend monster parser with combat stats`

---

### T6: Add combat mob drops and spawn schema `[server]` `[P]`

**What**: Add `mob_drops` and `mob_spawns` Drizzle tables; extend `monsters` combat columns; `applySchema()` migrations.
**Where**: `server/src/db/schema.ts`, `server/src/db/client.ts`, `server/src/db/schema.spec.ts`
**Depends on**: None
**Reuses**: Existing Drizzle table patterns; `mob_drops`/`mob_spawns` per phase-4-server-combat (not `items` FK)
**Requirement**: P4-R17

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] `mob_drops`, `mob_spawns` tables created with documented columns
- [ ] `monsters` exposes combat stat columns used by spawn manager
- [ ] Gate check passes: `nx test server`
- [ ] Test count: schema round-trip tests pass in `schema.spec.ts`

**Tests**: unit
**Gate**: quick (server)

**Commit**: `feat(server): add combat mob drops and spawn schema`

---

### T7: Parse and seed monster combat stats `[server]`

**What**: Seeder upserts full combat `monsters` rows from parsed fixture XML.
**Where**: `server/src/seed/seeders/monsters.seeder.ts` (+ `monsters.seeder.spec.ts`), wire in `seed.ts`
**Depends on**: T5, T6
**Reuses**: `runSeed` idempotent transaction; `FIXTURE_DATA_DIR` (AD-012)
**Requirement**: P4-R17

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Gremlin row matches authentic L2J values (`exp:44`, `hp:41.145`, etc.)
- [ ] Goblin aggressive + `aggroRange:450` seeded
- [ ] Re-seed is idempotent on row content
- [ ] Gate check passes: `nx test server`
- [ ] Test count: `monsters.seeder.spec.ts` assertions pass

**Tests**: seed
**Gate**: quick (server)

**Commit**: `feat(seed): parse and seed monster combat stats`

---

### T8: Parse and seed mob drop tables `[server]`

**What**: Parser + seeder for `mob_drops` from L2J drop XML fixtures.
**Where**: `server/src/seed/parsers/drops.parser.ts`, `server/src/seed/seeders/drops.seeder.ts` (+ specs), `seed.ts`
**Depends on**: T6, T7
**Reuses**: Idempotent `runSeed`; compare rows without autoincrement `id` on re-seed (deviation logged)
**Requirement**: P4-R17, P4-R14

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Goblin adena drop row (`itemId:57`, chance 70, min 13 max 30) seeded
- [ ] Re-seed idempotent on drop content
- [ ] Gate check passes: `nx test server`
- [ ] Test count: `drops.seeder.spec.ts` passes

**Tests**: seed
**Gate**: quick (server)

**Commit**: `feat(seed): parse and seed mob drop tables`

---

### T9: Add hand-authored mob spawn points for TI field `[server]` `[P]`

**What**: Load `mob_spawns.json` fixture (11 instances); seeder with `respawnSec:27` default.
**Where**: `server/src/seed/__fixtures__/mob_spawns.json`, `parsers/spawns.parser.ts`, `seeders/spawns.seeder.ts` (+ specs)
**Depends on**: T6
**Reuses**: AD-013 local coords; AD-006 hand-authored placement
**Requirement**: P4-R07, P4-R17

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] **11** spawn rows seeded from fixture
- [ ] Every spawn has `respawnSec:27`
- [ ] Re-seed idempotent on spawn content (strip autoincrement `id`)
- [ ] Gate check passes: `nx test server`
- [ ] Test count: `spawns.seeder.spec.ts` passes

**Tests**: seed
**Gate**: quick (server)

**Commit**: `feat(seed): add hand-authored mob spawn points for TI field`

---

### T10: Add MobState schema to TownState `[server]`

**What**: Create `MobState` Colyseus schema; add `mobs` `MapSchema` to `TownState`.
**Where**: `server/src/rooms/schema/MobState.ts`, `server/src/rooms/schema/TownState.ts`
**Depends on**: T6
**Reuses**: `PlayerState` / `MapSchema` patterns from Phase 3
**Requirement**: P4-R06

**Tools**:

- MCP: `context7` (Colyseus `@colyseus/schema` map types)
- Skill: NONE

**Done when**:

- [ ] `MobState` syncs `id`, `npcId`, `x`, `y`, `z`, `hp`, `maxHp`
- [ ] `TownState.mobs` is a typed `MapSchema<MobState>`
- [ ] Gate check passes: `nx test server`
- [ ] Test count: existing room tests still pass

**Tests**: room-integration
**Gate**: quick (server)

**Commit**: `feat(server): add MobState schema to TownState`

---

### T11: Add mob spawn manager for TownRoom `[server]`

**What**: `initializeMobs`, `syncMobState`, `respawnMobRuntime`, `l2RangeToWorld`; build `MobRuntime` private map.
**Where**: `server/src/rooms/spawn-manager.ts` (+ `spawn-manager.spec.ts`)
**Depends on**: T7, T9, T10
**Reuses**: Drizzle `monsters` + `mob_spawns`; AD-013 `÷10` range conversion
**Requirement**: P4-R07

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] `initializeMobs` creates runtime + schema for all spawn rows
- [ ] Goblin `aggroRangeWorld` === **45**; `respawnSec` === **27**
- [ ] Gate check passes: `nx test server`
- [ ] Test count: **4** tests pass in `spawn-manager.spec.ts`

**Tests**: unit
**Gate**: quick (server)

**Commit**: `feat(server): add mob spawn manager for TownRoom`

---

### T12: Add mob aggro, retaliate, and wander AI `[server]`

**What**: `tickMobAi` — aggressive acquisition, passive retaliate, wander within radius 5.
**Where**: `server/src/rooms/mob-ai.ts` (+ `mob-ai.spec.ts`)
**Depends on**: T11, T1
**Reuses**: `horizontalDistance`, `DEFAULT_MOVE_SPEED` from game-core; `SeededRng` for wander
**Requirement**: P4-R08, P4-R09, P4-R10

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Aggressive mob acquires player within **45** units
- [ ] Passive mob retaliates to `lastAttackerSessionId` after damage
- [ ] Wander picks target within `WANDER_RADIUS` at `WANDER_SPEED_FACTOR`
- [ ] Gate check passes: `nx test server`
- [ ] Test count: **8** tests pass in `mob-ai.spec.ts`

**Tests**: unit
**Gate**: quick (server)

**Commit**: `feat(server): add mob aggro retaliate and wander AI`

---

### T13: Add combat resolver for player and mob attacks `[server]`

**What**: `resolvePlayerAttack`, `resolveMobAttack`, `applyKillRewards`, `PlayerCombatState`; injectable `nowMs`/`combatRng` options.
**Where**: `server/src/rooms/combat-resolver.ts` (+ `combat-resolver.spec.ts`)
**Depends on**: T1, T2, T3, T4, T11
**Reuses**: All game-core combat modules; `MobRuntime` from spawn-manager
**Requirement**: P4-R02, P4-R03, P4-R04, P4-R12, P4-R14

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] In-range player attack deals **17** damage (zero-offset RNG)
- [ ] Out-of-range attack deals **0**
- [ ] Attack interval gate enforced via `nextAttackAtMs`
- [ ] `applyKillRewards` grants XP and Goblin drops `[{itemId:57,count:22}]` with seed 150338
- [ ] Gate check passes: `nx test server`
- [ ] Test count: **9** tests pass in `combat-resolver.spec.ts`

**Tests**: unit
**Gate**: quick (server)

**Commit**: `feat(server): add combat resolver for player and mob attacks`

---

### T14: Integrate authoritative combat into TownRoom `[server]`

**What**: Wire tick combat loop, `setTarget`/`attack` handlers, kill→XP→persist→respawn, `loadCombatData`, injectable clock/RNG.
**Where**: `server/src/rooms/TownRoom.ts` (+ combat section in `TownRoom.spec.ts`)
**Depends on**: T8, T10, T11, T12, T13
**Reuses**: Phase 3 movement tick, `persistCharacter`, `experience` + `mobDrops` queries
**Requirement**: P4-R05, P4-R11, P4-R15, P4-R16

**Tools**:

- MCP: `context7` (Colyseus message handlers)
- Skill: NONE

**Done when**:

- [ ] Room boots with **11** mobs from seed
- [ ] In-range attack reduces Gremlin HP by **17**; out-of-range unchanged
- [ ] Kill grants **44** XP; second kill → level **2**, xp **88**
- [ ] XP persisted to DB on kill (`row.xp === 44`)
- [ ] Mob respawns at **27** s with hp **41.145** (injectable `nowMs`)
- [ ] Aggro at 40 units; passive retaliate after damage
- [ ] Gate check passes: `nx test server`
- [ ] Test count: **79** total server tests pass

**Tests**: room-integration
**Gate**: quick (server)

**Commit**: `feat(server): integrate authoritative combat into TownRoom`

---

### T15: Client mob render and combat intents `[client]`

**What**: Render mob capsules + HP bars from `state.mobs`; wire click target + attack to `setTarget`/`attack` messages; extend `__GAME_STATE__`.
**Where**: `client/src/scene/mobs.ts`, `client/src/scene/renderer.ts`, `client/src/net/room.ts`, `client/src/main.ts`, `client/src/test-hook.ts` (+ `mobs.spec.ts`, `test-hook.spec.ts`)
**Depends on**: T10, T14
**Reuses**: Phase 3 room wiring; AD-005 procedural meshes; AD-009 test hooks
**Requirement**: P4-R18, P4-R19, P4-R05

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Mobs appear/disappear on schema add/remove
- [ ] HP bar ratio tracks server `hp`/`maxHp` without local mutation
- [ ] `__handleMobTarget__` / `__attack__` send server intents
- [ ] `__GAME_STATE__` exposes `mobs`, `targetMobId`, `player.xp`, `player.level`
- [ ] Gate check passes: `nx test client`
- [ ] Test count: **25** total client tests pass

**Tests**: unit
**Gate**: quick (client)

**Commit**: `feat(client): render mobs with HP bars from server state` then `feat(client): wire mob target and attack intent to server`

---

### T16: E2E combat kill path + seed CLI `[client-e2e]`

**What**: Playwright combat spec (move, target, kill, assert `xp > 0`); `seed/cli.ts`; webServer seeds before serve; `workers: 1`.
**Where**: `client-e2e/src/combat.spec.ts`, `server/src/seed/cli.ts`, `client-e2e/playwright.config.ts`
**Depends on**: T9, T14, T15
**Reuses**: `runSeed` + `FIXTURE_DATA_DIR`; `__sendMoveIntent__` / `__handleMobTarget__` / `__attack__` hooks
**Requirement**: P4-R12, P4-R19

**Tools**:

- MCP: `playwright` (browser automation)
- Skill: NONE

**Done when**:

- [ ] `cli.ts` writes seeded `data/game.db` with mob spawns
- [ ] Playwright webServer runs seed before `nx serve server`
- [ ] `combat.spec.ts` kills mob and asserts `player.xp > 0`
- [ ] Gate check passes: `nx affected -t test lint --base=f5ba027` and `nx e2e client-e2e`
- [ ] Test count: **8/8** Playwright tests pass (including combat spec)

**Tests**: e2e
**Gate**: full

**Commit**: `test(client-e2e): assert kill grants XP via game state hook`

---

## Parallel Execution Map

```
Phase 1 (Sequential + parallel roots):
  T1 ──→ T2
  T1 ──→ T4
  T3 [P] (parallel with T1)

Phase 2 (Parallel after schema):
  T5 [P], T6 [P] (parallel roots)
  T6 ──→ T7 ──→ T8
  T6 ──→ T9 [P]

Phase 3 (Sequential):
  T10 ──→ T11 ──→ T12 ──→ T13 ──→ T14

Phase 4 (Sequential):
  T14 ──→ T15 ──→ T16
```

**Parallelism constraint:** `[P]` tasks have no unfinished code dependencies
and parallel-safe tests (per Parallelism Assessment). E2E (T16) is always
serial (`workers: 1`).

---

## Task Granularity Check

| Task | Scope | Status |
| ---- | ----- | ------ |
| T1: SeededRng | 1 module + spec | ✅ Granular |
| T2: Melee formulas | 4 cohesive combat files + specs | ✅ Granular (cohesive formula set) |
| T3: grantXp | 1 function + spec | ✅ Granular |
| T4: rollDrops | 1 function + spec | ✅ Granular |
| T5: Monster parser combat cols | 1 parser extension | ✅ Granular |
| T6: Schema tables | schema + applySchema | ✅ Granular |
| T7: Monsters seeder | 1 seeder + spec | ✅ Granular |
| T8: Drops seeder | parser + seeder + spec | ✅ Granular |
| T9: Spawns fixture + seeder | 1 fixture + parser + seeder | ✅ Granular |
| T10: MobState schema | 2 schema files | ✅ Granular |
| T11: Spawn manager | 1 module + spec | ✅ Granular |
| T12: Mob AI | 1 module + spec | ✅ Granular |
| T13: Combat resolver | 1 module + spec | ✅ Granular |
| T14: TownRoom integration | 1 room file + room tests | ✅ Granular |
| T15: Client render + intents | client scene/net/hook wiring | ✅ Granular (single player-loop concern) |
| T16: E2E + seed CLI | 1 e2e spec + cli + config | ✅ Granular |

All tasks atomic or cohesive single-concern → no split required.

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| ---- | ---------------------- | ------------- | ------ |
| T1 | None | root | ✅ Match |
| T2 | T1 | T1 → T2 | ✅ Match |
| T3 | None | parallel root `[P]` | ✅ Match |
| T4 | T1 | T1 → T4 | ✅ Match |
| T5 | None | parallel root `[P]` | ✅ Match |
| T6 | None | parallel root `[P]` | ✅ Match |
| T7 | T5, T6 | T5,T6 → T7 | ✅ Match |
| T8 | T6, T7 | T7 → T8 | ✅ Match |
| T9 | T6 | T6 → T9 `[P]` | ✅ Match |
| T10 | T6 | (implicit via Phase 3 chain from T6) | ✅ Match |
| T11 | T7, T9, T10 | T10 → T11 | ✅ Match |
| T12 | T11, T1 | T11 → T12 | ✅ Match |
| T13 | T1,T2,T3,T4,T11 | T12 → T13 | ✅ Match |
| T14 | T8,T10,T11,T12,T13 | T13 → T14 | ✅ Match |
| T15 | T10, T14 | T14 → T15 | ✅ Match |
| T16 | T9, T14, T15 | T15 → T16 | ✅ Match |

All `Depends on` fields reconcile with the Execution Plan arrows.

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| ---- | --------------------------- | --------------- | --------- | ------ |
| T1 | Pure combat RNG | unit | unit | ✅ OK |
| T2 | Melee formulas | unit | unit | ✅ OK |
| T3 | XP grant | unit | unit | ✅ OK |
| T4 | Drop roll | unit | unit | ✅ OK |
| T5 | Monster parser | seed | seed | ✅ OK |
| T6 | Drizzle schema | unit | unit | ✅ OK |
| T7 | Monsters seeder | seed | seed | ✅ OK |
| T8 | Drops seeder | seed | seed | ✅ OK |
| T9 | Spawns seeder | seed | seed | ✅ OK |
| T10 | MobState schema | room-integration | room-integration | ✅ OK |
| T11 | Spawn manager | unit | unit | ✅ OK |
| T12 | Mob AI | unit | unit | ✅ OK |
| T13 | Combat resolver | unit | unit | ✅ OK |
| T14 | TownRoom combat | room-integration | room-integration | ✅ OK |
| T15 | Client mob + hook | unit | unit | ✅ OK |
| T16 | E2E combat | e2e | e2e | ✅ OK |

Every task's own code is tested in the task that creates it. E2E kill
observability is proven by T16 (cannot run until T14+T15 exist), not deferred.

---

## Requirement → Task Map

| Req ID | Tasks |
| ------ | ----- |
| P4-R01 | T1 |
| P4-R02 | T2, T13, T14 |
| P4-R03 | T2, T13, T14 |
| P4-R04 | T2, T13, T14 |
| P4-R05 | T14, T15, T16 |
| P4-R06 | T10 |
| P4-R07 | T9, T11, T14 |
| P4-R08 | T12, T14 |
| P4-R09 | T12, T14 |
| P4-R10 | T12 |
| P4-R11 | T14 |
| P4-R12 | T3, T13, T14, T16 |
| P4-R13 | T3, T14 |
| P4-R14 | T4, T8, T13 |
| P4-R15 | T14 |
| P4-R16 | T14 |
| P4-R17 | T5, T6, T7, T8, T9 |
| P4-R18 | T15 |
| P4-R19 | T15, T16 |

---

## Ordered Task Summary

| # | Task | Layer | Test layer | Gate | Deps | Status |
| - | ---- | ----- | ---------- | ---- | ---- | ------ |
| T1 | Seeded RNG | game-core | unit | quick | — | Done |
| T2 | L2J melee formulas | game-core | unit | quick | T1 | Done |
| T3 | XP grant + level-up | game-core | unit | quick | — `[P]` | Done |
| T4 | Drop roll | game-core | unit | quick | T1 | Done |
| T5 | Monster parser combat | server/seed | seed | quick | — `[P]` | Done |
| T6 | Combat schema | server/db | unit | quick | — `[P]` | Done |
| T7 | Monsters seeder | server/seed | seed | quick | T5,T6 | Done |
| T8 | Drops seeder | server/seed | seed | quick | T6,T7 | Done |
| T9 | Mob spawns fixture | server/seed | seed | quick | T6 `[P]` | Done |
| T10 | MobState schema | server | room-integration | quick | T6 | Done |
| T11 | Spawn manager | server | unit | quick | T7,T9,T10 | Done |
| T12 | Mob AI | server | unit | quick | T11,T1 | Done |
| T13 | Combat resolver | server | unit | quick | T1–T4,T11 | Done |
| T14 | TownRoom combat | server | room-integration | quick | T8,T10–T13 | Done |
| T15 | Client mobs + intents | client | unit | quick | T10,T14 | Done |
| T16 | E2E combat + seed CLI | client-e2e | e2e | full | T9,T14,T15 | Done |
