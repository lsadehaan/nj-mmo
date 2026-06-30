# Phase 24 — Town Services & Full NPC Roster Tasks

## Execution Protocol (MANDATORY — do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and
follow its Execute flow and Critical Rules.** This repo wraps it with
`spec-driven-execution` (Planner → Implementer → Verifier, **autonomous-first**);
honor server-authority (AD-001) and the three test layers (AD-010) — **no Playwright**.

**Skill:** `game-designer` → `references/create-character.md` for **T15–T16** (folk/guard GLBs).

**If the skill cannot be activated, STOP and tell the user — do not proceed without it.**

---

**Design**: `.specs/features/phase-24-town-services/design.md`
**Spec**: `.specs/features/phase-24-town-services/spec.md`
**Status**: Draft

---

## Test Coverage Matrix

> Generated from spec ACs, `AGENTS.md`, and `.specs/STATE.md` AD-009/010/012/014/017/018.
> Post-MVP gate: **no `client-e2e` / Playwright**.

| Code Layer | Required Test Type | ACs | Location Pattern | Run Command |
| ---------- | ------------------ | --- | ---------------- | ----------- |
| `TI_NPC_IDS` + spawn seed | seed + unit | TOWN24-01–10 | `server/src/seed/**/*.spec.ts`, `game-core` placement | `nx test server`, `nx test game-core` |
| NPC manifest + guard interact | unit | TOWN24-11–15 | `client/src/scene/creature/npc-manifest.spec.ts`, `npc-interaction.spec.ts` | `nx test client` |
| Folk trainer expansion | room + client | TOWN24-17–20 | `TownRoom.spec.ts`, `npc-dialog.spec.ts` | `nx test server`, `nx test client` |
| Warehouse schema + logic | unit + room + client | TOWN24-21–28 | `warehouse-transaction.spec.ts`, `TownRoom.spec.ts`, `warehouse-window.spec.ts` | `nx test game-core`, `nx test server`, `nx test client` |
| Teleport seed + handler | seed + room + client | TOWN24-29–35 | `teleport*.spec.ts`, `TownRoom.spec.ts`, `npc-dialog.spec.ts` | `nx test server`, `nx test client` |
| Class transfer | unit + seed + room + client | TOWN24-36–43 | `class-transfer.spec.ts`, `class-templates*.spec.ts`, `TownRoom.spec.ts` | `nx test game-core`, `nx test server`, `nx test client` |
| Biotin priest actions | room | TOWN24-44–48 | `TownRoom.spec.ts` | `nx test server` |
| Quest + gate | seed + gate | TOWN24-49–50 | `quests.seeder.spec.ts`, `nx run-many` | full gate |
| New NPC GLBs | visual gate | TOWN24-16 | `client/public/models/npcs/` | `node scripts/visual-gate.mjs` |
| wireRoom hooks | unit | TOWN24-14, 28 | `wireRoom.spec.ts`, `test-hook.spec.ts` | `nx test client` |

## Parallelism Assessment

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
| --------- | -------------- | --------------- | -------- |
| Unit (`game-core`, `client`) | Yes | Vitest per-file | Existing `*.spec.ts` |
| Room integration | Yes | `NJ_AUTOSIM=0` + per-test room + temp DB (AD-014) | `TownRoom.spec.ts` |
| Seed | Yes | In-memory SQLite per test (AD-011) | `npcs.seeder.spec.ts` |

## Gate Check Commands

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick (game-core) | After T3, T4 | `nx test game-core` |
| Quick (server) | After T1–T2, T5–T10, T12, T18 | `nx test server` |
| Quick (client) | After T11, T13–T14, T17 | `nx test client` |
| Full | After T20 | `nx affected -t test lint` |
| Build | Phase completion (T21) | `nx run-many -t build lint test` |
| Visual | After T19 (before Verifier) | `node scripts/visual-gate.mjs` |

**Speed contract:** Room tests use `NJ_AUTOSIM=0` + `deliver()`/`tick()` — no wall-clock
sleeps. Per-test cap ≤ **10 s** (AD-014).

---

## Execution Plan

**6 phases** (21 tasks).

### Phase 1: Seed foundation — Sequential

```
T1 → T2
```

### Phase 2: game-core pure logic — Sequential

```
T2 → T3 → T4
```

### Phase 3: Server schema & persistence — Sequential

```
T4 → T5 → T6 → T7
```

### Phase 4: TownRoom services — Sequential

```
T7 → T8 → T9 → T10 → T11 → T12
```

### Phase 5: Client UI & assets — Parallel GLBs then sequential

```
T12 ──┬→ T15 [P] folk GLBs
      └→ T16 [P] guard + Biotin GLBs
T15, T16 → T13 → T14 → T17 → T18
```

### Phase 6: Visual gate & regression — Sequential

```
T18 → T19 → T20 → T21
```

---

## Task Breakdown

### T1: Extend NPC roster seed

**What**: Add sixteen NPC nodes to `npcs.xml`; extend `TI_NPC_IDS` to 25 sorted ids.
**Where**: `server/src/seed/paths.ts`, `server/src/seed/__fixtures__/npcs.xml`
**Depends on**: None
**Reuses**: Phase 17 npc parser
**Requirements**: TOWN24-01, TOWN24-03–05

**Tools**: MCP: NONE | Skill: NONE

**Done when**:

- [ ] `TI_NPC_IDS` length 25; includes 30031, 30039–30046
- [ ] `seedNpcs` inserts 25 rows with L2J metadata
- [ ] Gate: `nx test server` green (`npcs.seeder.spec.ts`)

**Tests**: seed | **Gate**: quick (server)

---

### T2: Regenerate NPC spawns

**What**: Run `buildNpcSpawnFixture` against Gludio XML for all 25 ids; commit `npc_spawns.json`.
**Where**: `server/src/seed/__fixtures__/npc_spawns.json`, `npc-spawn-fixture.ts`
**Depends on**: T1
**Reuses**: Phase 23 `l2ToLocal` + `nudgeNpcSpawn`
**Requirements**: TOWN24-06–10

**Done when**:

- [ ] 25 spawn rows; all in `ti_village` peace zone
- [ ] Placement specs pass (`spawn-placement.spec.ts`)
- [ ] Room boot: 25 `NpcState` entries
- [ ] Gate: `nx test server` + `nx test game-core`

**Tests**: seed + unit + room | **Gate**: quick (server)

---

### T3: Class transfer pure module

**What**: `getFirstClassOptions`, `canTransferClass` in game-core.
**Where**: `libs/game-core/src/class/class-transfer.ts`
**Depends on**: T2
**Requirements**: TOWN24-36, TOWN24-39–40

**Done when**:

- [ ] Unit tests: classId 0 → [1,4,7]; reject level 19; reject mystic at fighter master
- [ ] Exported from `@nj/game-core` index
- [ ] Gate: `nx test game-core`

**Tests**: unit | **Gate**: quick (game-core)

---

### T4: Warehouse pure transactions

**What**: `depositToWarehouse` / `withdrawFromWarehouse` with quest-item and capacity guards.
**Where**: `libs/game-core/src/warehouse/warehouse-transaction.ts`
**Depends on**: T3
**Requirements**: TOWN24-24–25

**Done when**:

- [ ] Unit tests cover happy path + reject cases
- [ ] Gate: `nx test game-core`

**Tests**: unit | **Gate**: quick (game-core)

---

### T5: DB schema — warehouse + teleports

**What**: Add `warehouse_items`, `teleport_destinations` tables; migration in `db/client.ts`; schema types.
**Where**: `server/src/db/schema.ts`, `server/src/db/client.ts`
**Depends on**: T4
**Requirements**: TOWN24-21, TOWN24-29

**Done when**:

- [ ] `schema.spec.ts` round-trip new tables
- [ ] Gate: `nx test server`

**Tests**: unit | **Gate**: quick (server)

---

### T6: First-class template seed

**What**: Fixture XML for 17 first-class templates; extend `class-templates.seeder.ts`.
**Where**: `server/src/seed/__fixtures__/players/`, `seeders/class-templates.seeder.ts`
**Depends on**: T5
**Requirements**: TOWN24-37

**Done when**:

- [ ] Seed tests assert Warrior (1) base stats row exists
- [ ] Gate: `nx test server`

**Tests**: seed | **Gate**: quick (server)

---

### T7: Teleport destinations seed

**What**: Seeder loads 5 Roxxy rows from spec anchor table (`l2ToLocal` coords + fees).
**Where**: `server/src/seed/seeders/teleport-destinations.seeder.ts`
**Depends on**: T6
**Requirements**: TOWN24-29

**Done when**:

- [ ] Seed test: obelisk fee **200**, 5 rows for npcId 30006
- [ ] Gate: `nx test server`

**Tests**: seed | **Gate**: quick (server)

---

### T8: Warehouse repository + PlayerState sync

**What**: `warehouse-repository.ts`; load/save; mirror `warehouseItemIds` + `warehouseItemCounts` on `PlayerState`.
**Where**: `server/src/db/warehouse-repository.ts`, `server/src/rooms/schema/PlayerState.ts`, `TownRoom.ts` load path
**Depends on**: T7
**Requirements**: TOWN24-22–23, TOWN24-28

**Done when**:

- [ ] Repository round-trip spec passes
- [ ] Join syncs warehouse arrays to client schema
- [ ] Gate: `nx test server`

**Tests**: unit | **Gate**: quick (server)

---

### T9: TownRoom warehouse handlers

**What**: `warehouseDeposit` / `warehouseWithdraw` onMessage; Wilford proximity gate.
**Where**: `server/src/rooms/TownRoom.ts`
**Depends on**: T8
**Requirements**: TOWN24-22–26

**Done when**:

- [ ] Room tests: deposit/withdraw anchor table; quest-item reject; range reject
- [ ] Gate: `nx test server`

**Tests**: room | **Gate**: quick (server)

---

### T10: TownRoom teleport handler

**What**: `teleport { destinationId }` intent; fee deduction; position + zoneId update.
**Where**: `server/src/rooms/TownRoom.ts`
**Depends on**: T9
**Requirements**: TOWN24-30–33, TOWN24-35

**Done when**:

- [ ] Room tests: obelisk teleport adena **200**; insufficient adena reject; Roxxy heal regression
- [ ] Gate: `nx test server`

**Tests**: room | **Gate**: quick (server)

---

### T11: TownRoom class transfer handler

**What**: `classTransfer { targetClassId }`; Bitz (fighter) + Biotin (mystic); vitals refresh + `grantAutoGetSkills`.
**Where**: `server/src/rooms/TownRoom.ts`, `character-repository.ts`
**Depends on**: T10
**Requirements**: TOWN24-38, TOWN24-41–42

**Done when**:

- [ ] Room tests: Human Fighter 0→1 at level 20; mystic at Bitz reject; mystic 10→11 at Biotin
- [ ] Gate: `nx test server`

**Tests**: room | **Gate**: quick (server)

---

### T12: TownRoom trainer + priest extensions

**What**: Expand `TRAINER_NPC_IDS` to all folk; Biotin `npcAction` resurrect/heal/bless; exclude Guard from interact.
**Where**: `server/src/rooms/TownRoom.ts`, `libs/game-core/src/npc/npc-interact.ts`
**Depends on**: T11
**Requirements**: TOWN24-17–18, TOWN24-44–48

**Done when**:

- [ ] Room tests: learn at Vivyan 30030; Biotin resurrect + bless
- [ ] Gate: `nx test server` + `nx test game-core`

**Tests**: room | **Gate**: quick (server)

---

### T13: Client warehouse window

**What**: `#warehouse-window` DOM; deposit/withdraw UX; enable Wilford dialog buttons.
**Where**: `client/src/ui/warehouse-window.ts`, `npc-dialog.ts`
**Depends on**: T12
**Requirements**: TOWN24-27

**Done when**:

- [ ] Unit tests: render + button wiring
- [ ] Gate: `nx test client`

**Tests**: unit | **Gate**: quick (client)

---

### T14: Client gatekeeper + priest + class transfer dialogs

**What**: `gatekeeper` variant (Roxxy teleports + helper); `priest` variant (Biotin); class-change buttons on Bitz/Biotin trainer dialogs.
**Where**: `client/src/ui/npc-dialog.ts`, `npc-interaction.ts`
**Depends on**: T13
**Requirements**: TOWN24-34, TOWN24-43

**Done when**:

- [ ] Unit tests: destination buttons; change-class options for fighter 20
- [ ] Gate: `nx test client`

**Tests**: unit | **Gate**: quick (client)

---

### T15: Folk trainer GLBs [P]

**What**: Source six KayKit folk GLBs (30028–30030, 30032, 30034–30036); LICENSE; manifest rows.
**Where**: `client/public/models/npcs/`, `npc-manifest.ts`
**Depends on**: T12
**Requirements**: TOWN24-11–12

**Tools**: Skill: `game-designer`

**Done when**:

- [ ] Six unique model paths; manifest unit tests pass
- [ ] Gate: `nx test client`

**Tests**: unit | **Gate**: quick (client)

---

### T16: Guard + Biotin GLBs [P]

**What**: Four guard variants + Biotin GLB; manifest rows for 30031, 30039–30046.
**Where**: `client/public/models/npcs/`, `npc-manifest.ts`
**Depends on**: T12
**Requirements**: TOWN24-11–12, TOWN24-15

**Tools**: Skill: `game-designer`

**Done when**:

- [ ] Guard non-interact client test passes
- [ ] Manifest covers all new ids
- [ ] Gate: `nx test client`

**Tests**: unit | **Gate**: quick (client)

---

### T17: wireRoom intents + test hooks

**What**: Send warehouse/teleport/classTransfer intents; sync `__GAME_STATE__.warehouse`; 25 NPC mesh poll.
**Where**: `client/src/net/room.ts`, `test-hook.ts`
**Depends on**: T14, T15, T16
**Requirements**: TOWN24-14, TOWN24-28

**Done when**:

- [ ] `wireRoom.spec.ts` warehouse + npc count tests pass
- [ ] Gate: `nx test client`

**Tests**: unit | **Gate**: quick (client)

---

### T18: Quest fixture authenticity

**What**: Q153 deliver leg `npcId` → **30041** (Arnold).
**Where**: `server/src/seed/__fixtures__/quests/quests.json`
**Depends on**: T17
**Requirements**: TOWN24-49

**Done when**:

- [ ] `quests.seeder.spec.ts` asserts Arnold deliver target
- [ ] Gate: `nx test server`

**Tests**: seed | **Gate**: quick (server)

---

### T19: Visual gate — new NPCs

**What**: Extend `visual-gate.mjs` + capture PNGs for folk, guards, Biotin subset.
**Where**: `scripts/visual-gate.mjs`, `scripts/shoot-character.mjs`
**Depends on**: T15, T16
**Requirements**: TOWN24-16

**Done when**:

- [ ] `visual-gate.mjs` reports **0 FAIL** for phase-24 entries
- [ ] Gate: visual script exit 0

**Tests**: visual gate | **Gate**: visual

---

### T20: Room test consolidation

**What**: Add `NPC_TEST_COORDS` constants; fill any spec AC gaps not covered in T9–T12.
**Where**: `server/src/rooms/TownRoom.spec.ts`
**Depends on**: T18
**Requirements**: All room-layer ACs traced

**Done when**:

- [ ] Every TOWN24 room AC has at least one test
- [ ] No test file > 10 s (AD-014)
- [ ] Gate: `nx test server`

**Tests**: room | **Gate**: quick (server)

---

### T21: Full regression gate

**What**: Run full monorepo gate; fix any regressions from 25-NPC spawn shift.
**Where**: repo-wide
**Depends on**: T19, T20
**Requirements**: TOWN24-50

**Done when**:

- [ ] `nx run-many -t build lint test` green
- [ ] `validation.md` ready for Verifier (orchestrator)

**Tests**: gate | **Gate**: build

---

## AC → Task Map

| AC range | Task(s) |
| -------- | ------- |
| TOWN24-01–10 | T1, T2 |
| TOWN24-11–16 | T15, T16, T19 |
| TOWN24-17–20 | T12, T14, T20 |
| TOWN24-21–28 | T4, T5, T8, T9, T13, T17 |
| TOWN24-29–35 | T7, T10, T14, T20 |
| TOWN24-36–43 | T3, T6, T11, T14, T20 |
| TOWN24-44–48 | T12, T20 |
| TOWN24-49 | T18 |
| TOWN24-50 | T21 |

**Coverage:** 50 ACs → 21 tasks; 0 unmapped ACs.

---

## Commit Plan (Implementer)

Atomic commits per task recommended: `feat(phase-24): Tn <short description>`.
