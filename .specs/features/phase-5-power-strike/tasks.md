# Phase 5 — Power Strike Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and
follow its Execute flow and Critical Rules.** Do not search for skill files by
filesystem path. This repo wraps it with `spec-driven-execution` (Planner →
Implementer → Verifier, **autonomous-first**); honor server-authority (AD-001)
and the four test layers (AD-010).

**If the skill cannot be activated, STOP and tell the user — do not proceed
without it.**

---

**Design**: `.specs/features/phase-5-power-strike/design.md`
**Status**: Draft

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec — confirm before Execute.
> Guidelines found: `AGENTS.md` (4 test layers + server-authority + seeded RNG),
> `.cursor/skills/spec-driven-execution/SKILL.md` (test gate table),
> `AD-010` (gate commands), `AD-011` (temp DB per seed test).

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| Physical skill damage formula | unit | P5-R01 ACs 1–2; exact anchors 69 / 62 vs Gremlin; min 1 floor | `libs/game-core/src/**/*.spec.ts` | `nx test game-core` |
| Skills seed (`powerL1` extension) | seed | P5-R02 AC 3; `powerL1=30` + existing Power Strike columns | `server/src/seed/**/*.spec.ts` | `nx test server` |
| Skill combat resolver | unit | P5-R03–R04 resolver branches; MP/range/cooldown rejects; damage 69 | `server/src/rooms/combat-resolver.spec.ts` | `nx test server` |
| TownRoom skill integration | room-integration | P5-R03–R04 ACs 4–8 + listed edge cases; injectable `nowMs`/`combatRng` | `server/src/rooms/TownRoom.spec.ts` | `nx test server` |
| Client hooks + HUD + flash | unit | P5-R05 AC 1; P5-R07 AC 3; hook field contracts | `client/src/**/*.spec.ts` | `nx test client` |
| Power Strike player loop | e2e | P5-R06 AC 2; P5-R08 AC 4; DOM + `__GAME_STATE__` | `client-e2e/src/power-strike.spec.ts` | `nx e2e client-e2e` |
| Schema-only (`PlayerState` field) | none | Build + lint gate | — | `nx run-many -t build lint` |

## Parallelism Assessment

> Generated from codebase — confirm before Execute.

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
| --------- | -------------- | --------------- | -------- |
| unit (game-core) | Yes | Pure functions | `libs/game-core/src/*.spec.ts` |
| unit + seed (server) | Yes | Temp DB per test (`mkdtempSync`); AD-011 | `server/src/seed/**/*.spec.ts` |
| room-integration | Yes | `@colyseus/testing` `boot()` per suite; temp/in-memory DB | `TownRoom.spec.ts` `seededCombatDb()` |
| unit (client) | Yes | DOM/jsdom isolated per test | `client/src/*.spec.ts` |
| e2e (Playwright) | No | Shared dev server + single `town` room; `workers: 1` | `client-e2e/playwright.config.ts` |

## Gate Check Commands

> Generated from codebase — confirm before Execute.

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick (game-core) | After T1 | `nx test game-core` |
| Quick (server) | After T2–T5 | `nx test server` |
| Quick (client) | After T6–T9 | `nx test client` |
| Full | After T10 / phase completion | `nx affected -t test lint` and `nx e2e client-e2e` |
| Build | After T4 (schema-only) | `nx run-many -t build lint` |

---

## Execution Plan

**5 phases** (10 tasks).

### Phase 1: Formula + seed data (Parallel roots)

```
     ┌──→ T2 [P]
T1 ──┘
```

### Phase 2: Server modules (Parallel after Phase 1)

```
T1,T2 ──┬──→ T3
        └──→ T4 [P]
```

### Phase 3: Room integration (Sequential)

```
T3,T4 ──→ T5
```

### Phase 4: Client presentation (Parallel after T5)

```
T5 ──→ T6 ──┬──→ T7 [P]
            ├──→ T8 [P]
            └──→ T9 [P]
```

### Phase 5: E2E (Sequential)

```
T7,T8,T9 ──→ T10
```

---

## Task Breakdown

### T1: Add `calcPhysicalSkillDamage` to game-core `[game-core]`

**What**: Implement L2J physical-skill damage (`77×(pAtk+power)/pDef×randomMod`)
and export from `@nj/game-core`.
**Where**: `libs/game-core/src/combat/melee-damage.ts` (+ spec), `libs/game-core/src/index.ts`
**Depends on**: None
**Reuses**: `calcMeleeDamage` types/options; `STARTER_COMBAT`, `GREMLIN_COMBAT`; L-001 source alias
**Requirement**: P5-R01

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] `calcPhysicalSkillDamage` returns **69** (offset 0) and **62** (offset −10) vs Gremlin
- [ ] Minimum damage floor of **1** preserved
- [ ] Exported from `index.ts`
- [ ] Gate check passes: `nx test game-core`
- [ ] Test count: **+3** tests pass (no silent deletions)

**Tests**: unit
**Gate**: quick (game-core)

**Commit**: `feat(game-core): add physical skill damage formula`

---

### T2: Extend Power Strike seed with `powerL1` `[seed]`

**What**: Parse `power` level 1 from fixture XML; add `power_l1` column; seed + assert **30**.
**Where**: `server/src/seed/parsers/skills.parser.ts`, `server/src/db/schema.ts`, `server/src/db/client.ts`, `server/src/seed/seeders/skills.seeder.spec.ts`, `server/src/seed/parsers/parsers.spec.ts`
**Depends on**: None
**Reuses**: `mpConsumeL1` parser pattern; AD-011 idempotent seed; AD-012 fixtures
**Requirement**: P5-R02

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] `parsePowerStrike` returns `powerL1: 30` with existing fields unchanged
- [ ] Seeded row in DB includes `powerL1: 30`
- [ ] Gate check passes: `nx test server`
- [ ] Test count: **+2** tests pass (no silent deletions)

**Tests**: seed
**Gate**: quick (server)

**Commit**: `feat(seed): add Power Strike powerL1 to skills table`

---

### T3: Add `resolvePowerStrike` to combat-resolver `[server]`

**What**: Skill resolution function with MP, cooldown, range, and damage validation.
**Where**: `server/src/rooms/combat-resolver.ts` (+ `combat-resolver.spec.ts`)
**Depends on**: T1, T2
**Reuses**: `resolvePlayerAttack` structure; `isInMeleeRange`; `calcPhysicalSkillDamage`; `createPlayerCombatState`
**Requirement**: P5-R03, P5-R04

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Successful cast: damage **69**, `mp` reduced by **9**, cooldown end set to `nowMs+3000`
- [ ] Rejects: insufficient MP (`mp=8`), out of range, on cooldown (`t+2999`), no pending flag
- [ ] `PlayerCombatState` extended with `skillPending`, `powerStrikeCooldownEndMs`
- [ ] Gate check passes: `nx test server`
- [ ] Test count: **+6** tests pass (no silent deletions)

**Tests**: unit
**Gate**: quick (server)

**Commit**: `feat(server): add Power Strike combat resolver`

---

### T4: Add `powerStrikeCooldownEndMs` to PlayerState schema `[server]`

**What**: Colyseus schema field for server-broadcast cooldown end timestamp.
**Where**: `server/src/rooms/schema/TownState.ts` (`PlayerState`)
**Depends on**: None
**Reuses**: Existing `@type('number')` fields (`hp`, `mp`, `xp`)
**Requirement**: P5-R04

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] `PlayerState` declares `@type('number') powerStrikeCooldownEndMs = 0`
- [ ] TypeScript build succeeds for server + client consumers
- [ ] Gate check passes: `nx run-many -t build lint`

**Tests**: none
**Gate**: build

**Commit**: `feat(server): broadcast Power Strike cooldown on PlayerState`

---

### T5: Wire `useSkill` in TownRoom with tick resolution `[server]`

**What**: `onMessage('useSkill')`, load skill row from DB, tick `resolvePowerStrike`, MP persist, room-integration tests.
**Where**: `server/src/rooms/TownRoom.ts` (+ `TownRoom.spec.ts`)
**Depends on**: T3, T4
**Reuses**: Phase 4 `attack`/`setTarget` handlers; `handleMobKill`; `scheduleDebouncedSave`; `zeroOffsetRng` / `createFakeClock` test helpers
**Requirement**: P5-R03, P5-R04

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] `useSkill { skillId: 3 }` in range deals **69** damage; `mp` **50→41**
- [ ] Out of range (**4.1** m), low MP (**8**), cooldown (**2999** ms) rejected; **3000** ms succeeds
- [ ] `powerStrikeCooldownEndMs === nowMs + 3000` on success
- [ ] Edge cases: no target, dead mob, bad `skillId` ignored
- [ ] Gate check passes: `nx test server`
- [ ] Test count: **+7** tests pass (no silent deletions)

**Tests**: room-integration
**Gate**: quick (server)

**Commit**: `feat(server): authoritative Power Strike in TownRoom`

---

### T6: Extend `__GAME_STATE__` with MP and cooldown fields `[client]`

**What**: Add `player.mp`, `powerStrikeCooldownEndMs`, `powerStrikeCooldownRemainingMs` to hook; sync from `wireRoom`.
**Where**: `client/src/test-hook.ts`, `client/src/net/room.ts` (+ `test-hook.spec.ts`, `net/room.spec.ts`)
**Depends on**: T5
**Reuses**: `setPlayer` / `onChange` pattern from Phase 4 XP sync
**Requirement**: P5-R08

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Hook exposes mp and cooldown fields with correct types
- [ ] `wireRoom` updates hook on `PlayerState` mp / `powerStrikeCooldownEndMs` change
- [ ] Gate check passes: `nx test client`
- [ ] Test count: **+4** tests pass (no silent deletions)

**Tests**: unit
**Gate**: quick (client)

**Commit**: `feat(client): sync MP and skill cooldown to game state hook`

---

### T7: Add Power Strike hotkey and `__useSkill__` hook `[client]`

**What**: Key `2` sends `useSkill { skillId: 3 }`; expose test hook (no local damage).
**Where**: `client/src/main.ts` (+ `main.spec.ts` or `combat-input.spec.ts`)
**Depends on**: T6
**Reuses**: Phase 4 `wireCombatControls` / `__attack__` pattern
**Requirement**: P5-R05

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Key `2` calls `room.send('useSkill', { skillId: 3 })`
- [ ] `window.__useSkill__` exposed for e2e
- [ ] Unit test confirms no local mob HP mutation
- [ ] Gate check passes: `nx test client`
- [ ] Test count: **+2** tests pass (no silent deletions)

**Tests**: unit
**Gate**: quick (client)

**Commit**: `feat(client): Power Strike hotkey and useSkill intent`

---

### T8: Add DOM Power Strike cooldown bar `[client]`

**What**: HUD overlay `#power-strike-cooldown` with `data-remaining-ms` driven by hook state.
**Where**: `client/index.html`, `client/src/hud/power-strike-cooldown.ts` (+ spec)
**Depends on**: T6
**Reuses**: AD-009 DOM assertions (not canvas pixels)
**Requirement**: P5-R06

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Cooldown bar visible in DOM with id `power-strike-cooldown`
- [ ] When `powerStrikeCooldownEndMs > now`, `data-remaining-ms > 0`
- [ ] When cooldown expired, `data-remaining-ms` is **0**
- [ ] Gate check passes: `nx test client`
- [ ] Test count: **+3** tests pass (no silent deletions)

**Tests**: unit
**Gate**: quick (client)

**Commit**: `feat(client): Power Strike cooldown DOM bar`

---

### T9: Add procedural Power Strike flash effect `[client]`

**What**: Short-lived Three.js procedural burst; trigger on cooldown-start onChange.
**Where**: `client/src/scene/skill-flash.ts`, `client/src/scene/renderer.ts`, `client/src/net/room.ts` (+ `skill-flash.spec.ts`)
**Depends on**: T6
**Reuses**: AD-005 procedural geometry; mob capsule render patterns
**Requirement**: P5-R07

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] `createSkillFlash` adds/removes mesh within ~300 ms
- [ ] `wireRoom` triggers flash when `powerStrikeCooldownEndMs` transitions 0 → positive
- [ ] Unit test asserts flash object count > 0 when triggered
- [ ] Gate check passes: `nx test client`
- [ ] Test count: **+2** tests pass (no silent deletions)

**Tests**: unit
**Gate**: quick (client)

**Commit**: `feat(client): procedural Power Strike flash effect`

---

### T10: E2E — Power Strike kill grants XP and shows cooldown `[e2e]`

**What**: Playwright spec: move to Gremlin, target, `__useSkill__` until kill; assert XP, MP, cooldown DOM.
**Where**: `client-e2e/src/power-strike.spec.ts`
**Depends on**: T5, T7, T8, T9
**Reuses**: `combat.spec.ts` helpers (`waitReady`, move poll, serial describe); `__GAME_STATE__` (AD-009)
**Requirement**: P5-R06, P5-R08

**Tools**:

- MCP: `user-playwright` (optional)
- Skill: NONE

**Done when**:

- [ ] After successful cast, `#power-strike-cooldown` has `data-remaining-ms > 0`
- [ ] After killing mob, `player.xp > 0` and `player.mp === 41`
- [ ] Gate check passes: `nx e2e client-e2e`
- [ ] Test count: **+1** e2e test passes (no silent deletions)

**Tests**: e2e
**Gate**: full

**Commit**: `test(e2e): Power Strike skill player loop`

---

## Parallel Execution Map

```
Phase 1 (Parallel):
  T1 [P]  T2 [P]

Phase 2 (Parallel after T1,T2):
  T3        (needs T1,T2)
  T4 [P]    (no deps)

Phase 3 (Sequential):
  T5

Phase 4 (Parallel after T5):
  T6 ──┬──→ T7 [P]
       ├──→ T8 [P]
       └──→ T9 [P]

Phase 5 (Sequential):
  T10
```

---

## Task Granularity Check

| Task | Scope | Status |
| ---- | ----- | ------ |
| T1: calcPhysicalSkillDamage | 1 function + export | ✅ Granular |
| T2: powerL1 seed extension | 1 parser field + schema column | ✅ Granular |
| T3: resolvePowerStrike | 1 resolver function | ✅ Granular |
| T4: PlayerState cooldown field | 1 schema property | ✅ Granular |
| T5: TownRoom useSkill wiring | 1 room message + tick path + room tests | ✅ Granular |
| T6: test-hook MP/cooldown sync | 2 files, 1 concern (hook contract) | ✅ Granular |
| T7: hotkey + __useSkill__ | 1 input binding | ✅ Granular |
| T8: DOM cooldown bar | 1 HUD component | ✅ Granular |
| T9: procedural flash | 1 effect module | ✅ Granular |
| T10: e2e spec | 1 Playwright file | ✅ Granular |

**Granularity check**: all tasks pass.

---

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| ---- | ---------------------- | ------------- | ------ |
| T1 | None | Phase 1 root | ✅ Match |
| T2 | None | Phase 1 root [P] | ✅ Match |
| T3 | T1, T2 | T1,T2 → T3 | ✅ Match |
| T4 | None | T4 [P] parallel root in Phase 2 | ✅ Match |
| T5 | T3, T4 | T3,T4 → T5 | ✅ Match |
| T6 | T5 | T5 → T6 | ✅ Match |
| T7 | T6 | T6 → T7 [P] | ✅ Match |
| T8 | T6 | T6 → T8 [P] | ✅ Match |
| T9 | T6 | T6 → T9 [P] | ✅ Match |
| T10 | T5, T7, T8, T9 | T7,T8,T9 → T10 (T5 implicit via T7 path) | ✅ Match |

**Diagram-definition cross-check**: all tasks pass.

---

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| ---- | --------------------------- | --------------- | --------- | ------ |
| T1 | Physical skill damage formula | unit | unit | ✅ OK |
| T2 | Skills seed | seed | seed | ✅ OK |
| T3 | Skill combat resolver | unit | unit | ✅ OK |
| T4 | Schema field | none | none | ✅ OK |
| T5 | TownRoom skill integration | room-integration | room-integration | ✅ OK |
| T6 | Client hooks | unit | unit | ✅ OK |
| T7 | Client input | unit | unit | ✅ OK |
| T8 | Client HUD | unit | unit | ✅ OK |
| T9 | Client flash renderer | unit | unit | ✅ OK |
| T10 | E2E player loop | e2e | e2e | ✅ OK |

**Test co-location validation**: all tasks pass.

---

## Requirement → Task Map

| Requirement | Task(s) |
| ----------- | ------- |
| P5-R01 | T1 |
| P5-R02 | T2 |
| P5-R03 | T3, T5 |
| P5-R04 | T3, T4, T5 |
| P5-R05 | T7 |
| P5-R06 | T8, T10 |
| P5-R07 | T9 |
| P5-R08 | T6, T10 |

---

## Ordered Task Summary

| # | Task | Layer | Tests | Depends |
| - | ---- | ----- | ----- | ------- |
| T1 | `calcPhysicalSkillDamage` | game-core | unit | — |
| T2 | `powerL1` seed extension | seed | seed | — |
| T3 | `resolvePowerStrike` | server | unit | T1, T2 |
| T4 | `PlayerState` cooldown field | server | none | — |
| T5 | TownRoom `useSkill` + room tests | server | room-integration | T3, T4 |
| T6 | `__GAME_STATE__` mp/cooldown sync | client | unit | T5 |
| T7 | Hotkey + `__useSkill__` | client | unit | T6 |
| T8 | DOM cooldown bar | client | unit | T6 |
| T9 | Procedural flash | client | unit | T6 |
| T10 | E2E Power Strike loop | e2e | e2e | T5, T7, T8, T9 |
