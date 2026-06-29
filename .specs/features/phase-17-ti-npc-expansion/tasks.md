# Phase 17 — Talking Island NPC Expansion (+5) Tasks

## Execution Protocol (MANDATORY — do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and
follow its Execute flow and Critical Rules.** This repo wraps it with
`spec-driven-execution` (Planner → Implementer → Verifier, **autonomous-first**);
honor server-authority (AD-001) and the four test layers (AD-010).

**If the skill cannot be activated, STOP and tell the user — do not proceed without it.**

---

**Design**: `.specs/features/phase-17-ti-npc-expansion/design.md`
**Status**: Draft

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec — confirm before Execute.
> Guidelines found: `AGENTS.md` (four test layers, AD-014 speed contract),
> `.specs/STATE.md` AD-001/009/010/012/013/014/017/018.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| `TI_NPC_IDS` export | unit | TINPC-01: seven ids | `server/src/seed/paths.ts` | `nx test server` |
| NPC + merchant + spawn seed | seed | TINPC-02–11, 14: metadata, prices, positions | `server/src/seed/seeders/*.spec.ts` | `nx test server` |
| NPC spawn placement guards | unit | TINPC-12–13: peace zone + `isNpcSpawnBlocked` | `libs/game-core/src/npc-placement.spec.ts` | `nx test game-core` |
| Lector buy (server) | room-integration | TINPC-22–23: buy 883 adena + distance reject | `server/src/rooms/TownRoom.spec.ts` | `nx test server` |
| NPC manifest | unit | TINPC-15–18: seven entries, unique models, clip keys | `client/src/scene/creature/npc-manifest.spec.ts` | `nx test client` |
| Shop window | unit | TINPC-24–25, 30: per-merchant catalogs + Katerina regression | `client/src/ui/shop-window.spec.ts` | `nx test client` |
| NPC dialog | unit | TINPC-26–28: warehouse/trainer stubs | `client/src/ui/npc-dialog.spec.ts` | `nx test client` |
| NPC interaction routing | unit | TINPC-29: greet npcId + merchant/warehouse routing | `client/src/npc-interaction.spec.ts`, `wire-room.spec.ts` | `nx test client` |
| E2E observability + buy | e2e | TINPC-31–35: 7 meshes at join, Lector buy + greet | `client-e2e/src/town.spec.ts` or `ti-npc-expansion.spec.ts` | `nx e2e client-e2e` |
| NPC GLB binaries | none (visual gate) | TINPC-19–21: structural + screenshots | `client/public/models/npcs/` | `node scripts/visual-gate.mjs` |
| NPC renderer fallback | unit | Edge: capsule fallback regression | `client/src/scene/npc-renderer.spec.ts` | `nx test client` |

## Parallelism Assessment

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
| --------- | -------------- | --------------- | -------- |
| Unit (`game-core`) | Yes | Pure functions, no shared state | `peace-zone.spec.ts` pattern |
| Unit (`client`) | Yes | DOM reset in `beforeEach` | `shop-window.spec.ts` |
| Unit (`server` seed) | Yes | Temp DB per test (AD-011) | `merchant-npc-spawns.seeder.spec.ts` |
| Room integration | Yes | `NJ_AUTOSIM=0` + per-test room + `:memory:` DB (AD-014) | `TownRoom.spec.ts` |
| E2E | Yes | Per-test `?room=` instanceKey (AD-014) | `playwright.config.ts` `fullyParallel` |

## Gate Check Commands

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick (game-core) | After T2 | `nx test game-core` |
| Quick (server) | After T1–T5, T15 | `nx test server` |
| Quick (client) | After T11–T14, T16 | `nx test client` |
| Full | After T17 | `nx affected -t test lint` + `nx e2e client-e2e` |
| Build | Phase completion (T19) | `nx run-many -t build lint test` |
| Visual | After T10 (before Verifier) | `node scripts/visual-gate.mjs` + `shoot-character.mjs` |

**AD-014 speed constraints (every task):** No wall-clock sleeps in tests. Room tests use
`NJ_AUTOSIM=0` + `tick()`/`deliver()`. E2E uses `expect.poll` only (no `waitForTimeout`).
Per-test timeout ≤30 s (unit/room), ≤60 s (e2e). Flag any test >10 s as defect to fix.

---

## Execution Plan

**5 phases** (19 tasks).

### Phase 1: Seed data — Sequential

```
T1 → T2 → T3 → T4 → T5
```

### Phase 2: NPC GLB assets — Parallel

```
T5 ──┬→ T6 [P] Lector GLB
     ├→ T7 [P] Jackson GLB
     ├→ T8 [P] Silvia GLB
     ├→ T9 [P] Wilford GLB
     └→ T10 [P] Bitz GLB
```

### Phase 3: Client manifest + UI — Sequential

```
T6–T10 → T11 → T12 → T13 → T14
```

### Phase 4: Verification — Sequential

```
T14 → T15 → T16 → T17
```

### Phase 5: Visual gate + docs — Sequential

```
T17 → T18 → T19
```

---

## Task Breakdown

### T1: Extend `TI_NPC_IDS` export

**What**: Add five npcIds to `TI_NPC_IDS` (seven total, sorted).
**Where**: `server/src/seed/paths.ts`
**Depends on**: None
**Reuses**: Phase 16 `TI_MOB_IDS` extension pattern
**Requirement**: TINPC-01

**Tools**: MCP: NONE · Skill: NONE

**Done when**:

- [ ] `TI_NPC_IDS` exports `[30001, 30002, 30003, 30004, 30005, 30006, 30026]`
- [ ] Unit assertion in `paths.spec.ts` or seed spec (TINPC-01)
- [ ] `nx test server` passes; no test >10 s

**Tests**: unit
**Gate**: quick (server)

**Commit**: `feat(seed): extend TI_NPC_IDS for phase 17 NPC expansion`

---

### T2: NPC spawn placement helper

**What**: Add `isNpcSpawnBlocked(x,z,margin?)` to game-core; unit-test all seven spawn coords.
**Where**: `libs/game-core/src/world-blockers.ts`, `libs/game-core/src/npc-placement.spec.ts`
**Depends on**: None
**Reuses**: `isBlocked`, `BUILDING_AABBS`, `isInPeaceZone`
**Requirement**: TINPC-12, TINPC-13

**Done when**:

- [ ] Helper exported from `@nj/game-core`
- [ ] Spec asserts peace zone + non-blocked for design.md spawn table
- [ ] `nx test game-core` passes

**Tests**: unit
**Gate**: quick (game-core)

**Commit**: `feat(game-core): add NPC spawn placement guard helper`

---

### T3: Fixture NPC defs + items subset

**What**: Add five `<npc>` nodes to `npcs.xml`; extend `items_subset.xml` with nine shop item ids.
**Where**: `server/src/seed/__fixtures__/npcs.xml`, `items_subset.xml`
**Depends on**: T1
**Reuses**: Existing 30004/30006 XML shape
**Requirement**: TINPC-02–07

**Done when**:

- [ ] Fixture parses via `parseNpcs` for all seven ids
- [ ] `parseItemsXml` includes new item ids
- [ ] Seed tests pass after T4 wires buylists (or stub failing tests until T4)

**Tests**: seed (co-located in T5)
**Gate**: quick (server) after T5

**Commit**: `feat(seed): add phase 17 NPC fixture defs and shop items`

---

### T4: Fixture buylists + npc spawns

**What**: Add `buylist_30001/02/03.xml` fixtures; extend `npc_spawns.json` with five rows.
**Where**: `server/src/seed/__fixtures__/`
**Depends on**: T3
**Reuses**: L2J `3000101/201/301.xml` subset; design.md coords
**Requirement**: TINPC-08–11

**Done when**:

- [ ] Fixture buylists contain exact anchor item ids and L2J prices
- [ ] `npc_spawns.json` has seven rows matching spawn table
- [ ] Files committed under `__fixtures__/` (AD-012)

**Tests**: seed (co-located in T5)
**Gate**: quick (server) after T5

**Commit**: `feat(seed): add merchant buylists and NPC spawn fixtures`

---

### T5: Generalize merchant seed + seed tests

**What**: Parameterize `parseMerchantBuylist`; loop merchants in seeder; extend seed specs for all ACs TINPC-02–14.
**Where**: `buylist.parser.ts`, `merchant-items.seeder.ts`, `merchant-npc-spawns.seeder.spec.ts`, `npcs.seeder.spec.ts` (new/extend)
**Depends on**: T4
**Reuses**: Katerina seeder pattern
**Requirement**: TINPC-02–14

**Done when**:

- [ ] `runSeed` inserts merchant rows for 30001–30004 (30004 unchanged prices)
- [ ] Seed tests assert metadata, prices, spawns, idempotency
- [ ] `nx test server` passes; seed file runtime <10 s total

**Tests**: seed + unit
**Gate**: quick (server)

**Commit**: `feat(seed): generalize merchant buylist seeding for TI shops`

---

### T6: Lector GLB asset [P]

**What**: Vendor `Lector.glb` from KayKit Knight; LICENSE entry; inspect tracks.
**Where**: `client/public/models/npcs/Lector.glb`, `LICENSE.txt`
**Depends on**: T5
**Reuses**: `create-character.md` steps 1–2
**Requirement**: TINPC-19

**Done when**:

- [ ] GLB on disk; track names documented for clip map
- [ ] Distinct file hash from other NPC GLBs

**Tests**: none (visual in T18)
**Gate**: build

**Commit**: `feat(assets): add Lector weapon merchant GLB`

---

### T7: Jackson GLB asset [P]

**What**: Vendor `Jackson.glb` from KayKit Barbarian.
**Where**: `client/public/models/npcs/Jackson.glb`
**Depends on**: T5
**Requirement**: TINPC-19

**Done when**: GLB on disk; distinct from T6.

**Tests**: none
**Gate**: build

**Commit**: `feat(assets): add Jackson armor merchant GLB`

---

### T8: Silvia GLB asset [P]

**What**: Vendor `Silvia.glb` from KayKit Rogue_Hooded.
**Where**: `client/public/models/npcs/Silvia.glb`
**Depends on**: T5
**Requirement**: TINPC-19

**Done when**: GLB on disk; distinct silhouette.

**Tests**: none
**Gate**: build

**Commit**: `feat(assets): add Silvia accessory merchant GLB`

---

### T9: Wilford GLB asset [P]

**What**: Vendor `Wilford.glb` from KayKit Hooded.
**Where**: `client/public/models/npcs/Wilford.glb`
**Depends on**: T5
**Requirement**: TINPC-19

**Done when**: GLB on disk.

**Tests**: none
**Gate**: build

**Commit**: `feat(assets): add Wilford warehouse keeper GLB`

---

### T10: Bitz GLB asset [P]

**What**: Vendor `Bitz.glb` from KayKit Rogue.
**Where**: `client/public/models/npcs/Bitz.glb`
**Depends on**: T5
**Requirement**: TINPC-19

**Done when**: GLB on disk; distinct from Silvia/Jackson.

**Tests**: none
**Gate**: build

**Commit**: `feat(assets): add Bitz fighter trainer GLB`

---

### T11: NPC manifest rows

**What**: Add five `npc-manifest.ts` entries with `KAYKIT_CLIP_MAP` + `cast: Interact`; extend spec for TINPC-15–18.
**Where**: `client/src/scene/creature/npc-manifest.ts`, `npc-manifest.spec.ts`
**Depends on**: T6–T10
**Reuses**: Katerina/Roxxy manifest pattern
**Requirement**: TINPC-15–18

**Done when**:

- [ ] `getNpcEntry` returns entries for 30001, 30002, 30003, 30005, 30026
- [ ] All seven model paths unique
- [ ] `nx test client` passes

**Tests**: unit
**Gate**: quick (client)

**Commit**: `feat(client): add npc-manifest rows for five new TI NPCs`

---

### T12: npcId-keyed shop window

**What**: Generalize `shop-window.ts` with `SHOP_CATALOGS`, `npcId` + merchant name in render; unit tests for Lector/Jackson/Silvia + Katerina regression.
**Where**: `client/src/ui/shop-window.ts`, `shop-window.spec.ts`
**Depends on**: T11
**Requirement**: TINPC-24, TINPC-25, TINPC-30

**Done when**:

- [ ] Catalogs show anchor buy prices 883/169/105/… per spec
- [ ] Katerina 103/8/2 regression green
- [ ] `nx test client` passes

**Tests**: unit
**Gate**: quick (client)

**Commit**: `feat(ui): npcId-keyed merchant shop catalogs`

---

### T13: Dialog variants (warehouse + trainer)

**What**: Extend `npc-dialog.ts` with `warehouse` and `trainer` variants; disabled stub buttons; unit tests.
**Where**: `client/src/ui/npc-dialog.ts`, `npc-dialog.spec.ts`, `npc-interaction.ts`
**Depends on**: T12
**Requirement**: TINPC-26, TINPC-27, TINPC-28

**Done when**:

- [ ] Warehouse shows Deposit/Withdraw disabled "Coming soon"
- [ ] Trainer shows Change Class disabled
- [ ] Roxxy helper unchanged
- [ ] `nx test client` passes

**Tests**: unit
**Gate**: quick (client)

**Commit**: `feat(ui): warehouse and trainer NPC dialog stubs`

---

### T14: Wire room interact + greet fix

**What**: Pass `npcId`/name to `renderShopWindow`; route Warehouse/Trainer to dialog; fix `fireNpcGreet(message.npcId)`; update `npc-interaction.spec.ts` / `wire-room.spec.ts`.
**Where**: `client/src/net/room.ts`, `npc-interaction.ts`
**Depends on**: T13
**Requirement**: TINPC-29

**Done when**:

- [ ] Greet spy receives interacted merchant npcId (not 30004 always)
- [ ] `nx test client` passes

**Tests**: unit
**Gate**: quick (client)

**Commit**: `fix(client): route new NPC types and greet correct npcId`

---

### T15: Room-integration Lector buy

**What**: Add TownRoom tests: buy Short Sword at Lector (adena 1000→117); reject at 3.1 m.
**Where**: `server/src/rooms/TownRoom.spec.ts`
**Depends on**: T5
**Reuses**: `deliver()`, Katerina shop test pattern
**Requirement**: TINPC-22, TINPC-23

**Done when**:

- [ ] Tests use `NJ_AUTOSIM=0` harness only — **no** sleep
- [ ] `nx test server` passes; new tests <10 s each

**Tests**: room-integration
**Gate**: quick (server)

**Commit**: `test(server): room-integration buy at Lector weapon merchant`

---

### T16: E2E seven NPC meshes + Lector buy

**What**: Extend e2e: poll 7 `renderKind:'mesh'` at join; Lector buy flow with `expect.poll` only.
**Where**: `client-e2e/src/town.spec.ts` or `ti-npc-expansion.spec.ts`
**Depends on**: T14, T15
**Requirement**: TINPC-31–35

**Done when**:

- [ ] No `waitForTimeout` in new tests
- [ ] Mesh assertions without walking all NPCs
- [ ] Lector buy: adena 117 + greet cast poll
- [ ] `nx e2e client-e2e` passes; new tests ≤60 s

**Tests**: e2e
**Gate**: full

**Commit**: `test(e2e): assert seven TI NPC meshes and Lector shop buy`

---

### T17: NPC renderer regression

**What**: Confirm `syncNpcVisual` mesh path for one new npcId; capsule fallback test still passes.
**Where**: `client/src/scene/npc-renderer.spec.ts`
**Depends on**: T11
**Requirement**: Edge case (GLB failure)

**Done when**:

- [ ] Unit test covers `npcId=30001` mesh `renderKind`
- [ ] `nx test client` passes

**Tests**: unit
**Gate**: quick (client)

**Commit**: `test(client): npc-renderer coverage for new merchant npcId`

---

### T18: Visual gate (structural + screenshots)

**What**: Run `visual-gate.mjs`; capture idle+greet PNGs for 30001–30003, 30005, 30026; review silhouettes.
**Where**: `scripts/visual-gate.mjs`, `scripts/shoot-character.mjs`, `client-e2e/artifacts/npc-gate/`
**Depends on**: T6–T11
**Requirement**: TINPC-20, TINPC-21

**Done when**:

- [ ] `node scripts/visual-gate.mjs` → PASS (all NPC GLBs)
- [ ] PNG artifacts committed or documented in validation.md
- [ ] Perception check: five distinct silhouettes

**Tests**: none (visual gate)
**Gate**: visual

**Commit**: `chore(assets): phase 17 NPC visual gate screenshots`

---

### T19: Full gate

**What**: Run full monorepo gate; fix any regressions.
**Depends on**: T16, T18
**Requirement**: All ACs

**Done when**:

- [ ] `nx run-many -t build lint test` green
- [ ] `nx e2e client-e2e` green
- [ ] No tests skipped/weakened

**Tests**: all layers
**Gate**: build + full

**Commit**: `chore: phase 17 gate green`

---

## Parallel Execution Map

```
Phase 1:  T1 → T2 → T3 → T4 → T5

Phase 2:  T5 completes, then parallel:
            T6 [P], T7 [P], T8 [P], T9 [P], T10 [P]

Phase 3:  T6–T10 → T11 → T12 → T13 → T14

Phase 4:  T14 → T15 → T16 → T17

Phase 5:  T17 → T18 → T19
```

---

## Task Granularity Check

| Task | Scope | Status |
| ---- | ----- | ------ |
| T1: TI_NPC_IDS | 1 export + test | ✅ Granular |
| T2: placement helper | 1 function + spec file | ✅ Granular |
| T3: fixture npcs + items | 2 fixture files | ✅ Cohesive |
| T4: buylists + spawns | 4 fixture files | ✅ Cohesive |
| T5: merchant seeder | parser + seeder + tests | ✅ Cohesive |
| T6–T10: GLB each | 1 asset per task | ✅ Granular |
| T11: manifest | 1 module + spec | ✅ Granular |
| T12: shop window | 1 UI module | ✅ Granular |
| T13: dialog variants | 1 UI module | ✅ Granular |
| T14: room wiring | 1 net module | ✅ Granular |
| T15: room buy test | 1 test block | ✅ Granular |
| T16: e2e | 1 spec file extend | ✅ Granular |
| T17: renderer test | 1 spec extend | ✅ Granular |
| T18: visual gate | verification task | ✅ Granular |
| T19: full gate | integration | ✅ Granular |

---

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| ---- | ---------------------- | ------------- | ------ |
| T1 | None | Phase1 start | ✅ Match |
| T2 | None | Phase1 (parallel to T1 in diagram — OK, no hard dep) | ✅ Match |
| T3 | T1 | T1 → T3 | ✅ Match |
| T4 | T3 | T3 → T4 | ✅ Match |
| T5 | T4 | T4 → T5 | ✅ Match |
| T6–T10 | T5 | T5 → T6–T10 parallel | ✅ Match |
| T11 | T6–T10 | T6–T10 → T11 | ✅ Match |
| T12 | T11 | T11 → T12 | ✅ Match |
| T13 | T12 | T12 → T13 | ✅ Match |
| T14 | T13 | T13 → T14 | ✅ Match |
| T15 | T5 | T14 → T15 (T15 also needs T5 seed — diagram shows after T14 for integration order; T5 precedes T15 in time via Phase 1) | ✅ Match |
| T16 | T14, T15 | T14 → T15 → T16 | ✅ Match |
| T17 | T11 | T16 → T17 | ✅ Match |
| T18 | T6–T11 | T17 → T18 | ✅ Match |
| T19 | T16, T18 | T18 → T19 | ✅ Match |

---

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| ---- | --------------------------- | --------------- | --------- | ------ |
| T1 | paths export | unit | unit | ✅ OK |
| T2 | game-core placement | unit | unit | ✅ OK |
| T3 | fixtures | seed (via T5) | seed co-located T5 | ✅ OK |
| T4 | fixtures | seed (via T5) | seed co-located T5 | ✅ OK |
| T5 | seed pipeline | seed | seed + unit | ✅ OK |
| T6–T10 | GLB assets | none (visual T18) | none | ✅ OK |
| T11 | npc manifest | unit | unit | ✅ OK |
| T12 | shop UI | unit | unit | ✅ OK |
| T13 | dialog UI | unit | unit | ✅ OK |
| T14 | room wiring | unit | unit | ✅ OK |
| T15 | TownRoom | room-integration | room-integration | ✅ OK |
| T16 | e2e | e2e | e2e | ✅ OK |
| T17 | npc-renderer | unit | unit | ✅ OK |
| T18 | visual | none | none | ✅ OK |
| T19 | gate | all | all | ✅ OK |

---

## Requirement → Task Map

| AC range | Tasks |
| -------- | ----- |
| TINPC-01 | T1 |
| TINPC-12–13 | T2 |
| TINPC-02–07, 11 | T3, T4 |
| TINPC-08–14 | T5 |
| TINPC-19 | T6–T10 |
| TINPC-15–18 | T11 |
| TINPC-24–25, 30 | T12 |
| TINPC-26–28 | T13 |
| TINPC-29 | T14 |
| TINPC-22–23 | T15 |
| TINPC-31–35 | T16 |
| TINPC-20–21 | T18 |
| All | T19 |
