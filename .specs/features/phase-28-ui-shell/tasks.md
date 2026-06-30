# Phase 28 — UI/UX Client Shell Tasks

## Execution Protocol (MANDATORY — do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its
Execute flow and Critical Rules.** This repo wraps it with `spec-driven-execution`
(Planner → Implementer → Verifier, **autonomous-first**); honor server-authority (AD-001)
and the three test layers (AD-010) — **no Playwright**.

**If the skill cannot be activated, STOP and tell the user — do not proceed without it.**

---

**Design**: `.specs/features/phase-28-ui-shell/design.md`
**Spec**: `.specs/features/phase-28-ui-shell/spec.md`
**Status**: Draft

---

## Test Coverage Matrix

> Generated from spec ACs, `AGENTS.md`, and `.specs/STATE.md` AD-009/010/014.
> Post-MVP gate: **no `client-e2e` / Playwright**.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| Inventory weight / max load pure | unit | UI28-22; all weight formula branches | `libs/game-core/src/inventory/**/*.spec.ts` | `nx test game-core` |
| Item weight seed | seed | `items.weight` for TI_ITEM_IDS anchor rows | `server/src/seed/seeders/items*.spec.ts` | `nx test server` |
| Character account list / join guard | unit + room | UI28-14, UI28-15 | `server/src/db/character-repository.spec.ts`, `server/src/rooms/TownRoom.ui-shell.spec.ts` | `nx test server` |
| Inventory weight replication | room | UI28-23 | `server/src/rooms/TownRoom.ui-shell.spec.ts` | `nx test server` |
| Window manager / hotkeys | unit | UI28-01–07 | `client/src/ui/window-manager.spec.ts` | `nx test client` |
| Login + character select | unit | UI28-08–13 | `client/src/ui/login-screen.spec.ts`, `character-select.spec.ts` | `nx test client` |
| Inventory grid | unit | UI28-16–21 | `client/src/ui/inventory-window.spec.ts` | `nx test client` |
| Skill window | unit | UI28-24–28 | `client/src/ui/skill-window.spec.ts` | `nx test client` |
| Quest log + tracker | unit | UI28-29–33 | `client/src/ui/quest-log.spec.ts`, `quest-tracker.spec.ts` | `nx test client` |
| Party panel | unit | UI28-35–40 | `client/src/ui/party-panel.spec.ts` | `nx test client` |
| Minimap + world map | unit | UI28-41–46 | `client/src/ui/minimap.spec.ts`, `world-map.spec.ts` | `nx test client` |
| Buff/debuff bars | unit | UI28-47–50 | `client/src/ui/buff-debuff-bars.spec.ts` | `nx test client` |
| Target + system menu | unit | UI28-52–57 | `client/src/ui/target-frame.spec.ts`, `system-menu.spec.ts` | `nx test client` |
| Vitals bars | unit | UI28-59 | `client/src/hud/player-vitals.spec.ts` | `nx test client` |
| wireRoom UI sync | unit | UI28-34, UI28-51, UI28-58 | `client/src/net/room-ui-shell.spec.ts` | `nx test client` |
| Full gate | gate | UI28-60 | `nx run-many` | `nx run-many -t build lint test` |

## Parallelism Assessment

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
| --------- | -------------- | --------------- | -------- |
| Unit (`game-core`, `client`) | Yes | Vitest per-file jsdom | Existing `*.spec.ts` |
| Room integration | Yes | `NJ_AUTOSIM=0` + per-test room + temp DB + `instanceKey` (AD-014) | `TownRoom.spec.ts` |
| Seed unit | Yes | Temp DB per test (AD-011) | `items.seeder.spec.ts` |

## Gate Check Commands

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick (game-core) | After T1–T2 | `nx test game-core` |
| Quick (server) | After T3–T5 | `nx test server` |
| Quick (client) | After T6–T16 | `nx test client` |
| Full | After T17 | `nx affected -t test lint` |
| Build | Phase completion (T18) | `nx run-many -t build lint test` |

**Speed contract:** New room tests in **`TownRoom.ui-shell.spec.ts`** only; use `tick()`/`deliver()` — no wall-clock sleeps (AD-014).

---

## Execution Plan

**6 phases** (18 tasks).

### Phase 1: game-core + seed foundation — Sequential

```
T1 → T2
```

### Phase 2: Server account + weight replication — Sequential

```
T2 → T3 → T4 → T5
```

### Phase 3: Client shell core — Sequential

```
T5 → T6 → T7
```

### Phase 4: Major panels — Parallel OK

```
T7 ──┬→ T8 [P]  inventory grid
     ├→ T9 [P]  skill window
     ├→ T10 [P] quest tabs + tracker
     ├→ T11 [P] party frames
     ├→ T12 [P] minimap + world map
     ├→ T13 [P] buff/debuff bars
     └→ T14 [P] target frame + system menu
```

### Phase 5: Integration — Sequential

```
T14 → T15 → T16 → T17
```

### Phase 6: Gate — Sequential

```
T17 → T18
```

---

## Task Breakdown

### T1: Inventory weight + max load pure functions

**What**: `calcInventoryWeight`, `calcMaxLoad`, `countInventorySlots` + unit tests (UI28-22 anchors).
**Where**: `libs/game-core/src/inventory/inventory-weight.ts`
**Depends on**: None
**Reuses**: `libs/game-core/src/experience.ts` export pattern
**Requirement**: UI28-22

**Done when**:

- [ ] Squire's Sword stack **1600**; CON **43** → maxLoad **2967**
- [ ] Gate: `nx test game-core`

**Tests**: unit | **Gate**: quick (game-core)

**Commit**: `feat(ui-shell): inventory weight and max load pure functions`

---

### T2: Seed `items.weight` column

**What**: Drizzle column + parser field from `items_ti.xml`; seed-data tests for anchors **2369**, **1060**.
**Where**: `server/src/db/schema.ts`, `server/src/seed/parsers/items.parser.ts`, seeder
**Depends on**: T1
**Requirement**: UI28-22, UI28-23 (data prerequisite)

**Done when**:

- [ ] `items.weight` populated for TI_ITEM_IDS
- [ ] Gate: `nx test server` (seed specs)

**Tests**: seed | **Gate**: quick (server)

**Commit**: `feat(ui-shell): seed item weight from L2J fixtures`

---

### T3: Account name on characters + list API

**What**: `characters.account_name`; `listCharactersByAccount`; `GET /api/characters`; create with account + name validation.
**Where**: `server/src/db/character-repository.ts`, `server/src/app.config.ts`
**Depends on**: T2
**Requirement**: UI28-10, UI28-12, UI28-14

**Done when**:

- [ ] API returns `{ id, name, level, classId }[]`
- [ ] Unit tests for list + duplicate name reject
- [ ] Gate: `nx test server`

**Tests**: unit | **Gate**: quick (server)

**Commit**: `feat(ui-shell): character list API and account name column`

---

### T4: Join validation + inventory weight on PlayerState

**What**: `onJoin` validates `characterId` belongs to `accountName`; compute/replicate `inventoryWeight`, `maxLoad`, `inventorySlotsUsed`.
**Where**: `server/src/rooms/TownRoom.ts`, `server/src/rooms/schema/TownState.ts`
**Depends on**: T3
**Requirement**: UI28-15, UI28-23

**Done when**:

- [ ] Room test: wrong account join rejected
- [ ] Room test: weight **1600** with sword in inventory
- [ ] Gate: `nx test server`

**Tests**: room | **Gate**: quick (server)

**Commit**: `feat(ui-shell): join guard and inventory weight replication`

---

### T5: Active effects schema + mob aggro target

**What**: `PlayerState.activeEffects` array schema; sync from combat effects tick; `MobState.aggroTargetSessionId` from mob AI.
**Where**: `server/src/rooms/schema/TownState.ts`, `MobState.ts`, `mob-ai.ts`, effect tick path
**Depends on**: T4
**Requirement**: UI28-47, UI28-51, UI28-55

**Done when**:

- [ ] Might buff appears in `activeEffects` after cast
- [ ] Mob aggro sets `aggroTargetSessionId`
- [ ] Gate: `nx test server`

**Tests**: room | **Gate**: quick (server)

**Commit**: `feat(ui-shell): replicate active effects and mob aggro target`

---

### T6: Window manager + vitals bar upgrade

**What**: `window-manager.ts`; register panels; global hotkeys I/K/L/Q/M/Escape; upgrade `player-vitals.ts` to HP/MP bars.
**Where**: `client/src/ui/window-manager.ts`, `client/src/hud/player-vitals.ts`
**Depends on**: T5
**Requirement**: UI28-01–07, UI28-59

**Done when**:

- [ ] Hotkey tests pass for I, K, L, Q, Escape
- [ ] HP fill width matches ratio in vitals spec
- [ ] Gate: `nx test client`

**Tests**: unit | **Gate**: quick (client)

**Commit**: `feat(ui-shell): window manager and vitals bars`

---

### T7: Login + character select + boot refactor

**What**: `login-screen.ts`, `character-select.ts`; refactor `main.ts` boot (login → select → join); name field on character creation.
**Where**: `client/src/ui/login-screen.ts`, `character-select.ts`, `main.ts`, `character-creation.ts`
**Depends on**: T6
**Requirement**: UI28-08–13

**Done when**:

- [ ] Login stores `nj.accountName`
- [ ] Select mocks fetch → renders rows → calls connect
- [ ] 3-character cap UI
- [ ] Gate: `nx test client`

**Tests**: unit | **Gate**: quick (client)

**Commit**: `feat(ui-shell): login and character select flow`

---

### T8: Inventory grid + weight/slot bars [P]

**What**: Refactor `inventory-window.ts` to 8×10 grid, paper doll, weight/slot bars; `layoutItemsToGrid` pure helper.
**Where**: `client/src/ui/inventory-window.ts`
**Depends on**: T7
**Reuses**: `createIconImg`, `equipment` from test-hook
**Requirement**: UI28-16–21

**Done when**:

- [ ] 80 slots rendered; weight bar **1600/2967** test
- [ ] Double-click use fires handler
- [ ] Gate: `nx test client`

**Tests**: unit | **Gate**: quick (client)

**Commit**: `feat(ui-shell): inventory grid with weight and slots`

---

### T9: Skill window [P]

**What**: New `skill-window.ts`; mount via window manager; K hotkey; SP + cooldown UI.
**Where**: `client/src/ui/skill-window.ts`
**Depends on**: T7
**Reuses**: `icon-manifest`, `__useSkill__`
**Requirement**: UI28-24–28

**Done when**:

- [ ] Known skills render with icons; SP display; empty state
- [ ] Gate: `nx test client`

**Tests**: unit | **Gate**: quick (client)

**Commit**: `feat(ui-shell): skill window panel`

---

### T10: Quest log tabs + quest tracker [P]

**What**: Tabbed quest log; new `quest-tracker.ts` HUD chip; L hotkey via window manager.
**Where**: `client/src/ui/quest-log.ts`, `quest-tracker.ts`
**Depends on**: T7
**Requirement**: UI28-29–33

**Done when**:

- [ ] Active/Completed tabs; tracker shows first active objective
- [ ] Gate: `nx test client`

**Tests**: unit | **Gate**: quick (client)

**Commit**: `feat(ui-shell): quest log tabs and tracker HUD`

---

### T11: Party panel upgrade [P]

**What**: Member frames with HP/MP bars; leader badge; remove session-id input; invite wired from target frame (stub ok until T14).
**Where**: `client/src/ui/party-panel.ts`
**Depends on**: T7
**Requirement**: UI28-35–40

**Done when**:

- [ ] 2-member party renders 2 frames at 40% HP
- [ ] No `[data-role="invite-target"]`
- [ ] Gate: `nx test client`

**Tests**: unit | **Gate**: quick (client)

**Commit**: `feat(ui-shell): party member vitals frames`

---

### T12: Minimap + world map [P]

**What**: `minimap.ts`, `minimap-zones.ts`, `world-map.ts`; M hotkey; zone labels from `TI_ZONES`.
**Where**: `client/src/ui/minimap.ts`, `minimap-zones.ts`, `world-map.ts`
**Depends on**: T7
**Reuses**: `WORLD_MIN/MAX`, `getZoneAt`
**Requirement**: UI28-41–46

**Done when**:

- [ ] Player dot centered at origin; 6 zones on world map
- [ ] Gate: `nx test client`

**Tests**: unit | **Gate**: quick (client)

**Commit**: `feat(ui-shell): minimap and world map`

---

### T13: Buff/debuff bars [P]

**What**: `buff-debuff-bars.ts`; render from `activeEffects`; timer countdown.
**Where**: `client/src/ui/buff-debuff-bars.ts`
**Depends on**: T7
**Reuses**: skill icons, `SKILL_EFFECT_NAMES`
**Requirement**: UI28-47–50

**Done when**:

- [ ] Buff row separate from debuff row; timer **12**s test
- [ ] Gate: `nx test client`

**Tests**: unit | **Gate**: quick (client)

**Commit**: `feat(ui-shell): buff and debuff effect bars`

---

### T14: Target frame + system menu [P]

**What**: `target-frame.ts` (target + ToT + context menu); `system-menu.ts` (ESC, logout, shortcuts).
**Where**: `client/src/ui/target-frame.ts`, `system-menu.ts`
**Depends on**: T7
**Requirement**: UI28-52–57

**Done when**:

- [ ] Mob target HP bar; ToT name; PvP flag on player target
- [ ] System menu logout returns to select
- [ ] Gate: `nx test client`

**Tests**: unit | **Gate**: quick (client)

**Commit**: `feat(ui-shell): target frames and system menu`

---

### T15: wireRoom integration + hotkey migration

**What**: Sync new fields; publish `__GAME_STATE__.ui` + `player.activeEffects` + target fields; move hotkeys from `room.ts` to window manager; mount all panels after join.
**Where**: `client/src/net/room.ts`, `client/src/test-hook.ts`
**Depends on**: T8, T9, T10, T11, T12, T13, T14
**Requirement**: UI28-34, UI28-51, UI28-58

**Done when**:

- [ ] `room-ui-shell.spec.ts` green (quest tracker + ui flags + effects)
- [ ] No duplicate inventory key listener in `room.ts`
- [ ] Gate: `nx test client`

**Tests**: unit | **Gate**: quick (client)

**Commit**: `feat(ui-shell): wireRoom UI state sync and hotkey migration`

---

### T16: Connect flow + party invite from target

**What**: Pass `accountName` on join; wire party invite + trade from target context; party panel reads live HP from state.
**Where**: `client/src/net/room.ts`, `target-frame.ts`, `party-panel.ts`
**Depends on**: T15
**Requirement**: UI28-38, UI28-11

**Done when**:

- [ ] Invite uses target session id
- [ ] Party HP updates when `wireRoom` player patch fires
- [ ] Gate: `nx test client`

**Tests**: unit | **Gate**: quick (client)

**Commit**: `feat(ui-shell): join account wiring and target context actions`

---

### T17: Regression sweep — existing client panels

**What**: Fix any broken specs (`shop-window`, `npc-dialog`, `hotbar`, `quest-log` aliases); ensure `main.ts` does not mount game panels before join.
**Where**: touched `client/src/**/*.spec.ts`, `main.ts`
**Depends on**: T16
**Requirement**: UI28-60 (partial)

**Done when**:

- [ ] `nx test client` all green
- [ ] No test file >10 s

**Tests**: unit | **Gate**: quick (client)

**Commit**: `fix(ui-shell): client panel regression after shell refactor`

---

### T18: Full monorepo gate

**What**: Run full gate; fix lint/build issues from schema migration.
**Where**: repo-wide
**Depends on**: T17
**Requirement**: UI28-60

**Done when**:

- [ ] `nx run-many -t build lint test` green
- [ ] All 60 ACs mapped in validation prep

**Tests**: gate | **Gate**: build

**Commit**: `chore(ui-shell): phase 28 gate green`

---

## Parallel Execution Map

```
Phase 1:  T1 ──→ T2

Phase 2:  T2 ──→ T3 ──→ T4 ──→ T5

Phase 3:  T5 ──→ T6 ──→ T7

Phase 4:  T7 complete, then:
            ├── T8 [P]
            ├── T9 [P]
            ├── T10 [P]
            ├── T11 [P]
            ├── T12 [P]
            ├── T13 [P]
            └── T14 [P]

Phase 5:  T14 done → T15 ──→ T16 ──→ T17

Phase 6:  T17 ──→ T18
```

---

## Task Granularity Check

| Task | Scope | Status |
| ---- | ----- | ------ |
| T1: Weight pure functions | 1 module | ✅ Granular |
| T2: Weight seed | 1 schema + parser | ✅ Granular |
| T3: Character list API | 1 API + repo | ✅ Granular |
| T4: Join + weight replicate | 1 room concern | ✅ Granular |
| T5: Effects + aggro schema | 1 schema concern | ✅ Granular |
| T6: Window manager | 1 manager + vitals | ✅ Granular |
| T7: Login/select boot | 2 screens + boot | ✅ Granular |
| T8–T14: One panel each | 1 panel / task | ✅ Granular |
| T15: wireRoom integration | 1 wiring task | ✅ Granular |
| T16: Context actions | 1 wiring task | ✅ Granular |
| T17: Regression | sweep | ✅ Granular |
| T18: Gate | gate | ✅ Granular |

---

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| ---- | ---------------------- | ------------- | ------ |
| T1 | None | Phase1 start | ✅ Match |
| T2 | T1 | T1 → T2 | ✅ Match |
| T3 | T2 | T2 → T3 | ✅ Match |
| T4 | T3 | T3 → T4 | ✅ Match |
| T5 | T4 | T4 → T5 | ✅ Match |
| T6 | T5 | T5 → T6 | ✅ Match |
| T7 | T6 | T6 → T7 | ✅ Match |
| T8 | T7 | T7 → T8 | ✅ Match |
| T9 | T7 | T7 → T9 | ✅ Match |
| T10 | T7 | T7 → T10 | ✅ Match |
| T11 | T7 | T7 → T11 | ✅ Match |
| T12 | T7 | T7 → T12 | ✅ Match |
| T13 | T7 | T7 → T13 | ✅ Match |
| T14 | T7 | T7 → T14 | ✅ Match |
| T15 | T8–T14 | T14 → T15 | ✅ Match |
| T16 | T15 | T15 → T16 | ✅ Match |
| T17 | T16 | T16 → T17 | ✅ Match |
| T18 | T17 | T17 → T18 | ✅ Match |

---

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| ---- | --------------------------- | --------------- | --------- | ------ |
| T1 | game-core inventory | unit | unit | ✅ OK |
| T2 | seed items.weight | seed | seed | ✅ OK |
| T3 | character repo + API | unit | unit | ✅ OK |
| T4 | TownRoom join/weight | room | room | ✅ OK |
| T5 | schema effects/aggro | room | room | ✅ OK |
| T6 | window-manager + vitals | unit | unit | ✅ OK |
| T7 | login/select DOM | unit | unit | ✅ OK |
| T8 | inventory grid DOM | unit | unit | ✅ OK |
| T9 | skill window DOM | unit | unit | ✅ OK |
| T10 | quest DOM | unit | unit | ✅ OK |
| T11 | party DOM | unit | unit | ✅ OK |
| T12 | minimap DOM | unit | unit | ✅ OK |
| T13 | effect bars DOM | unit | unit | ✅ OK |
| T14 | target/system DOM | unit | unit | ✅ OK |
| T15 | wireRoom | unit | unit | ✅ OK |
| T16 | wireRoom handlers | unit | unit | ✅ OK |
| T17 | regression | unit | unit | ✅ OK |
| T18 | gate | gate | gate | ✅ OK |

**AC coverage:** All **60** requirement IDs (UI28-01 … UI28-60) map to tasks T1–T18 (T18 = UI28-60 gate; UI28-01–59 distributed across T1–T17 as listed per task `Requirement` fields and matrix rows).
