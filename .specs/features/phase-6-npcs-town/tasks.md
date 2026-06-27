# Phase 6 — NPCs & Functional Town Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and
follow its Execute flow and Critical Rules.** This repo wraps it with
`spec-driven-execution` (Planner → Implementer → Verifier, **autonomous-first**);
honor server-authority (AD-001) and the four test layers (AD-010).

**If the skill cannot be activated, STOP and tell the user — do not proceed
without it.**

---

**Design**: `.specs/features/phase-6-npcs-town/design.md`
**Status**: Draft

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec — confirm before Execute.
> Guidelines found: `AGENTS.md` (4 test layers + server-authority + seeded RNG),
> `.cursor/skills/spec-driven-execution/SKILL.md` (test gate table),
> `AD-010` (gate commands), `AD-011` (temp DB per seed test).

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| Peace zone geometry | unit | P6-R01 ACs 1–2; boundary ±20 inclusive | `libs/game-core/src/**/*.spec.ts` | `nx test game-core` |
| Shop transaction pure logic | unit | P6-R08–R09 buy/sell math; insufficient adena/items | `server/src/rooms/shop-transaction.spec.ts` | `nx test server` |
| NPC actions (proximity/heal/starter) | unit | P6-R11–R13 pure branches | `server/src/rooms/npc-actions.spec.ts` | `nx test server` |
| Combat peace guards | unit | P6-R02–R03 resolver rejects in zone | `server/src/rooms/combat-resolver.spec.ts` | `nx test server` |
| Merchant + NPC spawn seed | seed | P6-R06–R07 ACs 1–2; L2J buylist prices | `server/src/seed/**/*.spec.ts` | `nx test server` |
| Character adena default | unit | P6-R05 AC 3; createCharacter adena=1000 | `server/src/db/character-repository.spec.ts` | `nx test server` |
| TownRoom NPC + shop + peace | room-integration | P6-R02–R13, P6-R14; buy 1000→897; heal; starterKit | `server/src/rooms/TownRoom.spec.ts` | `nx test server` |
| Client NPC mesh + shop/dialog DOM | unit | P6-R15–R17 ACs 2–3 | `client/src/**/*.spec.ts` | `nx test client` |
| `__GAME_STATE__` adena/items hooks | unit | P6-R18 AC 4 | `client/src/test-hook.spec.ts` | `nx test client` |
| Town NPC shop peace E2E | e2e | P6-R19 ACs 5–6 | `client-e2e/src/town-npc.spec.ts` | `nx e2e client-e2e` |
| Schema-only fields (`adena`, `NpcState`) | none | Build + lint gate | — | `nx run-many -t build lint` |

## Parallelism Assessment

> Generated from codebase — confirm before Execute.

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
| --------- | -------------- | --------------- | -------- |
| unit (game-core) | Yes | Pure functions | `libs/game-core/src/*.spec.ts` |
| unit + seed (server) | Yes | Temp DB per test (`mkdtempSync`); AD-011 | `server/src/seed/**/*.spec.ts` |
| room-integration | Yes | `@colyseus/testing` `boot()` per suite; temp/in-memory DB | `TownRoom.spec.ts` `seededCombatDb()` pattern |
| unit (client) | Yes | DOM/jsdom isolated per test | `client/src/*.spec.ts` |
| e2e (Playwright) | No | Shared dev server + single `town` room; `workers: 1` | `client-e2e/playwright.config.ts` |

## Gate Check Commands

> Generated from codebase — confirm before Execute.

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick (game-core) | After T1 | `nx test game-core` |
| Quick (server) | After T2–T9 | `nx test server` |
| Quick (client) | After T10–T13 | `nx test client` |
| Full | After T14 / phase completion | `nx affected -t test lint` and `nx e2e client-e2e` |
| Build | After T6 (schema-only) | `nx run-many -t build lint` |

---

## Execution Plan

**5 phases** (14 tasks).

### Phase 1: Shared rules + schema (Parallel roots)

```
     ┌──→ T2 [P]
T1 ──┤
     └──→ T3 [P]
```

### Phase 2: Server pure modules (Parallel after Phase 1)

```
T1 ──→ T4
T2 ──→ T5
T1,T6-deps ──→ T6 (after T1 only)
```

### Phase 3: Schema sync + persistence (Parallel)

```
T2 ──→ T7 [P]
T2 ──→ T9 [P]
```

### Phase 4: Room integration (Sequential)

```
T4,T5,T6,T7,T9 ──→ T8
```

### Phase 5: Client (Parallel after T8)

```
T8 ──→ T10 ──┬──→ T11 [P]
             ├──→ T12 [P]
             └──→ T13 [P]
```

### Phase 6: E2E (Sequential)

```
T11,T12,T13 ──→ T14
```

---

## Task Breakdown

### T1: Add peace-zone constant to game-core `[game-core]`

**What**: Export `PEACE_ZONE`, `NPC_INTERACT_RADIUS` (3.0), and `isInPeaceZone(x,z)`.
**Where**: `libs/game-core/src/peace-zone.ts` (+ spec), `libs/game-core/src/index.ts`
**Depends on**: None
**Reuses**: `world-constants` village scale; L-001 vitest `resolve.alias`
**Requirement**: P6-R01

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] `isInPeaceZone(0,0)` is **true**; `(25,0)` is **false**
- [ ] Corners `(±20, ±20)` inclusive **true**; `(−20.1, 0)` / `(0, 20.1)` **false**
- [ ] `NPC_INTERACT_RADIUS === 3.0`
- [ ] Exported from `index.ts`
- [ ] Gate check passes: `nx test game-core`
- [ ] Test count: **+4** tests pass (no silent deletions)

**Tests**: unit
**Gate**: quick (game-core)

**Commit**: `feat(game-core): add peace zone and NPC interact radius`

---

### T2: Add DB tables for adena, items, merchant, NPC spawns `[seed]`

**What**: Schema + `client.ts` DDL for `merchant_items`, `npc_spawns`, `character_items`; extend `characters` with `adena`, `starter_kit_granted`.
**Where**: `server/src/db/schema.ts`, `server/src/db/client.ts`, `server/src/db/schema.spec.ts`
**Depends on**: None
**Reuses**: Existing Drizzle patterns; AD-011
**Requirement**: P6-R05, P6-R06, P6-R07, P6-R08

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Tables created on `getDb()` boot
- [ ] `characters.adena` defaults to **1000**
- [ ] Gate check passes: `nx test server`
- [ ] Test count: **+3** tests pass (no silent deletions)

**Tests**: unit (schema)
**Gate**: quick (server)

**Commit**: `feat(db): add merchant items npc spawns and adena columns`

---

### T3: Seed merchant items + NPC spawns from fixtures `[seed]`

**What**: Fixture `buylist_30004.xml` (3 items), `npc_spawns.json`; parsers + seeders; wire into `runSeed`.
**Where**: `server/src/seed/__fixtures__/`, `server/src/seed/parsers/`, `server/src/seed/seeders/`, `server/src/seed/seed.ts`
**Depends on**: T2
**Reuses**: `parseNpcs` / `seedNpcs` patterns; AD-012 fixtures; idempotent transaction reset
**Requirement**: P6-R06, P6-R07

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Katerina lists item **1060** buy **103** sell **51**, **1835** buy **8** sell **4**, **17** buy **2** sell **1**
- [ ] NPC spawns: **30004** at `(−6, −8)`, **30006** at `(4, 10)`
- [ ] `runSeed` resets + inserts new tables
- [ ] Gate check passes: `nx test server`
- [ ] Test count: **+4** tests pass (no silent deletions)

**Tests**: seed
**Gate**: quick (server)

**Commit**: `feat(seed): add Katerina shop and TI NPC spawn positions`

---

### T4: Add `shop-transaction` pure module `[server]`

**What**: `buyItem` / `sellItem` with adena and count validation (no I/O).
**Where**: `server/src/rooms/shop-transaction.ts` (+ spec)
**Depends on**: T1
**Reuses**: Listing row type from schema
**Requirement**: P6-R08, P6-R09

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Buy 1× **1060** at price **103** from adena **1000** → **897**, count **1**
- [ ] Buy rejected when adena **50**
- [ ] Sell 1× at sell **51** from count **2**, adena **897** → **948**, count **1**
- [ ] Sell rejected when count **0**
- [ ] Gate check passes: `nx test server`
- [ ] Test count: **+5** tests pass (no silent deletions)

**Tests**: unit
**Gate**: quick (server)

**Commit**: `feat(server): add shop buy/sell transaction module`

---

### T5: Add `npc-actions` pure module `[server]`

**What**: `canInteract`, `applyHeal`, `applyStarterKit` pure functions.
**Where**: `server/src/rooms/npc-actions.ts` (+ spec)
**Depends on**: T1
**Reuses**: `horizontalDistance` from game-core; `NPC_INTERACT_RADIUS`
**Requirement**: P6-R11, P6-R12, P6-R13

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Distance **3.0** m → interact **true**; **3.1** m → **false**
- [ ] Heal: `hp=40` → **100**
- [ ] Starter kit: grants **+3** item **1060** once; second call no-op
- [ ] Gate check passes: `nx test server`
- [ ] Test count: **+5** tests pass (no silent deletions)

**Tests**: unit
**Gate**: quick (server)

**Commit**: `feat(server): add NPC proximity heal and starter kit actions`

---

### T6: Add peace-zone guards to combat-resolver + mob-ai `[server]`

**What**: Early-return zero damage in peace zone for player attack, Power Strike, mob attack; clear mob target when player in zone.
**Where**: `server/src/rooms/combat-resolver.ts`, `server/src/rooms/mob-ai.ts` (+ specs)
**Depends on**: T1
**Reuses**: `isInPeaceZone`; existing resolver structure (Phase 4–5)
**Requirement**: P6-R02, P6-R03, P6-R04

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] `resolvePlayerAttack` at `(0,0)` returns damage **0**
- [ ] `resolvePowerStrike` at `(0,0)` returns damage **0**, `mpCost=0`
- [ ] `resolveMobAttack` vs target at `(0,0)` returns damage **0**
- [ ] Mob AI clears target when player enters peace zone
- [ ] Gate check passes: `nx test server`
- [ ] Test count: **+6** tests pass (no silent deletions)

**Tests**: unit
**Gate**: quick (server)

**Commit**: `feat(server): block combat damage inside peace zone`

---

### T7: Add `NpcState`, `PlayerState.adena`, item stacks to schema `[server]`

**What**: Colyseus schema types for NPCs, adena, and item counts map.
**Where**: `server/src/rooms/schema/NpcState.ts`, `server/src/rooms/schema/ItemStackState.ts`, `TownState.ts`, `PlayerState` in `TownState.ts`
**Depends on**: T2
**Reuses**: `MobState` map pattern
**Requirement**: P6-R14, P6-R05

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] `TownState` has `npcs` MapSchema
- [ ] `PlayerState` has `adena` and `items` map
- [ ] Build passes: `nx run-many -t build lint`
- [ ] Test count: **0** new tests (schema-only)

**Tests**: none
**Gate**: build

**Commit**: `feat(server): add NpcState and player adena to room schema`

---

### T8: Wire TownRoom NPC spawn, shop, interact, peace zone room tests `[server]`

**What**: Load NPCs from DB; `onMessage` for `interact`/`buy`/`sell`/`npcAction`; peace-zone room-integration tests.
**Where**: `server/src/rooms/TownRoom.ts`, `server/src/rooms/TownRoom.spec.ts`
**Depends on**: T3, T4, T5, T6, T7, T9
**Reuses**: `scheduleDebouncedSave`; `seededCombatDb` pattern; injectable `nowMs`/`combatRng`
**Requirement**: P6-R02–R14 (integration slice)

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Room boots with **2** NPCs in `state.npcs`
- [ ] Buy potion: adena **1000→897**, item **1060** count **1** at Katerina proximity
- [ ] Buy rejected at **3.1** m and insufficient adena
- [ ] Sell 1× potion: adena **897→948**
- [ ] Heal **40→100**; starter kit **+3** once
- [ ] Attack + Power Strike at `(0,0)` deal **0** damage
- [ ] Gate check passes: `nx test server`
- [ ] Test count: **+10** tests pass (no silent deletions)

**Tests**: room-integration
**Gate**: quick (server)

**Commit**: `feat(server): TownRoom NPC shop interact and peace zone`

---

### T9: Extend character-repository for adena and items `[server]`

**What**: Load/save adena, starterKitGranted, character_items; sync on join/persist.
**Where**: `server/src/db/character-repository.ts` (+ spec)
**Depends on**: T2
**Reuses**: `saveCharacter` upsert pattern
**Requirement**: P6-R10

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] `createCharacter` returns `adena=1000`
- [ ] Save/load round-trips adena and item counts
- [ ] `starterKitGranted` persists
- [ ] Gate check passes: `nx test server`
- [ ] Test count: **+4** tests pass (no silent deletions)

**Tests**: unit
**Gate**: quick (server)

**Commit**: `feat(server): persist adena and character items`

---

### T10: Procedural NPC renderer + scene wiring `[client]`

**What**: `buildNpcMesh` procedural geometry; place NPCs from room state in scene loop.
**Where**: `client/src/scene/npc-renderer.ts` (+ spec), `client/src/scene/renderer.ts`, `client/src/net/room.ts`
**Depends on**: T8
**Reuses**: AD-005 primitive meshes; mob renderer pattern
**Requirement**: P6-R15

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] `buildNpcMesh` returns `THREE.Group` with ≥1 `Mesh`
- [ ] Merchant vs Helper use distinct colors
- [ ] NPC meshes update from `state.npcs` onChange
- [ ] Gate check passes: `nx test client`
- [ ] Test count: **+3** tests pass (no silent deletions)

**Tests**: unit
**Gate**: quick (client)

**Commit**: `feat(client): procedural NPC renderer`

---

### T11: DOM shop window `[client]`

**What**: `#shop-window` lists merchant items; Buy/Sell sends room messages only.
**Where**: `client/src/ui/shop-window.ts` (+ spec), `client/src/main.ts`
**Depends on**: T10
**Reuses**: AD-009 DOM-testable UI
**Requirement**: P6-R16

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Shop rows show items **1060**/**1835**/**17** with prices **103**/**8**/**2**
- [ ] Buy button calls `room.send('buy', …)` (mocked in unit test)
- [ ] Gate check passes: `nx test client`
- [ ] Test count: **+3** tests pass (no silent deletions)

**Tests**: unit
**Gate**: quick (client)

**Commit**: `feat(client): merchant shop DOM window`

---

### T12: DOM utility dialog + proximity prompt `[client]`

**What**: `#npc-dialog` for Roxxy; proximity "Press E" / interact key; opens shop or dialog by NPC type.
**Where**: `client/src/ui/npc-dialog.ts`, `client/src/npc-interaction.ts` (+ specs)
**Depends on**: T10
**Reuses**: `horizontalDistance`; `interact` message flow
**Requirement**: P6-R17, P6-R11 (client UX)

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Dialog exposes Heal and Starter Kit buttons sending `npcAction`
- [ ] Proximity within **3.0** m enables interact prompt
- [ ] Katerina opens shop; Roxxy opens dialog
- [ ] Gate check passes: `nx test client`
- [ ] Test count: **+4** tests pass (no silent deletions)

**Tests**: unit
**Gate**: quick (client)

**Commit**: `feat(client): NPC dialog and proximity interaction`

---

### T13: Extend `__GAME_STATE__` and test hooks `[client]`

**What**: Add `adena`, `items`, `nearbyNpcId`; hooks `__interact__`, `__buyItem__`, `__sellItem__`, `__npcAction__`.
**Where**: `client/src/test-hook.ts`, `client/src/net/room.ts` (+ spec)
**Depends on**: T8
**Reuses**: AD-009; Phase 4–5 hook patterns
**Requirement**: P6-R18

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] After join `adena === 1000`
- [ ] Schema onChange updates `items` map in hook
- [ ] Hooks callable from Playwright
- [ ] Gate check passes: `nx test client`
- [ ] Test count: **+4** tests pass (no silent deletions)

**Tests**: unit
**Gate**: quick (client)

**Commit**: `feat(client): game state hooks for adena and NPC actions`

---

### T14: E2E — town shop buy and peace zone `[e2e]`

**What**: Playwright: move to Katerina, buy Healing Potion, assert adena **897**; at `(0,0)` combat deals no damage.
**Where**: `client-e2e/src/town-npc.spec.ts`
**Depends on**: T8, T11, T12, T13
**Reuses**: `combat.spec.ts` / `power-strike.spec.ts` move poll helpers; serial describe
**Requirement**: P6-R19

**Tools**:

- MCP: `user-playwright` (optional)
- Skill: NONE

**Done when**:

- [ ] Buy potion: `__GAME_STATE__.adena === 897`, item **1060** count ≥ **1**
- [ ] At village center: `__attack__` and `__useSkill__` do not reduce mob HP
- [ ] Gate check passes: `nx e2e client-e2e`
- [ ] Test count: **+2** e2e tests pass (no silent deletions)

**Tests**: e2e
**Gate**: full

**Commit**: `test(e2e): town NPC shop and peace zone`

---

## Parallel Execution Map

```
Phase 1 (Parallel):
  T1 [P]  T2 [P]  T3 (needs T2)

Phase 2 (Parallel after T1,T2):
  T4 (needs T1)
  T5 (needs T1)
  T6 (needs T1)
  T7 [P] (needs T2)
  T9 [P] (needs T2)

Phase 3 (Sequential):
  T8 (needs T3,T4,T5,T6,T7,T9)

Phase 4 (Parallel after T8):
  T10 ──┬──→ T11 [P]
        ├──→ T12 [P]
        └──→ T13 [P]

Phase 5 (Sequential):
  T14 (needs T8,T11,T12,T13)
```

---

## Task Granularity Check

| Task | Scope | Status |
| ---- | ----- | ------ |
| T1: peace-zone constant | 1 module + export | ✅ Granular |
| T2: DB schema tables | 1 schema migration slice | ✅ Granular |
| T3: merchant + NPC seed | 2 seeders + fixtures | ✅ Granular |
| T4: shop-transaction | 1 pure module | ✅ Granular |
| T5: npc-actions | 1 pure module | ✅ Granular |
| T6: combat peace guards | 2 files, 1 concern (peace block) | ✅ Granular |
| T7: schema NpcState/adena | schema types only | ✅ Granular |
| T8: TownRoom wiring | 1 room + room tests | ✅ Granular |
| T9: character-repository extend | 1 repository concern | ✅ Granular |
| T10: NPC renderer | 1 renderer module | ✅ Granular |
| T11: shop DOM | 1 UI component | ✅ Granular |
| T12: dialog + proximity | 2 UI modules, 1 interaction flow | ✅ Granular |
| T13: test hooks | 1 hook contract | ✅ Granular |
| T14: e2e spec | 1 Playwright file | ✅ Granular |

**Granularity check**: all tasks pass.

---

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| ---- | ---------------------- | ------------- | ------ |
| T1 | None | Phase 1 root [P] | ✅ Match |
| T2 | None | Phase 1 root [P] | ✅ Match |
| T3 | T2 | After T2 in Phase 1 | ✅ Match |
| T4 | T1 | T1 → T4 | ✅ Match |
| T5 | T1 | T1 → T5 | ✅ Match |
| T6 | T1 | T1 → T6 | ✅ Match |
| T7 | T2 | T2 → T7 [P] | ✅ Match |
| T8 | T3,T4,T5,T6,T7,T9 | All → T8 | ✅ Match |
| T9 | T2 | T2 → T9 [P] | ✅ Match |
| T10 | T8 | T8 → T10 | ✅ Match |
| T11 | T10 | T10 → T11 [P] | ✅ Match |
| T12 | T10 | T10 → T12 [P] | ✅ Match |
| T13 | T8 | T8 → T13 (parallel with T10 chain) | ✅ Match |
| T14 | T8,T11,T12,T13 | T11,T12,T13 → T14 | ✅ Match |

**Diagram-definition cross-check**: all tasks pass.

---

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| ---- | --------------------------- | --------------- | --------- | ------ |
| T1 | Peace zone geometry | unit | unit | ✅ OK |
| T2 | DB schema | unit | unit | ✅ OK |
| T3 | Merchant + NPC seed | seed | seed | ✅ OK |
| T4 | Shop transaction | unit | unit | ✅ OK |
| T5 | NPC actions | unit | unit | ✅ OK |
| T6 | Combat peace guards | unit | unit | ✅ OK |
| T7 | Schema fields | none | none | ✅ OK |
| T8 | TownRoom integration | room-integration | room-integration | ✅ OK |
| T9 | Character persistence | unit | unit | ✅ OK |
| T10 | NPC renderer | unit | unit | ✅ OK |
| T11 | Shop DOM | unit | unit | ✅ OK |
| T12 | Dialog + proximity | unit | unit | ✅ OK |
| T13 | Test hooks | unit | unit | ✅ OK |
| T14 | E2E town loop | e2e | e2e | ✅ OK |

**Test co-location validation**: all tasks pass.

---

## Requirement → Task Map

| Requirement | Task(s) |
| ----------- | ------- |
| P6-R01 | T1 |
| P6-R02 | T6, T8 |
| P6-R03 | T6, T8 |
| P6-R04 | T6, T8 |
| P6-R05 | T2, T7, T9 |
| P6-R06 | T3 |
| P6-R07 | T3 |
| P6-R08 | T4, T8 |
| P6-R09 | T4, T8 |
| P6-R10 | T9, T8 |
| P6-R11 | T5, T8, T12 |
| P6-R12 | T5, T8, T12 |
| P6-R13 | T5, T8, T12 |
| P6-R14 | T7, T8 |
| P6-R15 | T10 |
| P6-R16 | T11 |
| P6-R17 | T12 |
| P6-R18 | T13 |
| P6-R19 | T14 |

---

## Ordered Task Summary

| # | Task | Layer | Tests | Depends |
| - | ---- | ----- | ----- | ------- |
| T1 | Peace zone constant | game-core | unit | — |
| T2 | DB tables adena/shop/spawns | seed | unit | — |
| T3 | Seed merchant + NPC spawns | seed | seed | T2 |
| T4 | shop-transaction module | server | unit | T1 |
| T5 | npc-actions module | server | unit | T1 |
| T6 | Combat peace guards | server | unit | T1 |
| T7 | NpcState + adena schema | server | none | T2 |
| T8 | TownRoom NPC shop peace | server | room-integration | T3,T4,T5,T6,T7,T9 |
| T9 | character-repository adena/items | server | unit | T2 |
| T10 | Procedural NPC renderer | client | unit | T8 |
| T11 | Shop DOM window | client | unit | T10 |
| T12 | Dialog + proximity | client | unit | T10 |
| T13 | `__GAME_STATE__` hooks | client | unit | T8 |
| T14 | E2E town shop + peace | e2e | e2e | T8,T11,T12,T13 |
