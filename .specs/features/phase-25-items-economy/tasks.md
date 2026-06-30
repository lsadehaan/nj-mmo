# Phase 25 — Items, Economy & Crafting Tasks

## Execution Protocol (MANDATORY — do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and
follow its Execute flow and Critical Rules.** This repo wraps it with
`spec-driven-execution` (Planner → Implementer → Verifier, **autonomous-first**);
honor server-authority (AD-001) and the three test layers (AD-010) — **no Playwright**.

**Skill:** `game-designer` → `references/create-character.md` for **T20** (Pinter GLB).

**If the skill cannot be activated, STOP and tell the user — do not proceed without it.**

---

**Design**: `.specs/features/phase-25-items-economy/design.md`
**Spec**: `.specs/features/phase-25-items-economy/spec.md`
**Status**: Draft

---

## Test Coverage Matrix

> Generated from spec ACs, `AGENTS.md`, and `.specs/STATE.md` AD-009/010/012/014.
> Post-MVP gate: **no `client-e2e` / Playwright**.

| Code Layer | Required Test Type | ACs | Location Pattern | Run Command |
| ---------- | ------------------ | --- | ---------------- | ----------- |
| Item/recipe/set seed | seed + unit | ITEM25-01–10, 50 | `server/src/seed/**/*.spec.ts` | `nx test server` |
| Merchant buylists + Pinter | seed + room | ITEM25-11–16 | `merchant-items*.spec.ts`, `TownRoom.spec.ts` | `nx test server` |
| Equip pure + repository | unit + room | ITEM25-17–25 | `equip-slots.spec.ts`, `equipment-repository.spec.ts`, `TownRoom.spec.ts` | `nx test game-core`, `nx test server` |
| Equipment stats + sets | unit + room | ITEM25-26–32 | `equipment-stats.spec.ts`, `armor-sets.spec.ts`, `TownRoom.spec.ts` | `nx test game-core`, `nx test server` |
| Soulshot regression | room + client | ITEM25-33–36 | `TownRoom.spec.ts`, `combat-resolver.spec.ts`, `soulshot-glint-vfx.spec.ts` | `nx test server`, `nx test client` |
| Craft pure + handler | unit + room + client | ITEM25-37–42 | `craft.spec.ts`, `TownRoom.spec.ts`, `craft-dialog.spec.ts` | `nx test game-core`, `nx test server`, `nx test client` |
| Enchant pure + handler | unit + room + client | ITEM25-43–49 | `enchant.spec.ts`, `TownRoom.spec.ts`, `enchant-dialog.spec.ts` | `nx test game-core`, `nx test server`, `nx test client` |
| Drops + gate | seed + room + gate | ITEM25-50–52 | `drops*.spec.ts`, `nx run-many` | full gate |
| wireRoom equipment | unit | ITEM25-32 | `wireRoom.spec.ts`, `test-hook.spec.ts` | `nx test client` |
| Pinter GLB | visual gate | (fidelity) | `client/public/models/npcs/` | `node scripts/visual-gate.mjs` |

## Parallelism Assessment

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
| --------- | -------------- | --------------- | -------- |
| Unit (`game-core`, `client`) | Yes | Vitest per-file | Existing `*.spec.ts` |
| Room integration | Yes | `NJ_AUTOSIM=0` + per-test room + temp DB (AD-014) | `TownRoom.spec.ts` |
| Seed | Yes | In-memory SQLite per test (AD-011) | `items.seeder.spec.ts` |

## Gate Check Commands

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick (game-core) | After T3–T6, T8 | `nx test game-core` |
| Quick (server) | After T1–T2, T5, T9–T14, T16 | `nx test server` |
| Quick (client) | After T15, T17–T19 | `nx test client` |
| Full | After T21 | `nx affected -t test lint` |
| Build | Phase completion (T22) | `nx run-many -t build lint test` |
| Visual | After T20 (before Verifier) | `node scripts/visual-gate.mjs` |

**Speed contract:** Room tests use `NJ_AUTOSIM=0` + `deliver()`/`tick()` — no wall-clock
sleeps. Per-test cap ≤ **10 s** (AD-014).

---

## Execution Plan

**6 phases** (22 tasks).

### Phase 1: Seed & schema — Sequential

```
T1 → T2 → T3
```

### Phase 2: game-core pure logic — Sequential

```
T3 → T4 → T5 → T6 → T7 → T8
```

### Phase 3: Server persistence & handlers — Sequential

```
T8 → T9 → T10 → T11 → T12 → T13 → T14
```

### Phase 4: Client UI — Sequential

```
T14 → T15 → T16 → T17 → T18 → T19
```

### Phase 5: Assets & drops — Parallel OK

```
T13 ──┬→ T20 [P] Pinter GLB
      └→ T21 [P] Drop table expansion
T20, T21 → T22
```

### Phase 6: Regression gate — Sequential

```
T22
```

---

## Task Breakdown

### T1: Extend items schema + fixtures

**What**: Add columns to `items`; create `items_ti.xml` fixture; define `TI_ITEM_IDS`.
**Where**: `server/src/db/schema.ts`, `server/src/seed/__fixtures__/items_ti.xml`, `server/src/seed/paths.ts`
**Depends on**: None
**Reuses**: Phase 7 items table
**Requirements**: ITEM25-01, ITEM25-02

**Tools**: MCP: NONE | Skill: NONE

**Done when**:

- [ ] Schema migration applies in `applySchema`
- [ ] `TI_ITEM_IDS` length ≥ 75
- [ ] Gate: `nx test server` (`schema.spec.ts`)

**Tests**: seed | **Gate**: quick (server)

---

### T2: Seed items, recipes, armor sets

**What**: Extend `items.parser`; add `recipes.seeder`, `armor-sets.seeder`; wire `runSeed`.
**Where**: `server/src/seed/parsers/items.parser.ts`, `server/src/seed/seeders/`
**Depends on**: T1
**Reuses**: `parseItemsXml`, idempotent seed transaction
**Requirements**: ITEM25-03–10, ITEM25-50

**Done when**:

- [ ] Anchors: item **3**, **58**, **1786**, recipe **2**, sets **0–1**
- [ ] Idempotent seed test passes
- [ ] Gate: `nx test server`

**Tests**: seed | **Gate**: quick (server)

---

### T3: Full merchant buylists + Pinter NPC seed

**What**: Parse full Lector/Jackson/Silvia buylists; seed Pinter **30298** + scroll listings; extend `TI_NPC_IDS` to 26.
**Where**: `merchant-items.seeder.ts`, `npcs.xml`, `npc_spawns.json`, `paths.ts`
**Depends on**: T2
**Reuses**: Phase 17 buylist parser
**Requirements**: ITEM25-11–16

**Done when**:

- [ ] Lector 27 rows; Jackson ≥ 30; Silvia ≥ 15
- [ ] Pinter sells **955**, **956**
- [ ] Room: 26 NPCs boot
- [ ] Gate: `nx test server`

**Tests**: seed + room | **Gate**: quick (server)

---

### T4: Equip slots pure module

**What**: `equip-slots.ts` with `bodyPartToSlot`, `validateEquip`, `validateUnequip`, two-hand rules.
**Where**: `libs/game-core/src/items/equip-slots.ts`
**Depends on**: T1
**Reuses**: `equip-transaction.ts` patterns
**Requirements**: ITEM25-18, ITEM25-23

**Done when**:

- [ ] 11 slots exported
- [ ] Unit tests: accept/reject paths
- [ ] Gate: `nx test game-core`

**Tests**: unit | **Gate**: quick (game-core)

---

### T5: Equipment stats + enchant + sets pure modules

**What**: `equipment-stats.ts`, `enchant.ts`, `armor-sets.ts`, `calcClassBasePDef`.
**Where**: `libs/game-core/src/items/`
**Depends on**: T4
**Reuses**: `effective-patk.ts`, L2J enchant formulas
**Requirements**: ITEM25-26–30, ITEM25-43–48

**Done when**:

- [ ] Anchors: pAtk +11, pDef +47, +3 enchant bonuses, Wooden set +41 HP
- [ ] `canEnchant` rejects NG and +4
- [ ] Gate: `nx test game-core`

**Tests**: unit | **Gate**: quick (game-core)

---

### T6: Craft pure module

**What**: `craft.ts` with `canCraft` / `applyCraft`.
**Where**: `libs/game-core/src/items/craft.ts`
**Depends on**: T2
**Reuses**: inventory math from shop-transaction
**Requirements**: ITEM25-37–41

**Done when**:

- [ ] Dwarf classIds 53/54/56 pass; others reject
- [ ] Recipe **2** ingredient consumption correct
- [ ] Gate: `nx test game-core`

**Tests**: unit | **Gate**: quick (game-core)

---

### T7: `character_equipment` schema + repository

**What**: Table + `equipment-repository.ts`; legacy `equippedWeaponItemId` migration.
**Where**: `server/src/db/schema.ts`, `server/src/db/equipment-repository.ts`
**Depends on**: T4
**Reuses**: `warehouse-repository` pattern
**Requirements**: ITEM25-17, ITEM25-25

**Done when**:

- [ ] PK `(character_id, slot)`
- [ ] Migration test: 2369 → `rhand`
- [ ] Gate: `nx test server`

**Tests**: unit | **Gate**: quick (server)

---

### T8: PlayerState equip arrays + wireRoom sync

**What**: Add parallel equip arrays to schema; map in `wireRoom` + `__GAME_STATE__.equipment`.
**Where**: `server/src/rooms/schema/TownState.ts`, `client/src/net/room.ts`, `client/src/test-hook.ts`
**Depends on**: T7
**Reuses**: warehouse array pattern (Phase 24)
**Requirements**: ITEM25-32

**Done when**:

- [ ] `__GAME_STATE__.equipment.chest` reflects server
- [ ] Gate: `nx test client`

**Tests**: unit | **Gate**: quick (client)

---

### T9: TownRoom equip / unequip handlers

**What**: Replace `handleEquip` weapon-only with full slot equip; add `unequip`.
**Where**: `server/src/rooms/TownRoom.ts`, retire `equip-transaction.ts` → game-core
**Depends on**: T4, T7, T8
**Reuses**: inventory count helpers
**Requirements**: ITEM25-19–24

**Done when**:

- [ ] Room: equip chest **23**, ring **116**, unequip chest
- [ ] Reject consumable equip
- [ ] Gate: `nx test server`

**Tests**: room | **Gate**: quick (server)

---

### T10: Combat integration — equipment stats on player

**What**: Use `calcEffectivePAtk` / `calcPlayerPDef` in player attack and mob→player damage.
**Where**: `server/src/rooms/TownRoom.ts`, `combat-resolver.ts`
**Depends on**: T5, T9
**Reuses**: Phase 19 class stats
**Requirements**: ITEM25-26–27, ITEM25-31

**Done when**:

- [ ] Room: armored player takes less mob damage than naked
- [ ] Equipped Broadsword increases melee damage
- [ ] Gate: `nx test server`

**Tests**: room | **Gate**: quick (server)

---

### T11: Soulshot regression suite

**What**: Confirm Phase 20 soulshot/spiritshot paths unchanged; extend room anchors.
**Where**: `server/src/rooms/TownRoom.spec.ts`, `combat-resolver.spec.ts`
**Depends on**: T10
**Reuses**: Phase 20 SKILL20 anchors
**Requirements**: ITEM25-33–36

**Done when**:

- [ ] Room: **142** Power Strike + soulshot; **80** Wind Strike + spiritshot
- [ ] Client: `soulshot-glint-vfx.spec.ts` still passes
- [ ] Gate: `nx test server` + `nx test client`

**Tests**: room + unit | **Gate**: quick (server + client)

---

### T12: TownRoom craft handler

**What**: `craft` intent; dwarf gate; persist inventory + MP.
**Where**: `server/src/rooms/TownRoom.ts`
**Depends on**: T6, T9
**Reuses**: `handleUseItem` inventory patterns
**Requirements**: ITEM25-37–41

**Done when**:

- [ ] Room: dwarf crafts Broadsword; human rejected
- [ ] MP −30; ingredients consumed
- [ ] Gate: `nx test server`

**Tests**: room | **Gate**: quick (server)

---

### T13: TownRoom enchant handler

**What**: `enchant` intent; scroll grade match; +3 cap; update equipment enchant_level.
**Where**: `server/src/rooms/TownRoom.ts`
**Depends on**: T5, T9
**Reuses**: seeded RNG
**Requirements**: ITEM25-43–48

**Done when**:

- [ ] Room: D weapon +955 → +1; armor +956 → +3; +4 rejected
- [ ] NG Broadsword rejected
- [ ] Gate: `nx test server`

**Tests**: room | **Gate**: quick (server)

---

### T14: Merchant buy room tests

**What**: Room integration for buy at Lector (item **3**) + sell armor.
**Where**: `server/src/rooms/TownRoom.spec.ts`
**Depends on**: T3, T9
**Reuses**: existing shop tests
**Requirements**: ITEM25-14

**Done when**:

- [ ] Buy Broadsword deducts **14375** adena
- [ ] Gate: `nx test server`

**Tests**: room | **Gate**: quick (server)

---

### T15: Inventory + equipment panel UI

**What**: Extend inventory for all equippable types; show equipped slots; Equip/Unequip buttons.
**Where**: `client/src/ui/inventory-window.ts`, `equipment-panel.ts`
**Depends on**: T8, T9
**Reuses**: shop-window DOM patterns
**Requirements**: ITEM25-32 (partial)

**Done when**:

- [ ] Equip chest shows in equipment panel
- [ ] Gate: `nx test client`

**Tests**: unit | **Gate**: quick (client)

---

### T16: Craft dialog UI

**What**: Dwarf-only craft list from known recipes in inventory; send `craft` intent.
**Where**: `client/src/ui/craft-dialog.ts`, `inventory-window.ts`
**Depends on**: T12, T15
**Reuses**: trainer-dialog pattern
**Requirements**: ITEM25-42

**Done when**:

- [ ] Craft button enabled with recipe **1786**
- [ ] Gate: `nx test client`

**Tests**: unit | **Gate**: quick (client)

---

### T17: Enchant dialog UI (Pinter)

**What**: Blacksmith dialog at Pinter; scroll + slot picker; send `enchant` intent.
**Where**: `client/src/ui/enchant-dialog.ts`, `npc-dialog.ts`
**Depends on**: T13, T15
**Reuses**: warehouse dialog pattern
**Requirements**: ITEM25-49

**Done when**:

- [ ] Enchant UI renders at Pinter interact
- [ ] Gate: `nx test client`

**Tests**: unit | **Gate**: quick (client)

---

### T18: Vitals HUD pDef display

**What**: Show player pDef (and enchant indicators) on HUD from `__GAME_STATE__`.
**Where**: `client/src/ui/vitals-hud.ts` (or existing HUD module)
**Depends on**: T10, T15
**Reuses**: `__GAME_STATE__` vitals
**Requirements**: ITEM25-32

**Done when**:

- [ ] pDef value updates after equipping Wooden Breastplate
- [ ] Gate: `nx test client`

**Tests**: unit | **Gate**: quick (client)

---

### T19: wireRoom + test-hook equipment coverage

**What**: Complete `wireRoom.spec.ts` coverage for equip/craft/enchant message wiring.
**Where**: `client/src/net/wireRoom.spec.ts`
**Depends on**: T15–T18
**Reuses**: Phase 24 wireRoom patterns
**Requirements**: ITEM25-32, ITEM25-42, ITEM25-49

**Done when**:

- [ ] wireRoom sends equip/craft/enchant intents
- [ ] Gate: `nx test client`

**Tests**: unit | **Gate**: quick (client)

---

### T20: Pinter NPC GLB + manifest [P]

**What**: Rigged dwarf blacksmith GLB; `npc-manifest` row for **30298**.
**Where**: `client/public/models/npcs/`, `npc-manifest.ts`
**Depends on**: T3
**Reuses**: Phase 12 NPC pipeline
**Requirements**: (visual fidelity)

**Tools**: Skill: `game-designer` → `create-character.md`

**Done when**:

- [ ] `getNpcEntry(30298)` non-null
- [ ] Visual gate PASS for Pinter PNG
- [ ] Gate: `nx test client` + `node scripts/visual-gate.mjs`

**Tests**: unit + visual | **Gate**: visual

---

### T21: TI mob drop table expansion [P]

**What**: Add material/armor drops to ≥8 TI mobs; room kill drop test.
**Where**: `server/src/seed/seeders/drops.seeder.ts`, fixtures
**Depends on**: T2
**Reuses**: Phase 4/16 drop parser
**Requirements**: ITEM25-50–51

**Done when**:

- [ ] Gremlin drops **1864** with seeded rng
- [ ] Room: kill grants drop item
- [ ] Gate: `nx test server`

**Tests**: seed + room | **Gate**: quick (server)

---

### T22: Full regression gate

**What**: Run full Nx gate; fix any cross-phase regressions.
**Where**: repo-wide
**Depends on**: T11, T14, T19–T21
**Reuses**: `nx run-many`
**Requirements**: ITEM25-52

**Done when**:

- [ ] `nx run-many -t build lint test` green
- [ ] Visual gate 0 FAIL
- [ ] All 52 ACs traceable in tasks

**Tests**: gate | **Gate**: build

**Commit**: `docs(spec): phase 25 planning complete` (orchestrator commits validation separately)

---

## Parallel Execution Map

```
Phase 1:  T1 ──→ T2 ──→ T3

Phase 2:  T3 ──→ T4 ──→ T5 ──→ T6 ──→ T7 ──→ T8

Phase 3:  T8 ──→ T9 ──→ T10 ──→ T11 ──→ T12 ──→ T13 ──→ T14

Phase 4:  T14 ──→ T15 ──→ T16 ──→ T17 ──→ T18 ──→ T19

Phase 5:  T13 complete, then:
            ├── T20 [P]
            └── T21 [P]
          T20,T21 ──→ T22
```

---

## Task Granularity Check

| Task | Scope | Status |
| ---- | ----- | ------ |
| T1: Schema + fixture ids | 1 schema + manifest | ✅ Granular |
| T2: Seed items/recipes/sets | 1 seeder group | ✅ Granular |
| T4: equip-slots pure | 1 module | ✅ Granular |
| T9: TownRoom equip | 1 handler group | ✅ Granular |
| T15–T19: Client UI | 1 dialog each | ✅ Granular |

---

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| ---- | ---------------------- | ------------- | ------ |
| T1 | None | Phase1 start | ✅ |
| T2 | T1 | T1→T2 | ✅ |
| T3 | T2 | T2→T3 | ✅ |
| T4 | T1 | T3→T4 | ✅ |
| T5 | T4 | T4→T5 | ✅ |
| T6 | T2 | T2→T6 (via T3 chain) | ✅ |
| T7 | T4 | T4→T7 | ✅ |
| T8 | T7 | T7→T8 | ✅ |
| T9 | T4,T7,T8 | T8→T9 | ✅ |
| T10 | T5,T9 | T9→T10 | ✅ |
| T11 | T10 | T10→T11 | ✅ |
| T12 | T6,T9 | T11→T12 | ✅ |
| T13 | T5,T9 | T12→T13 | ✅ |
| T14 | T3,T9 | T13→T14 | ✅ |
| T15 | T8,T9 | T14→T15 | ✅ |
| T16 | T12,T15 | T15→T16 | ✅ |
| T17 | T13,T15 | T16→T17 | ✅ |
| T18 | T10,T15 | T17→T18 | ✅ |
| T19 | T15–T18 | T18→T19 | ✅ |
| T20 | T3 | T13→T20 parallel | ✅ |
| T21 | T2 | T13→T21 parallel | ✅ |
| T22 | T11,T14,T19–T21 | T22 final | ✅ |

---

## Test Co-location Validation

| Task | Code Layer | Matrix Requires | Task Says | Status |
| ---- | ---------- | --------------- | --------- | ------ |
| T1 | schema/seed | seed | seed | ✅ |
| T2 | seed | seed | seed | ✅ |
| T3 | seed+room | seed+room | seed+room | ✅ |
| T4 | game-core | unit | unit | ✅ |
| T5 | game-core | unit | unit | ✅ |
| T6 | game-core | unit | unit | ✅ |
| T7 | repository | unit | unit | ✅ |
| T8 | client wire | unit | unit | ✅ |
| T9 | TownRoom | room | room | ✅ |
| T10 | combat | room | room | ✅ |
| T11 | regression | room+unit | room+unit | ✅ |
| T12 | craft handler | room | room | ✅ |
| T13 | enchant handler | room | room | ✅ |
| T14 | shop room | room | room | ✅ |
| T15–T19 | client UI | unit | unit | ✅ |
| T20 | visual | unit+visual | unit+visual | ✅ |
| T21 | drops | seed+room | seed+room | ✅ |
| T22 | gate | gate | gate | ✅ |

---

## AC → Task Traceability

| AC | Task(s) |
| -- | ------- |
| ITEM25-01–02 | T1 |
| ITEM25-03–10, 50 | T2 |
| ITEM25-11–16 | T3, T14 |
| ITEM25-17–18 | T1, T4 |
| ITEM25-19–24 | T9 |
| ITEM25-25 | T7 |
| ITEM25-26–31 | T5, T10 |
| ITEM25-32 | T8, T15, T18, T19 |
| ITEM25-33–36 | T11 |
| ITEM25-37–41 | T6, T12 |
| ITEM25-42 | T16 |
| ITEM25-43–48 | T5, T13 |
| ITEM25-49 | T17 |
| ITEM25-51 | T21 |
| ITEM25-52 | T22 |

**Coverage:** 52 ACs → 22 tasks; all mapped.
