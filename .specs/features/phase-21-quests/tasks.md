# Phase 21 — Quests & Tutorial Tasks

## Execution Protocol (MANDATORY — do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and
follow its Execute flow and Critical Rules.** This repo wraps it with
`spec-driven-execution` (Planner → Implementer → Verifier, **autonomous-first**);
honor server-authority (AD-001) and the three test layers (AD-010) — **no Playwright**.

**If the skill cannot be activated, STOP and tell the user — do not proceed
without it.**

---

**Design**: `.specs/features/phase-21-quests/design.md`
**Spec**: `.specs/features/phase-21-quests/spec.md`
**Status**: Done

---

## Test Coverage Matrix

> Generated from spec ACs, `AGENTS.md`, and `.specs/STATE.md` AD-009/AD-010/AD-012/AD-014.
> Post-MVP gate: **no `client-e2e` / Playwright** for this phase.

| Code Layer | Required Test Type | ACs | Location Pattern | Run Command |
| ---------- | ------------------ | --- | ---------------- | ----------- |
| Quest engine pure | unit | QUEST21-01–09, 44–47 | `libs/game-core/src/quest/*.spec.ts` | `nx test game-core` |
| Quest rewards pure | unit | QUEST21-07 | `libs/game-core/src/quest/quest-rewards.spec.ts` | `nx test game-core` |
| Quest seed | seed | QUEST21-10–11, 14 | `server/src/seed/quests*.spec.ts` | `nx test server` |
| character_quests repo | unit | QUEST21-12 | `server/src/db/character-repository.spec.ts` | `nx test server` |
| Shop quest-item guard | unit + room | QUEST21-21 | `server/src/rooms/shop-transaction.spec.ts`, `TownRoom.spec.ts` | `nx test server` |
| TownRoom quest handlers | room-integration | QUEST21-13, 15–22, 23–37 | `server/src/rooms/TownRoom.spec.ts` | `nx test server` |
| Quest log DOM | unit | QUEST21-25, 38–42 | `client/src/ui/quest-log.spec.ts` | `nx test client` |
| Quest markers client | unit | QUEST21-48 | `client/src/scene/quest-markers.spec.ts` | `nx test client` |
| Quest dialog + interact | unit | QUEST21-24 (partial) | `client/src/ui/npc-dialog.spec.ts`, `npc-interaction.spec.ts` | `nx test client` |
| wireRoom + `__GAME_STATE__.quests` | unit | QUEST21-38–43 | `client/src/net/wire-room.spec.ts`, `test-hook.spec.ts` | `nx test client` |
| Schema (`QuestEntryState`) | build | — | `server/src/rooms/schema/` | `nx build server` |

## Parallelism Assessment

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
| --------- | -------------- | --------------- | -------- |
| Unit (`game-core`, `client`, `server` repo) | Yes | Vitest per-file | Existing `*.spec.ts` |
| Room (`server`) | Yes | `NJ_AUTOSIM=0` + per-test room + temp DB | `TownRoom.spec.ts` |
| Seed | Yes | In-memory SQLite per test (AD-011) | Existing seed specs |

## Gate Check Commands

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick (game-core) | After T3–T4 | `nx test game-core` |
| Quick (server) | After T1–T2, T5–T8, T13 | `nx test server` |
| Quick (client) | After T9–T12 | `nx test client` |
| Full | After T13 | `nx affected -t test lint` |
| Build | Phase completion | `nx run-many -t build lint test` |

**Speed contract (every task):** Room tests use `NJ_AUTOSIM=0` + `deliver()`/`tick()` —
no wall-clock sleeps. Per-test cap: unit/room ≤ **10 s** (AD-014).

---

## Execution Plan

**6 phases** (14 tasks).

### Phase 1: Schema & seed — Sequential

```
T1 → T2
```

### Phase 2: Pure quest logic — Sequential

```
T2 → T3 → T4
```

### Phase 3: Persistence & server handlers — Sequential

```
T4 → T5 → T6 → T7 → T8
```

### Phase 4: Client UI — Parallel after T8

```
T8 complete, then:
  ├── T9 [P]  quest-log
  ├── T10 [P] quest-markers
  └── T11 [P] quest dialog + interact chooser
```

### Phase 5: Client wiring — Sequential

```
T9,T10,T11 → T12
```

### Phase 6: Integration tests & gate — Sequential

```
T12 → T13 → T14
```

---

## Task Breakdown

### T1: Quest DB schema + Drizzle models

**What**: Add `quests`, `quest_objectives`, `quest_rewards`, `character_quests`
tables; `items.is_quest_item` column; Drizzle exports in `schema.ts` + `client.ts`
migration.
**Where**: `server/src/db/schema.ts`, `server/src/db/client.ts`
**Depends on**: None
**Reuses**: Existing Drizzle patterns from `character_skills`
**Requirement**: QUEST21-R06, QUEST21-R07

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] All tables created idempotently in `applySchema`
- [ ] `nx build server` passes
- [ ] No TypeScript errors

**Tests**: none
**Gate**: build

**Commit**: `feat(server): add quest persistence schema`

---

### T2: Quest definition seed (17 quests)

**What**: Fixture JSON under `__fixtures__/quests/`, parser, `quests.seeder.ts`,
register in `seed.ts`; seed tests for 17 ids + anchor objectives (105, 151, 255).
**Where**: `server/src/seed/seeders/quests.seeder.ts`, `server/src/seed/parsers/quests.parser.ts`
**Depends on**: T1
**Reuses**: AD-012 fixture pattern; L2J script constants from spec anchor table
**Requirement**: QUEST21-R06, QUEST21-R08

**Done when**:

- [ ] Seed inserts **17** quests with stub giver npcIds ∈ `TI_NPC_IDS`
- [ ] Quest **105** objective: mob **20130** count **10**
- [ ] Quest item rows flagged `is_quest_item=1` where applicable
- [ ] Gate: `nx test server` — seed specs pass (≥3 new tests)
- [ ] Test count: no silent deletions in existing seed suite

**Tests**: seed
**Gate**: quick (server)

**Commit**: `feat(seed): add TI starter quest definitions`

---

### T3: `quest-engine` pure module

**What**: `quest-types.ts`, `quest-engine.ts` with start/talk/kill/deliver/complete;
unit tests for ACs 1–6, 8–9.
**Where**: `libs/game-core/src/quest/`
**Depends on**: T2 (types align with seed shape; may use inline fixtures in tests)
**Reuses**: Immutable update style from `active-effects.ts`
**Requirement**: QUEST21-R01–R05

**Done when**:

- [ ] All objective kinds implemented
- [ ] Kill count partial credit works
- [ ] Idempotent duplicate talk no-op
- [ ] Gate: `nx test game-core` — ≥9 new tests
- [ ] Maps to QUEST21-01–09

**Tests**: unit
**Gate**: quick (game-core)

**Commit**: `feat(game-core): add pure quest engine`

---

### T4: Quest rewards + marker resolvers

**What**: `quest-rewards.ts` (`grantXp` integration), `quest-markers.ts`
(`resolveQuestMarker`); unit tests ACs 7, 44–47.
**Where**: `libs/game-core/src/quest/`
**Depends on**: T3
**Reuses**: `grantXp` from `progression/xp.ts`
**Requirement**: QUEST21-R04, QUEST21-R17

**Done when**:

- [ ] XP reward **3000** changes level when curve allows
- [ ] Marker priority: completable > available > in_progress > none
- [ ] Gate: `nx test game-core` — ≥6 new tests

**Tests**: unit
**Gate**: quick (game-core)

**Commit**: `feat(game-core): quest rewards and NPC markers`

---

### T5: `character_quests` repository

**What**: `loadCharacterQuests`, `saveCharacterQuest`, `upsertQuestProgress` in
`character-repository.ts`; unit tests AC 12–13 patterns.
**Where**: `server/src/db/character-repository.ts`
**Depends on**: T1
**Reuses**: Existing `loadCharacterSkills` pattern
**Requirement**: QUEST21-R07

**Done when**:

- [ ] Round-trip save/load preserves step + counters JSON
- [ ] Completed status persists
- [ ] Gate: `nx test server` — ≥3 new repo tests

**Tests**: unit
**Gate**: quick (server)

**Commit**: `feat(server): persist character quest progress`

---

### T6: `quest-handlers` + TownRoom integration

**What**: New `quest-handlers.ts`; `questAction` message; extend `handleInteract`;
`onMobKilledForQuests` from combat kill path; quest item grant on kill;
`buildQuestDialog`; basic room test (accept quest 105).
**Where**: `server/src/rooms/quest-handlers.ts`, `TownRoom.ts`, `combat-resolver.ts`
**Depends on**: T3, T4, T5, T2
**Reuses**: `npc-actions` proximity; `applyKillRewards` hook point
**Requirement**: QUEST21-R09–R13

**Done when**:

- [ ] `questAction accept` starts quest 105 at Bitz
- [ ] Kill increments tutorial + kill-count quests
- [ ] Complete grants rewards + persists
- [ ] Re-complete rejected
- [ ] Gate: `nx test server` — ≥5 new room tests (QUEST21-15–20 subset)

**Tests**: room-integration
**Gate**: quick (server)

**Commit**: `feat(server): authoritative quest handlers in TownRoom`

---

### T7: Reject selling quest items

**What**: Extend `shop-transaction` / `TownRoom` sell handler to reject
`is_quest_item`; unit + room test AC 21.
**Where**: `server/src/rooms/shop-transaction.ts`
**Depends on**: T1, T6
**Reuses**: Existing sell validation
**Requirement**: QUEST21-R05

**Done when**:

- [ ] Sell item **1012** with quest flag fails
- [ ] Normal item sell still works (regression)
- [ ] Gate: `nx test server`

**Tests**: unit + room
**Gate**: quick (server)

**Commit**: `fix(server): block merchant sell of quest items`

---

### T8: Replicate `questEntries` on PlayerState

**What**: `QuestEntryState` schema; sync on join/quest change; load from DB;
auto-start quest **255** on first join (AC 23).
**Where**: `server/src/rooms/schema/TownState.ts`, `TownRoom.ts`
**Depends on**: T6
**Reuses**: `knownSkillIds` array pattern
**Requirement**: QUEST21-R09, QUEST21-R14 (wire)

**Done when**:

- [ ] `PlayerState.questEntries` encodes id/step/counters
- [ ] New character joins with quest 255 in progress step 0
- [ ] Gate: `nx build server` + room test reconnect AC 13

**Tests**: room-integration
**Gate**: quick (server)

**Commit**: `feat(server): replicate quest state on PlayerState`

---

### T9: Quest log UI `[P]`

**What**: `quest-log.ts` panel; **Q** key toggle; render active/completed +
objective text; unit tests ACs 38–42.
**Where**: `client/src/ui/quest-log.ts`, wire key in `main.ts` or `combat-input.ts`
**Depends on**: T8 (schema shape; may stub entries in tests)
**Reuses**: `shop-window.ts` DOM patterns
**Requirement**: QUEST21-R14–R16

**Done when**:

- [ ] `#quest-log` toggles on **Q**
- [ ] Renders objective text for active quest
- [ ] Empty state when no quests
- [ ] Gate: `nx test client` — ≥5 tests

**Tests**: unit
**Gate**: quick (client)

**Commit**: `feat(client): quest log panel`

---

### T10: NPC quest marker billboards `[P]`

**What**: `quest-markers.ts` scene overlay; `syncQuestMarkers` from npc positions +
`resolveQuestMarker`; client unit AC 48.
**Where**: `client/src/scene/quest-markers.ts`, hook from `renderer.ts`
**Depends on**: T4 (import resolver from game-core)
**Reuses**: Target ring billboard approach
**Requirement**: QUEST21-R18

**Done when**:

- [ ] Roxxy shows `!` when tutorial available
- [ ] Marker hidden when none
- [ ] Gate: `nx test client` — ≥3 tests

**Tests**: unit
**Gate**: quick (client)

**Commit**: `feat(client): NPC quest marker billboards`

---

### T11: Quest dialog variant + merchant chooser `[P]`

**What**: Extend `npc-dialog` with `quest` variant (body + buttons);
`openNpcUiForInteract` shows Shop/Quest chooser for merchant-givers; `questAction`
send; unit tests.
**Where**: `client/src/ui/npc-dialog.ts`, `client/src/npc-interaction.ts`
**Depends on**: T8
**Reuses**: Existing dialog mount pattern
**Requirement**: QUEST21-R09 (client)

**Done when**:

- [ ] Katerina interact offers Shop + Quest when quest available
- [ ] Quest buttons call `window.__questAction__`
- [ ] Gate: `nx test client` — ≥4 tests

**Tests**: unit
**Gate**: quick (client)

**Commit**: `feat(client): quest dialog and interact chooser`

---

### T12: `wireRoom` + `__GAME_STATE__.quests`

**What**: Extend `GameState` with `quests: { active, completed, defs }`;
`setQuests` in test-hook; sync from `PlayerState.questEntries`; `__questAction__`
hook; wire-room tests ACs 38, 43.
**Where**: `client/src/test-hook.ts`, `client/src/net/room.ts`
**Depends on**: T9, T10, T11
**Reuses**: `setPlayer` / `knownSkillIds` sync pattern
**Requirement**: QUEST21-R15

**Done when**:

- [ ] `__GAME_STATE__.quests.active` lists tutorial on join
- [ ] `wireRoom` spec proves sync on schema change
- [ ] Gate: `nx test client`

**Tests**: unit
**Gate**: quick (client)

**Commit**: `feat(client): wire quest state to game test hook`

---

### T13: Room-integration quest anchors

**What**: Add room tests for tutorial ACs 23–28 and starter anchors ACs 29–37
(101, 104, 105, 151, 152, 153, 155, 157, 158); use `tick`/`deliver` + level
setup; deterministic quest drops.
**Where**: `server/src/rooms/TownRoom.spec.ts`
**Depends on**: T8, T12 (full stack; server-only assertions sufficient)
**Reuses**: Phase 20 room harness patterns
**Requirement**: P4, P5 ACs

**Done when**:

- [ ] Tutorial fighter + mystic shot rewards asserted
- [ ] Quest 105 XP **27772** on complete
- [ ] Quest 101 reward item **49043**
- [ ] Quest 158 Nerkas kill enables complete
- [ ] Gate: `nx test server` — ≥9 new room tests
- [ ] No test >10s

**Tests**: room-integration
**Gate**: quick (server)

**Commit**: `test(server): room-integration anchors for TI quests`

---

### T14: Seed completeness + full gate

**What**: Seed test asserting all **17** quest ids; reward row anchors for 101/105/156;
document any L2J deviations; run full monorepo gate.
**Where**: `server/src/seed/quests.seeder.spec.ts`
**Depends on**: T13
**Reuses**: AC 10 coverage
**Requirement**: QUEST21-R06

**Done when**:

- [ ] Seed test lists all quest ids from spec table
- [ ] Gate: `nx run-many -t build lint test` passes
- [ ] `tasks.md` status → Done

**Tests**: seed
**Gate**: build

**Commit**: `test(seed): verify full TI quest batch seeded`

---

## Parallel Execution Map

```
Phase 1:  T1 ──→ T2
Phase 2:  T2 ──→ T3 ──→ T4
Phase 3:  T4 ──→ T5 ──→ T6 ──→ T7 ──→ T8
Phase 4:  T8 ──→ ┬── T9 [P]
                 ├── T10 [P]
                 └── T11 [P]
Phase 5:  T9,T10,T11 ──→ T12
Phase 6:  T12 ──→ T13 ──→ T14
```

---

## Task Granularity Check

| Task | Scope | Status |
| ---- | ----- | ------ |
| T1: DB schema | 2 files, one concern | ✅ Granular |
| T2: Quest seed | 1 seeder + fixtures | ✅ Granular |
| T3: quest-engine | 1 pure module | ✅ Granular |
| T4: rewards + markers | 2 related pure modules | ✅ Granular |
| T5: quest repo | 1 repository extension | ✅ Granular |
| T6: quest-handlers | 1 handler module + thin TownRoom wire | ✅ Granular |
| T7: sell guard | 1 validation branch | ✅ Granular |
| T8: schema replication | schema + sync | ✅ Granular |
| T9: quest-log UI | 1 UI component | ✅ Granular |
| T10: quest markers | 1 scene module | ✅ Granular |
| T11: quest dialog | dialog + interact | ✅ Granular |
| T12: wireRoom hook | 2 files, one wiring concern | ✅ Granular |
| T13: room anchors | 1 spec file extension | ✅ Granular |
| T14: seed gate | 1 spec file | ✅ Granular |

---

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| ---- | ---------------------- | ------------- | ------ |
| T1 | None | Phase 1 root | ✅ Match |
| T2 | T1 | T1 → T2 | ✅ Match |
| T3 | T2 | T2 → T3 | ✅ Match |
| T4 | T3 | T3 → T4 | ✅ Match |
| T5 | T1 (via T4 chain) | T4 → T5 | ✅ Match |
| T6 | T3,T4,T5,T2 | T5 → T6 | ✅ Match |
| T7 | T1,T6 | T6 → T7 | ✅ Match |
| T8 | T6 | T7 → T8 | ✅ Match |
| T9 | T8 | T8 → T9 [P] | ✅ Match |
| T10 | T4,T8 | T8 → T10 [P] | ✅ Match |
| T11 | T8 | T8 → T11 [P] | ✅ Match |
| T12 | T9,T10,T11 | Phase 5 merge | ✅ Match |
| T13 | T8,T12 | T12 → T13 | ✅ Match |
| T14 | T13 | T13 → T14 | ✅ Match |

---

## Test Co-location Validation

| Task | Code Layer | Matrix Requires | Task Says | Status |
| ---- | ---------- | --------------- | --------- | ------ |
| T1 | Schema | none | none | ✅ OK |
| T2 | Seed | seed | seed | ✅ OK |
| T3 | Quest engine | unit | unit | ✅ OK |
| T4 | Rewards/markers | unit | unit | ✅ OK |
| T5 | Repository | unit | unit | ✅ OK |
| T6 | TownRoom handlers | room | room-integration | ✅ OK |
| T7 | Shop guard | unit+room | unit + room | ✅ OK |
| T8 | Schema+room | room | room-integration | ✅ OK |
| T9 | Quest log DOM | unit | unit | ✅ OK |
| T10 | Markers client | unit | unit | ✅ OK |
| T11 | Quest dialog | unit | unit | ✅ OK |
| T12 | wireRoom/hook | unit | unit | ✅ OK |
| T13 | Room anchors | room | room-integration | ✅ OK |
| T14 | Seed completeness | seed | seed | ✅ OK |

---

## AC → Task Traceability (summary)

| AC range | Primary task |
| -------- | ------------ |
| QUEST21-01–09 | T3 |
| QUEST21-07 | T4 |
| QUEST21-10–11, 14 | T2, T14 |
| QUEST21-12 | T5 |
| QUEST21-13 | T8 |
| QUEST21-15–22 | T6, T7 |
| QUEST21-23–28 | T8, T13 |
| QUEST21-29–37 | T13 |
| QUEST21-38–43 | T9, T12 |
| QUEST21-44–47 | T4 |
| QUEST21-48 | T10 |

**Total ACs:** 48 | **Total tasks:** 14
