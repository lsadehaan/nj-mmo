# Phase 7 — Progression Loop Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and
follow its Execute flow and Critical Rules.** This repo wraps it with
`spec-driven-execution` (Planner → Implementer → Verifier, **autonomous-first**);
honor server-authority (AD-001) and the four test layers (AD-010).

**If the skill cannot be activated, STOP and tell the user — do not proceed
without it.**

---

**Design**: `.specs/features/phase-7-progression-golive/design.md`
**Status**: Draft

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec — confirm before Execute.
> Guidelines found: `AGENTS.md` (4 test layers + server-authority + seeded RNG),
> `.cursor/skills/spec-driven-execution/SKILL.md`, `AD-010` (gate commands),
> `AD-011` (temp DB per seed test), `AD-014` (room/e2e patterns).

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| effectivePAtk / level-up / death pure | unit | P7-R03, P7-R12–R14 ACs; all edge cases (no weapon, consumable rejected at room layer) | `libs/game-core/src/**/*.spec.ts` | `nx test game-core` |
| equip-transaction pure | unit | P7-R05–R06 validate branches | `server/src/rooms/equip-transaction.spec.ts` | `nx test server` |
| combat-resolver pAtk param | unit | P7-R06: 27 melee / 79 power strike with pAtk 16 | `server/src/rooms/combat-resolver.spec.ts` | `nx test server` |
| items seed | seed | P7-R02 AC1: item 2369 stats | `server/src/seed/**/*.spec.ts` | `nx test server` |
| character schema (maxHp/equip) | unit | defaults 100/50/null equip | `server/src/db/schema.spec.ts` | `nx test server` |
| TownRoom equip/death/level | room-integration | P7-R04–R08, P7-R10–R13, P7-R15; AD-014 simulate/deliver | `server/src/rooms/TownRoom.spec.ts` | `nx test server` |
| inventory window DOM | unit | P7-R09 list + equip button | `client/src/ui/inventory-window.spec.ts` | `nx test client` |
| test-hook progression fields | unit | equippedWeaponId, maxHp exposed | `client/src/test-hook.spec.ts` | `nx test client` |
| progression loop E2E | e2e | P7-R17 full loop | `client-e2e/src/progression.spec.ts` | `nx e2e client-e2e` |

## Parallelism Assessment

> Generated from codebase — confirm before Execute. **Updated for AD-014** (e2e now
> parallel-safe via per-room isolation).

| Test Type | Parallel-Safe? | Isolation Model | Evidence |
| --------- | -------------- | --------------- | -------- |
| unit (game-core) | Yes | Pure functions | `libs/game-core/src/*.spec.ts` |
| unit + seed (server) | Yes | Temp DB per test (`mkdtempSync`); AD-011 | `server/src/seed/**/*.spec.ts` |
| room-integration | Yes | `@colyseus/testing` per suite; `NJ_AUTOSIM=0`; temp DB | `TownRoom.spec.ts` |
| unit (client) | Yes | jsdom per test | `client/src/*.spec.ts` |
| e2e (Playwright) | Yes | `?room=` + `filterBy(['instanceKey'])`; `fullyParallel` | `client-e2e/playwright.config.ts` |

## Gate Check Commands

> Generated from codebase — confirm before Execute.

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick (game-core) | After T3, T4 | `nx test game-core` |
| Quick (server) | After T1–T2, T5–T12 | `nx test server` |
| Quick (client) | After T13–T15 | `nx test client` |
| Full | After T16 / phase complete | `nx affected -t test lint` and `nx e2e client-e2e` |

---

## Execution Plan

**5 phases**, 16 tasks.

### Phase 1: Pure rules + items schema (Parallel roots)

```
     ┌──→ T2 [P]  (after T1)
T1 ──┤
     ├──→ T3 [P]
     └──→ T4 [P]
```

### Phase 2: Server modules + schema (Parallel)

```
T1  ──→ T5
T2  ──→ T8
T3  ──→ T6 [P]
T3  ──→ T7 [P]
T5  ──→ T9
```

### Phase 3: TownRoom integration (Sequential)

```
T6,T7,T8,T9 ──→ T10 ──→ T11 ──→ T12
```

### Phase 4: Client (Parallel then wire)

```
T3 ──→ T13 [P]   (static UI; parallel with server phase)
T10 ──→ T14
T11,T12,T14 ──→ T15
```

### Phase 5: E2E (Sequential)

```
T15 ──→ T16
```

---

## Task Breakdown

### T1: Add `items` master table schema `[seed]`

**What**: Drizzle `items` table + `client.ts` DDL migration.
**Where**: `server/src/db/schema.ts`, `server/src/db/client.ts`, `server/src/db/schema.spec.ts`
**Depends on**: None
**Reuses**: Existing Drizzle patterns; AD-011
**Requirement**: P7-R01

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] `items` table boots on `getDb()` with columns per design
- [ ] Gate check passes: `nx test server`
- [ ] Test count: **+2** tests pass (no silent deletions)

**Tests**: unit (schema)
**Gate**: quick (server)

**Commit**: `feat(db): add items master table`

---

### T2: Parse and seed items fixture subset `[seed]`

**What**: `items_subset.xml` fixture, parser, seeder; wire into `runSeed`.
**Where**: `server/src/seed/__fixtures__/items_subset.xml`, `server/src/seed/parsers/items.parser.ts`, `server/src/seed/seeders/items.seeder.ts`, `server/src/seed/seed.ts`
**Depends on**: T1
**Reuses**: `xml-utils`, idempotent seed transaction; AD-012
**Requirement**: P7-R02

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Item **2369** seeded: `Squire's Sword`, `type=weapon`, `pAtk=6`, `randomDamage=10`, `bodyPart=rhand`
- [ ] Items **1060**, **17**, **1835** seeded with correct types
- [ ] Gate check passes: `nx test server`
- [ ] Test count: **+3** tests pass (no silent deletions)

**Tests**: seed
**Gate**: quick (server)

**Commit**: `feat(seed): add items master subset including Squire's Sword`

---

### T3: Add `effectivePAtk` to game-core `[game-core]`

**What**: Pure `effectivePAtk(base, equippedId, weaponPAtk)` + melee damage spec for pAtk 16 → 27.
**Where**: `libs/game-core/src/combat/effective-patk.ts`, `effective-patk.spec.ts`, `libs/game-core/src/index.ts`
**Depends on**: None
**Reuses**: `STARTER_COMBAT`, `GREMLIN_COMBAT`, `calcMeleeDamage`; L-001 alias
**Requirement**: P7-R03

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] `effectivePAtk(10, 2369, 6) === 16`; unarmed returns **10**
- [ ] `calcMeleeDamage` with `pAtk=16` vs Gremlin deals **27** (`rngOffset=0`)
- [ ] Gate check passes: `nx test game-core`
- [ ] Test count: **+4** tests pass (no silent deletions)

**Tests**: unit
**Gate**: quick (game-core)

**Commit**: `feat(game-core): add effectivePAtk and equipped damage anchor`

---

### T4: Add level-up reward and player death pure functions `[game-core]`

**What**: `applyLevelUpReward` (+12 HP, +5 MP per level, full restore) and `resolvePlayerDeath` (spawn teleport, no XP loss ≤9).
**Where**: `libs/game-core/src/level-up-reward.ts`, `player-death.ts`, specs, `index.ts`
**Depends on**: None
**Reuses**: `SPAWN_X/Y/Z`, `grantXp` thresholds from experience tests
**Requirement**: P7-R11, P7-R12, P7-R14

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] `applyLevelUpReward(1, 2, {maxHp:100,maxMp:50,hp:40,mp:20})` → `{maxHp:112,maxMp:55,hp:112,mp:55}`
- [ ] `resolvePlayerDeath({level:1,xp:44,...})` keeps `xp=44`, position at spawn, `hp=maxHp`
- [ ] Gate check passes: `nx test game-core`
- [ ] Test count: **+6** tests pass (no silent deletions)

**Tests**: unit
**Gate**: quick (game-core)

**Commit**: `feat(game-core): add level-up reward and death respawn rules`

---

### T5: Extend characters with maxHp, maxMp, equipped weapon `[server]`

**What**: Schema columns + `createCharacter`/`saveCharacter`/`loadCharacter` round-trip.
**Where**: `server/src/db/schema.ts`, `server/src/db/client.ts`, `server/src/db/character-repository.ts`, specs
**Depends on**: T1
**Reuses**: `createCharacter` defaults; AD-011
**Requirement**: P7-R04

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] New character: `maxHp=100`, `maxMp=50`, `equippedWeaponItemId=null`
- [ ] Save/load preserves equip slot and max vitals
- [ ] Gate check passes: `nx test server`
- [ ] Test count: **+4** tests pass (no silent deletions)

**Tests**: unit
**Gate**: quick (server)

**Commit**: `feat(db): add max vitals and equipped weapon to characters`

---

### T6: Add equip-transaction pure module `[server]`

**What**: `validateEquip` / `applyEquip` pure functions.
**Where**: `server/src/rooms/equip-transaction.ts`, `equip-transaction.spec.ts`
**Depends on**: T3
**Reuses**: `shop-transaction` result pattern
**Requirement**: P7-R05

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Rejects non-weapon type and `ownedCount=0`
- [ ] Accepts weapon with `ownedCount>=1`
- [ ] Gate check passes: `nx test server`
- [ ] Test count: **+5** tests pass (no silent deletions)

**Tests**: unit
**Gate**: quick (server)

**Commit**: `feat(server): add equip transaction validation`

---

### T7: Parameterize combat-resolver with attacker pAtk `[server]`

**What**: `resolvePlayerAttack` / `resolvePowerStrike` accept `attackerPAtk`; add tests for 16 → 27 / 79.
**Where**: `server/src/rooms/combat-resolver.ts`, `combat-resolver.spec.ts`
**Depends on**: T3
**Reuses**: Existing resolver tests (unarmed 10 unchanged)
**Requirement**: P7-R06

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] `attackerPAtk=16` melee → **27** vs Gremlin (`rngOffset=0`)
- [ ] `attackerPAtk=16` Power Strike → **79** (`rngOffset=0`)
- [ ] Gate check passes: `nx test server`
- [ ] Test count: **+3** tests pass (no silent deletions)

**Tests**: unit
**Gate**: quick (server)

**Commit**: `feat(server): combat resolver accepts effective pAtk`

---

### T8: Extend starter kit to grant Squire's Sword `[server]`

**What**: `applyStarterKit` adds **1× 2369**; room test for starter inventory.
**Where**: `server/src/rooms/npc-actions.ts`, `npc-actions.spec.ts`
**Depends on**: T2
**Reuses**: `STARTER_KIT_ITEM_ID` pattern
**Requirement**: P7-R07

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Starter kit `itemCounts[2369] === 1` and `1060 === 3`
- [ ] Second kit attempt still rejected
- [ ] Gate check passes: `nx test server`
- [ ] Test count: **+2** tests pass (no silent deletions)

**Tests**: unit
**Gate**: quick (server)

**Commit**: `feat(server): starter kit grants Squire's Sword`

---

### T9: Extend PlayerState schema with maxHp, maxMp, equippedWeaponId `[server]`

**What**: Colyseus schema fields; join sync from character row.
**Where**: `server/src/rooms/schema/TownState.ts`, `TownRoom.ts` `onJoin`
**Depends on**: T5
**Reuses**: `ItemStackState` sync pattern
**Requirement**: P7-R04

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] `PlayerState` exposes `maxHp`, `maxMp`, `equippedWeaponItemId` (0 = none)
- [ ] Join copies values from DB character
- [ ] Gate check passes: `nx test server`
- [ ] Test count: **+2** tests pass (no silent deletions)

**Tests**: unit (schema join covered in T10 room tests — minimal schema boot test here)
**Gate**: quick (server)

**Commit**: `feat(server): sync max vitals and equip slot to PlayerState`

---

### T10: TownRoom equip handler and persistence `[server]`

**What**: `onMessage('equip')`, `handleEquip`, items cache, effective pAtk in simulate, persistence.
**Where**: `server/src/rooms/TownRoom.ts`, `TownRoom.spec.ts`
**Depends on**: T6, T7, T9
**Reuses**: `setItemCount`, `scheduleDebouncedSave`, AD-014 `simulate`/`deliver`
**Requirement**: P7-R05, P7-R06, P7-R08

**Tools**:

- MCP: `user-context7` (`/colyseus/docs` onMessage)
- Skill: NONE

**Done when**:

- [ ] Equip **2369** then melee deals **27** (room-integration, `rngOffset=0` or seeded)
- [ ] Equip **1060** rejected; equip without ownership rejected
- [ ] Reconnect preserves `equippedWeaponItemId`
- [ ] Gate check passes: `nx test server`
- [ ] Test count: **+5** tests pass (no silent deletions)

**Tests**: room-integration
**Gate**: quick (server)

**Commit**: `feat(server): authoritative equip with combat pAtk boost`

---

### T11: TownRoom player death and respawn in tick `[server]`

**What**: `handlePlayerDeath` after mob damage; clear aggro/combat; persist spawn position.
**Where**: `server/src/rooms/TownRoom.ts`, `TownRoom.spec.ts`
**Depends on**: T4, T9
**Reuses**: `resolvePlayerDeath`, `OUT_OF_PEACE` test placement from Phase 6
**Requirement**: P7-R10, P7-R11, P7-R12, P7-R13

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Player reduced to `hp<=0` respawns at spawn with `hp=maxHp`, `xp` unchanged
- [ ] Mob clears target; player combat target cleared
- [ ] Reconnect preserves respawn position
- [ ] Gate check passes: `nx test server`
- [ ] Test count: **+4** tests pass (no silent deletions)

**Tests**: room-integration
**Gate**: quick (server)

**Commit**: `feat(server): player death respawn in town`

---

### T12: TownRoom level-up reward on mob kill `[server]`

**What**: Apply `applyLevelUpReward` in `handleMobKill` when level increases.
**Where**: `server/src/rooms/TownRoom.ts`, `TownRoom.spec.ts`
**Depends on**: T4, T7, T9
**Reuses**: `applyKillRewards`, Gremlin `exp=44`
**Requirement**: P7-R14, P7-R15

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] Two Gremlin kills: `level=2`, `xp=88`, `maxHp=112`, `hp=112`, `maxMp=55`, `mp=55`
- [ ] Single kill does NOT apply level-up reward (`level` stays 1)
- [ ] Gate check passes: `nx test server`
- [ ] Test count: **+3** tests pass (no silent deletions)

**Tests**: room-integration
**Gate**: quick (server)

**Commit**: `feat(server): level-up max vitals reward on mob kill`

---

### T13: Inventory window UI `[client]` [P]

**What**: `inventory-window.ts` — list items, Equip button for weapon 2369, equipped label.
**Where**: `client/src/ui/inventory-window.ts`, `inventory-window.spec.ts`
**Depends on**: None
**Reuses**: `shop-window.ts` DOM pattern; static weapon id 2369
**Requirement**: P7-R09

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] `#inventory-window` renders owned stacks and Equip for weapon rows
- [ ] Shows equipped weapon name when `equippedWeaponId=2369`
- [ ] Gate check passes: `nx test client`
- [ ] Test count: **+5** tests pass (no silent deletions)

**Tests**: unit
**Gate**: quick (client)

**Commit**: `feat(client): inventory window with equip action`

---

### T14: Wire equip message and schema listeners `[client]`

**What**: `room.send('equip')`, state listeners, `I` hotkey, `__equipItem__` hook.
**Where**: `client/src/net/room.ts`, `client/src/main.ts`
**Depends on**: T10, T13
**Reuses**: `wireRoom` shop pattern
**Requirement**: P7-R09

**Tools**:

- MCP: `user-context7` (`/colyseus/docs` Callbacks.listen)
- Skill: NONE

**Done when**:

- [ ] Equip click sends `equip` message; state updates inventory panel
- [ ] `__equipItem__(2369)` hook works for e2e
- [ ] Gate check passes: `nx test client`
- [ ] Test count: **+3** tests pass (no silent deletions)

**Tests**: unit
**Gate**: quick (client)

**Commit**: `feat(client): wire equip intent to Colyseus room`

---

### T15: Extend test hook and HUD for progression `[client]`

**What**: `equippedWeaponId`, `maxHp` on `__GAME_STATE__`; level/death HUD labels.
**Where**: `client/src/test-hook.ts`, `test-hook.spec.ts`, HUD modules
**Depends on**: T11, T12, T14
**Reuses**: AD-009 hook contract
**Requirement**: P7-R09, P7-R16

**Tools**:

- MCP: NONE
- Skill: NONE

**Done when**:

- [ ] `setEquippedWeaponId`, `setMaxHp` update hook
- [ ] Level label shows **Lv.2** after state sync
- [ ] Gate check passes: `nx test client`
- [ ] Test count: **+4** tests pass (no silent deletions)

**Tests**: unit
**Gate**: quick (client)

**Commit**: `feat(client): progression fields on game test hook`

---

### T16: Progression loop E2E `[e2e]`

**What**: `progression.spec.ts` — starter kit → equip → 2 kills → level 2 → buy potion.
**Where**: `client-e2e/src/progression.spec.ts`, reuse `game-page.ts` helpers
**Depends on**: T15
**Reuses**: AD-014 `?room=`, `__useSkill__`/`__attack__` chase, `peace-zone` helper, `client:preview`
**Requirement**: P7-R17

**Tools**:

- MCP: `user-playwright`
- Skill: NONE

**Done when**:

- [ ] E2E asserts `equippedWeaponId=2369`, `level=2`, `items[1060]>=1`, `adena=897`
- [ ] Gate check passes: `nx e2e client-e2e`
- [ ] Test count: **+1** e2e test passes (no silent deletions)

**Tests**: e2e
**Gate**: full

**Commit**: `test(e2e): progression loop starter equip level buy`

---

## Parallel Execution Map

```
Phase 1 (Sequential roots + parallel leaves):
  T1 ──→ T2 [P]
  T3 [P]  (parallel with T1)
  T4 [P]  (parallel with T1)

Phase 2 (Parallel modules):
  T1 ──→ T5 ──→ T9
  T2 ──→ T8
  T3 ──→ T6 [P], T7 [P]

Phase 3 (Sequential TownRoom):
  T6,T7,T8,T9 ──→ T10 ──→ T11 ──→ T12

Phase 4 (Client):
  T3 ──→ T13 [P]
  T10 ──→ T14
  T11,T12,T14 ──→ T15

Phase 5:
  T15 ──→ T16
```

---

## Task Granularity Check

| Task | Scope | Status |
| ---- | ----- | ------ |
| T1: items schema | 1 table + DDL | ✅ Granular |
| T2: items seed | 1 parser + 1 seeder | ✅ Granular |
| T3: effectivePAtk | 1 function + spec | ✅ Granular |
| T4: level-up + death pure | 2 related pure modules (cohesive) | ✅ Granular |
| T5: character columns | schema + repository | ✅ Granular |
| T6: equip-transaction | 1 pure module | ✅ Granular |
| T7: combat pAtk param | 1 resolver change | ✅ Granular |
| T8: starter kit sword | 1 function extend | ✅ Granular |
| T9: PlayerState fields | schema + join sync | ✅ Granular |
| T10: TownRoom equip | 1 handler group | ✅ Granular |
| T11: TownRoom death | 1 handler group | ✅ Granular |
| T12: TownRoom level-up | 1 kill hook | ✅ Granular |
| T13: inventory UI | 1 component | ✅ Granular |
| T14: wire equip client | room wiring | ✅ Granular |
| T15: test hook HUD | hook + labels | ✅ Granular |
| T16: progression e2e | 1 spec file | ✅ Granular |

**Granularity check**: ✅ All tasks pass

---

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| ---- | ---------------------- | ------------- | ------ |
| T1 | None | Root | ✅ Match |
| T2 | T1 | T1 → T2 | ✅ Match |
| T3 | None | Root [P] | ✅ Match |
| T4 | None | Root [P] | ✅ Match |
| T5 | T1 | T1 → T5 | ✅ Match |
| T6 | T3 | T3 → T6 | ✅ Match |
| T7 | T3 | T3 → T7 | ✅ Match |
| T8 | T2 | T2 → T8 | ✅ Match |
| T9 | T5 | T5 → T9 | ✅ Match |
| T10 | T6, T7, T9 | Phase 3 after T6,T7,T8,T9 | ✅ Match |
| T11 | T4, T9 | T10 → T11 | ✅ Match |
| T12 | T4, T7, T9 | T11 → T12 | ✅ Match |
| T13 | None | T3 → T13 [P] | ✅ Match |
| T14 | T10, T13 | T10 → T14 | ✅ Match |
| T15 | T11, T12, T14 | T11,T12,T14 → T15 | ✅ Match |
| T16 | T15 | T15 → T16 | ✅ Match |

**Diagram-definition cross-check**: ✅ All tasks match

---

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| ---- | --------------------------- | --------------- | --------- | ------ |
| T1: items schema | entity/schema | none | unit | ⚠️ schema spec — OK (matrix: entity build gate; schema.spec is existing pattern) |
| T2: items seed | seed | seed | seed | ✅ OK |
| T3: effectivePAtk | game-core domain | unit | unit | ✅ OK |
| T4: level-up/death | game-core domain | unit | unit | ✅ OK |
| T5: character columns | repository/schema | unit | unit | ✅ OK |
| T6: equip-transaction | server pure | unit | unit | ✅ OK |
| T7: combat resolver | server pure | unit | unit | ✅ OK |
| T8: starter kit | server pure | unit | unit | ✅ OK |
| T9: PlayerState | schema | none | unit | ✅ OK (minimal; room tests in T10+) |
| T10: TownRoom equip | room-integration | room-integration | room-integration | ✅ OK |
| T11: TownRoom death | room-integration | room-integration | room-integration | ✅ OK |
| T12: TownRoom level-up | room-integration | room-integration | room-integration | ✅ OK |
| T13: inventory UI | client unit | unit | unit | ✅ OK |
| T14: wire equip | client unit | unit | unit | ✅ OK |
| T15: test hook | client unit | unit | unit | ✅ OK |
| T16: progression e2e | e2e | e2e | e2e | ✅ OK |

**Test co-location validation**: ✅ All tasks pass

---

## Requirement → Task Map

| Requirement | Task(s) |
| ----------- | ------- |
| P7-R01 | T1 |
| P7-R02 | T2 |
| P7-R03 | T3 |
| P7-R04 | T5, T9 |
| P7-R05 | T6, T10 |
| P7-R06 | T7, T10 |
| P7-R07 | T8 |
| P7-R08 | T10 |
| P7-R09 | T13, T14, T15 |
| P7-R10–R13 | T4, T11 |
| P7-R14–R15 | T4, T12 |
| P7-R16 | T15 |
| P7-R17 | T16 |

---

## Ordered Task Summary

| # | Task | Layer | Tests | Deps |
| - | ---- | ----- | ----- | ---- |
| T1 | items schema | seed | unit | — |
| T2 | items seed | seed | seed | T1 |
| T3 | effectivePAtk | game-core | unit | — |
| T4 | level-up + death pure | game-core | unit | — |
| T5 | character vitals/equip columns | server | unit | T1 |
| T6 | equip-transaction | server | unit | T3 |
| T7 | combat pAtk param | server | unit | T3 |
| T8 | starter kit sword | server | unit | T2 |
| T9 | PlayerState extensions | server | unit | T5 |
| T10 | TownRoom equip | server | room-integration | T6,T7,T9 |
| T11 | TownRoom death/respawn | server | room-integration | T4,T9 |
| T12 | TownRoom level-up reward | server | room-integration | T4,T7,T9,T11 |
| T13 | inventory UI | client | unit | — |
| T14 | wire equip client | client | unit | T10,T13 |
| T15 | test hook + HUD | client | unit | T11,T12,T14 |
| T16 | progression e2e | e2e | e2e | T15 |
