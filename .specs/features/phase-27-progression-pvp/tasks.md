# Phase 27 — Progression Rules & PvP Tasks

## Execution Protocol (MANDATORY — do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its
Execute flow and Critical Rules.** This repo wraps it with `spec-driven-execution`
(Planner → Implementer → Verifier, **autonomous-first**); honor server-authority (AD-001)
and the three test layers (AD-010) — **no Playwright**.

**If the skill cannot be activated, STOP and tell the user — do not proceed without it.**

---

**Design**: `.specs/features/phase-27-progression-pvp/design.md`
**Spec**: `.specs/features/phase-27-progression-pvp/spec.md`
**Status**: Draft

---

## Test Coverage Matrix

> Generated from spec ACs, `AGENTS.md`, and `.specs/STATE.md` AD-009/010/014.
> Post-MVP gate: **no `client-e2e` / Playwright**.

| Code Layer | Required Test Type | ACs | Location Pattern | Run Command |
| ---------- | ------------------ | --- | ---------------- | ----------- |
| Death / XP cap / restore / SP / stats / PvP pure | unit | PROG27-01–04, 09–10, 15, 20–24, 27, 34–35, 37–38, 43, 45 | `libs/game-core/src/progression/**/*.spec.ts` | `nx test game-core` |
| Experience loss seed | seed | PROG27-13–14 | `server/src/seed/seeders/experience-loss.seeder.spec.ts` | `nx test server` |
| Schema / migration | none (build) | — | `server/src/db/schema.ts` | build gate |
| TownRoom progression handlers | room | PROG27-05–08, 11–12, 16–19, 25–26, 28–33, 39–42, 44, 46 | `server/src/rooms/TownRoom.progression.spec.ts` | `nx test server` |
| Death regression (level 9) | room | PROG27-06 | `server/src/rooms/TownRoom.spec.ts` (minimal touch) | `nx test server` |
| wireRoom progression | unit | PROG27-36, 47 | `client/src/net/room-progression.spec.ts` | `nx test client` |
| Client DOM (PvP / stats / restore) | unit | (wiring smoke) | `client/src/ui/pvp-toggle.spec.ts`, `stat-allocate.spec.ts` | `nx test client` |
| Full gate | gate | PROG27-48 | `nx run-many` | `nx run-many -t build lint test` |

## Parallelism Assessment

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
| --------- | -------------- | --------------- | -------- |
| Unit (`game-core`, `client`) | Yes | Vitest per-file | Existing `*.spec.ts` |
| Room integration | Yes | `NJ_AUTOSIM=0` + per-test room + temp DB + `instanceKey` (AD-014) | `TownRoom.spec.ts` |
| Seed unit | Yes | Temp DB per test (AD-011) | `experience.seeder.spec.ts` |

## Gate Check Commands

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick (game-core) | After T1–T4 | `nx test game-core` |
| Quick (server) | After T5–T12 | `nx test server` |
| Quick (client) | After T13–T15 | `nx test client` |
| Full | After T16 | `nx affected -t test lint` |
| Build | Phase completion (T17) | `nx run-many -t build lint test` |

**Speed contract:** Room tests use `NJ_AUTOSIM=0` + `deliver()`/`tick()` — no wall-clock
sleeps. New PvP/death suites live in **`TownRoom.progression.spec.ts`** (AD-014).

---

## Execution Plan

**5 phases** (17 tasks).

### Phase 1: game-core pure logic — Sequential

```
T1 → T2 → T3 → T4
```

### Phase 2: Server schema & seed — Sequential

```
T4 → T5 → T6
```

### Phase 3: TownRoom handlers — Sequential

```
T6 → T7 → T8 → T9 → T10 → T11 → T12
```

### Phase 4: Client UI & wireRoom — Parallel OK

```
T12 ──┬→ T13 [P] PvP toggle panel
      ├→ T14 [P] stat allocate + restore UI
      └→ T15 [P] wireRoom progression
```

### Phase 5: Integration & gate — Sequential

```
T15 → T16 → T17
```

---

## Task Breakdown

### T1: Death penalty + removeXp/delevel pure functions

**What**: `death-penalty.ts`, `experience-cap.ts` (`grantXpCapped`, `removeXp`); unit tests
for PROG27-01–04, 15, 45 anchors.
**Where**: `libs/game-core/src/progression/`
**Depends on**: None
**Reuses**: `libs/game-core/src/experience.ts`, `player-death.ts` constants
**Requirement**: PROG27-01, PROG27-02, PROG27-03, PROG27-04, PROG27-15, PROG27-45

**Done when**:

- [ ] Level 10 anchor: loss **2039** from xp **50000**
- [ ] Level 9 zero loss; delevel 11→10 on large removal
- [ ] `grantXpCapped` stops at level **20**
- [ ] Gate: `nx test game-core`

**Tests**: unit | **Gate**: quick (game-core)

**Commit**: `feat(progression): death penalty and XP cap pure functions`

---

### T2: restoreExp + skill-points pure functions

**What**: `restore-exp.ts`, `skill-points.ts` (+ party SP split); tests PROG27-09–10, 20.
**Where**: `libs/game-core/src/progression/`
**Depends on**: T1
**Reuses**: `libs/game-core/src/social/party-xp.ts` patterns
**Requirement**: PROG27-09, PROG27-10, PROG27-20

**Done when**:

- [ ] Restore cost `lostExp × 10`; reject when no loss recorded
- [ ] Party SP split mirrors XP bonus table
- [ ] Gate: `nx test game-core`

**Tests**: unit | **Gate**: quick (game-core)

**Commit**: `feat(progression): restore XP and SP pure functions`

---

### T3: stat-points + pvp-rules pure functions

**What**: `stat-points.ts`, `pvp-rules.ts`; tests PROG27-21–24, 34–35, 43.
**Where**: `libs/game-core/src/progression/`
**Depends on**: T1
**Requirement**: PROG27-21, PROG27-22, PROG27-23, PROG27-24, PROG27-34, PROG27-35, PROG27-43

**Done when**:

- [ ] Allocate/reset stat math; karma relief `floor(xp/300)`
- [ ] Peace zone rejects toggle
- [ ] Gate: `nx test game-core`

**Tests**: unit | **Gate**: quick (game-core)

**Commit**: `feat(progression): stat points and PvP rules pure functions`

---

### T4: pvp-combat pure functions

**What**: `pvp-combat.ts` — `resolvePlayerVsPlayerAttack`, `canAttackPlayer` integration;
tests PROG27-37–38.
**Where**: `libs/game-core/src/progression/`
**Depends on**: T3
**Reuses**: `libs/game-core/src/combat/` damage helpers
**Requirement**: PROG27-37, PROG27-38

**Done when**:

- [ ] Flagged target takes damage; innocent takes 0
- [ ] Export from `libs/game-core/src/index.ts`
- [ ] Gate: `nx test game-core`

**Tests**: unit | **Gate**: quick (game-core)

**Commit**: `feat(progression): PvP combat pure resolver`

---

### T5: DB schema + experience_loss seed

**What**: `characters` new columns; `experience_loss` table; parser + seeder + fixture XML;
seed tests PROG27-13–14.
**Where**: `server/src/db/schema.ts`, `server/src/seed/`
**Depends on**: T4
**Requirement**: PROG27-13, PROG27-14

**Done when**:

- [ ] `applySchema` migrates existing DBs with defaults
- [ ] Seed loads `level=10 → 8.875` loss row
- [ ] Gate: `nx test server` (seed specs)

**Tests**: seed | **Gate**: quick (server)

**Commit**: `feat(progression): schema and experience loss seed`

---

### T6: PlayerState replication + character persistence

**What**: Add `sp`, `karma`, `pvpFlag`, `pvpFlagEndMs`, `expBeforeDeath`, stat bonuses to
`PlayerState` + character load/save/debounced persist.
**Where**: `server/src/rooms/schema/TownState.ts`, `server/src/db/character-repository.ts`
**Depends on**: T5
**Requirement**: PROG27-05 (persistence partial)

**Done when**:

- [ ] Join/reconnect restores new fields
- [ ] Build passes
- [ ] Gate: `nx test server` (existing character tests green)

**Tests**: none (build + existing room smoke) | **Gate**: quick (server)

**Commit**: `feat(progression): replicate and persist progression fields`

---

### T7: Death penalty integration in TownRoom

**What**: Wire `handlePlayerDeath` to apply penalty, delevel vitals, `expBeforeDeath`; extend
`applyKillRewards` with `grantXpCapped` + stat point on level-up + karma relief; room tests
PROG27-05–08, 16–17, 46.
**Where**: `server/src/rooms/TownRoom.ts`, `combat-resolver.ts`, `party-kill-rewards.ts`
**Depends on**: T6
**Requirement**: PROG27-05, PROG27-06, PROG27-07, PROG27-08, PROG27-16, PROG27-17, PROG27-46

**Done when**:

- [ ] Level 10 death loses XP; level 9 unchanged
- [ ] Cap 20 blocks XP; Gremlin still +44 at level 1
- [ ] SP granted on kill
- [ ] Gate: `nx test server`

**Tests**: room | **Gate**: quick (server)

**Commit**: `feat(progression): death penalty and capped XP in TownRoom`

---

### T8: Biotin restoreExp + learnSkill SP cost

**What**: `npcAction restoreExp` on Biotin; `handleLearnSkill` SP deduct; room PROG27-11–12,
18–19.
**Where**: `server/src/rooms/TownRoom.ts`, `client/src/ui/npc-dialog.ts`
**Depends on**: T7
**Requirement**: PROG27-11, PROG27-12, PROG27-18, PROG27-19

**Done when**:

- [ ] Restore XP deducts adena; rejects poor players
- [ ] learnSkill requires SP
- [ ] Gate: `nx test server`

**Tests**: room | **Gate**: quick (server)

**Commit**: `feat(progression): Biotin restore XP and SP skill costs`

---

### T9: Stat allocate + trainer reset handlers

**What**: `allocateStat`, `resetStats` intents; trainer proximity; room PROG27-25–28.
**Where**: `server/src/rooms/TownRoom.ts`, `stat-handlers.ts`
**Depends on**: T8
**Requirement**: PROG27-25, PROG27-26, PROG27-27, PROG27-28

**Done when**:

- [ ] Bitz reset refunds points for adena
- [ ] Bonus STR affects next hit damage
- [ ] Gate: `nx test server`

**Tests**: room | **Gate**: quick (server)

**Commit**: `feat(progression): stat allocate and trainer reset`

---

### T10: PvP flag toggle + karma on kill

**What**: `togglePvp`, `tickPvpFlags`, karma on player kill, `pvpKills`/`pkKills`; room
PROG27-29–33, 35.
**Where**: `server/src/rooms/pvp-handlers.ts`, `TownRoom.ts`
**Depends on**: T9
**Requirement**: PROG27-29, PROG27-30, PROG27-31, PROG27-32, PROG27-33, PROG27-35

**Done when**:

- [ ] Flag expires after 120s (tick-driven)
- [ ] PK karma −720; flagged kill no karma penalty
- [ ] Peace zone blocks toggle
- [ ] Gate: `nx test server`

**Tests**: room | **Gate**: quick (server)

**Commit**: `feat(progression): PvP flag and karma handlers`

---

### T11: Player vs player combat in combat-resolver

**What**: `setTargetPlayer`, attack/skill vs player, peace zone guard; unit already in T4;
room PROG27-39–40, 42, 44.
**Where**: `server/src/rooms/combat-resolver.ts`, `TownRoom.ts`
**Depends on**: T10
**Requirement**: PROG27-39, PROG27-40, PROG27-42, PROG27-44

**Done when**:

- [ ] PvP hit reduces target HP; peace zone 0 damage
- [ ] PvP death triggers penalty path
- [ ] Gate: `nx test server`

**Tests**: room | **Gate**: quick (server)

**Commit**: `feat(progression): player vs player combat`

---

### T12: TownRoom.progression.spec.ts + two-session PvP

**What**: Dedicated room spec file with two-session PvP hit (PROG27-41); migrate new tests
from scattered additions.
**Where**: `server/src/rooms/TownRoom.progression.spec.ts`
**Depends on**: T11
**Requirement**: PROG27-41

**Done when**:

- [ ] Two clients: B flagged, A damages B outside village
- [ ] File completes < **10 s** alone
- [ ] Gate: `nx test server`

**Tests**: room | **Gate**: quick (server)

**Commit**: `test(progression): two-session PvP room spec`

---

### T13: PvP toggle client panel [P]

**What**: DOM PvP button → `togglePvp` intent; unit smoke.
**Where**: `client/src/ui/pvp-toggle.ts`, `pvp-toggle.spec.ts`
**Depends on**: T12
**Requirement**: (UI smoke)

**Done when**:

- [ ] Click sends intent via existing room send helper
- [ ] Gate: `nx test client`

**Tests**: unit | **Gate**: quick (client)

**Commit**: `feat(client): PvP toggle UI`

---

### T14: Stat allocate + restore XP UI [P]

**What**: Stat +/reset in trainer dialog; Biotin restore button; unit smoke.
**Where**: `client/src/ui/stat-allocate.ts`, `npc-dialog.ts`
**Depends on**: T12
**Requirement**: (UI smoke)

**Done when**:

- [ ] Buttons wire to `allocateStat`, `resetStats`, `restoreExp`
- [ ] Gate: `nx test client`

**Tests**: unit | **Gate**: quick (client)

**Commit**: `feat(client): stat and restore XP UI`

---

### T15: wireRoom progression state

**What**: `wireRoom` maps `sp`, `karma`, `pvpFlag`, `expBeforeDeath`, stat points;
`room-progression.spec.ts` for PROG27-36, 47.
**Where**: `client/src/net/room.ts`, `test-hook.ts`, `room-progression.spec.ts`
**Depends on**: T12
**Requirement**: PROG27-36, PROG27-47

**Done when**:

- [ ] Mock room state updates `__GAME_STATE__.player`
- [ ] Gate: `nx test client`

**Tests**: unit | **Gate**: quick (client)

**Commit**: `feat(client): wireRoom progression state`

---

### T16: Mount UI + full server/client integration

**What**: `main.ts` mounts PvP/stat panels; verify no boot regression.
**Where**: `client/src/main.ts`
**Depends on**: T13, T14, T15
**Requirement**: (integration)

**Done when**:

- [ ] Panels mount without errors
- [ ] Gate: `nx test client` + `nx test server`

**Tests**: unit | **Gate**: full

**Commit**: `feat(client): mount progression UI panels`

---

### T17: Full regression gate

**What**: `nx run-many -t build lint test`; confirm no test file >10s; fix affected lint.
**Where**: (gate only)
**Depends on**: T16
**Requirement**: PROG27-48

**Done when**:

- [ ] Full gate green
- [ ] Test count ≥ prior baseline (no silent deletions)

**Tests**: gate | **Gate**: build

**Commit**: `chore(progression): phase 27 gate green`

---

## Parallel Execution Map

```
Phase 1:  T1 → T2 → T3 → T4

Phase 2:  T4 → T5 → T6

Phase 3:  T6 → T7 → T8 → T9 → T10 → T11 → T12

Phase 4:  T12 → (T13 | T14 | T15 in any order) → T16

Phase 5:  T16 → T17
```

---

## Task Granularity Check

| Task | Scope | Status |
| ---- | ----- | ------ |
| T1: death + cap pure | 2 modules | ✅ Granular |
| T2: restore + SP pure | 2 modules | ✅ Granular |
| T3: stats + pvp rules | 2 modules | ✅ Granular |
| T4: pvp combat pure | 1 module | ✅ Granular |
| T5: schema + seed | 1 pipeline | ✅ Granular |
| T6: replication | schema + repo | ✅ Granular |
| T7–T12: server handlers | 1 concern each | ✅ Granular |
| T13–T15: client panels | 1 panel group each | ✅ Granular |
| T16–T17: integration/gate | — | ✅ Granular |

---

## Diagram-Definition Cross-Check

| Task | Depends On (body) | Diagram Shows | Status |
| ---- | ----------------- | ------------- | ------ |
| T1 | None | Phase 1 start | ✅ |
| T2 | T1 | T1 → T2 | ✅ |
| T3 | T1 | T1 → T3 | ✅ |
| T4 | T3 | T3 → T4 | ✅ |
| T5 | T4 | T4 → T5 | ✅ |
| T6 | T5 | T5 → T6 | ✅ |
| T7 | T6 | T6 → T7 | ✅ |
| T8 | T7 | T7 → T8 | ✅ |
| T9 | T8 | T8 → T9 | ✅ |
| T10 | T9 | T9 → T10 | ✅ |
| T11 | T10 | T10 → T11 | ✅ |
| T12 | T11 | T11 → T12 | ✅ |
| T13 | T12 | T12 → T13 | ✅ |
| T14 | T12 | T12 → T14 | ✅ |
| T15 | T12 | T12 → T15 | ✅ |
| T16 | T13,T14,T15 | T13–15 → T16 | ✅ |
| T17 | T16 | T16 → T17 | ✅ |

---

## Test Co-location Validation

| Task | Code Layer | Matrix Requires | Task Says | Status |
| ---- | ---------- | --------------- | --------- | ------ |
| T1 | game-core pure | unit | unit | ✅ |
| T2 | game-core pure | unit | unit | ✅ |
| T3 | game-core pure | unit | unit | ✅ |
| T4 | game-core pure | unit | unit | ✅ |
| T5 | seed | seed | seed | ✅ |
| T6 | schema | none | none | ✅ |
| T7–T12 | room | room | room | ✅ |
| T13–T16 | client unit | unit | unit | ✅ |
| T17 | gate | gate | gate | ✅ |

---

## Requirement → Task Traceability

| AC range | Task(s) |
| -------- | ------- |
| PROG27-01–04, 15, 45 | T1 |
| PROG27-09–10, 20 | T2 |
| PROG27-21–24, 34–35, 43 | T3 |
| PROG27-37–38 | T4 |
| PROG27-13–14 | T5 |
| PROG27-05 (partial) | T6 |
| PROG27-05–08, 16–17, 46 | T7 |
| PROG27-11–12, 18–19 | T8 |
| PROG27-25–28 | T9 |
| PROG27-29–33, 35 | T10 |
| PROG27-39–40, 42, 44 | T11 |
| PROG27-41 | T12 |
| PROG27-36, 47 | T15 |
| PROG27-48 | T17 |

**Coverage:** 48 ACs → 17 tasks; 0 unmapped.
