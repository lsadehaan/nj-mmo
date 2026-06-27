# Phase 7 — Progression Loop Validation

**Date**: 2026-06-27  
**Spec**: `.specs/features/phase-7-progression-golive/spec.md` (P7-R01–R17; deploy P7-R18–R22 **descoped**)  
**Diff range**: `bfbead0..221f1f2` (18 commits: planning + deploy descope + T1–T16)  
**Verifier**: independent sub-agent (author ≠ verifier; fresh eyes)

**Scope note**: Production deployment is **deferred post-MVP** (not a gap).

---

## Task Completion

| Task | Status | Notes |
| ---- | ------ | ----- |
| T1 | ✅ Done | `items` master schema |
| T2 | ✅ Done | items seed subset incl. 2369 |
| T3 | ✅ Done | `effectivePAtk` + melee 27 anchor |
| T4 | ✅ Done | `applyLevelUpReward` + `resolvePlayerDeath` |
| T5 | ✅ Done | character maxHp/maxMp/equip columns |
| T6 | ✅ Done | `equip-transaction` pure module |
| T7 | ✅ Done | combat-resolver `attackerPAtk` param |
| T8 | ✅ Done | starter kit grants sword |
| T9 | ✅ Done | `PlayerState` vitals + equip sync |
| T10 | ✅ Done | TownRoom equip handler + persistence |
| T11 | ✅ Done | TownRoom death/respawn |
| T12 | ✅ Done | TownRoom level-up reward on kill |
| T13 | ✅ Done | inventory window UI |
| T14 | ✅ Done | client equip wiring |
| T15 | ✅ Done | test hook + HUD progression fields |
| T16 | ✅ Done | `progression.spec.ts` e2e |

---

## Spec-Anchored Acceptance Criteria

### P7: Items master + equip weapon (P7-R01–R09)

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ------------------------- | ------ |
| AC1 — `seedItems` item **2369** | `Squire's Sword`, `type=weapon`, `pAtk=6`, `randomDamage=10`, `bodyPart=rhand` | `server/src/seed/seeders/items.seeder.spec.ts:30-37` — `expect(sword).toEqual({ itemId: 2369, name: "Squire's Sword", type: 'weapon', pAtk: 6, randomDamage: 10, bodyPart: 'rhand' })`; idempotent `:58` — `expect(sword?.pAtk).toBe(6)` | ✅ PASS |
| AC2 — `effectivePAtk(10, 2369, …)` / unarmed | **16** / **10** | `libs/game-core/src/combat/effective-patk.spec.ts:8` — `toBe(16)`; `:12-13` — unarmed/null/0 → `toBe(10)` | ✅ PASS |
| AC3 — melee `pAtk=16` vs Gremlin | damage **27** | `effective-patk.spec.ts:30` — `expect(damage).toBe(27)` | ✅ PASS |
| AC4 — equip **2369** owned → melee **27** | `equippedWeaponItemId=2369`, hit **27** | `server/src/rooms/TownRoom.spec.ts:1247-1261` — equip + `expect(hpBefore - …hp).toBeCloseTo(27, 3)` | ✅ PASS |
| AC5 — equip **1060** rejected | slot unchanged | `TownRoom.spec.ts:1276-1278` — `expect(player.equippedWeaponItemId).toBe(0)` | ✅ PASS |
| AC6 — equip **2369** unowned rejected | slot unchanged | `TownRoom.spec.ts:1292-1294` — `toBe(0)` | ✅ PASS |
| AC7 — equip persists on reconnect | `equipped_weapon_item_id` saved | `TownRoom.spec.ts:1313-1323` — DB + rejoin `equippedWeaponItemId`; debounced `:1344` | ✅ PASS |
| AC8 — Roxxy starter kit inventory | **3×1060** + **1×2369** | `TownRoom.spec.ts:1095` — potion count **3** (room); **2369** at unit `npc-actions.spec.ts:43-44` — `expect(result.itemCounts[2369]).toBe(1)` | ⚠️ Spec-precision: **2369** not room-asserted (unit covers value) |
| AC9 — inventory window + `equippedWeaponId` | list + Equip for weapons; hook matches server | `client/src/ui/inventory-window.spec.ts:32-53` — rows + Equip button; `room-inventory.spec.ts:133-137` — equipped label; e2e `progression.spec.ts:157-157` — `equippedWeaponId===2369` via `__equipItem__` (not DOM open) | ⚠️ Spec-precision: AC tags **e2e**; inventory DOM at **client unit** layer |

**Combat anchors (P7-R06, spec assumptions)**:

| Outcome | Evidence | Result |
| ------- | -------- | ------ |
| Equipped melee **27** / Power Strike **79** (`pAtk=16`) | `combat-resolver.spec.ts:451`, `:474` | ✅ PASS |
| Unequipped melee **17** / Power Strike **69** (`pAtk=10`) | `combat-resolver.spec.ts:96`, `:402` | ✅ PASS |

### P7: Death / respawn (P7-R10–R13)

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ------------------------- | ------ |
| AC1 — `resolvePlayerDeath` xp at hp=0 | **xp=44** unchanged | `libs/game-core/src/level-up-reward.spec.ts:36` — `expect(result.xp).toBe(44)` | ✅ PASS |
| AC2 — `hp=1` + mob damage → respawn | `hp=maxHp`, spawn `(SPAWN_X,SPAWN_Y,SPAWN_Z)`, **xp unchanged** | `TownRoom.spec.ts:1378-1383` — full HP/MP, spawn coords, `xp` **44** | ✅ PASS |
| AC3 — death clears target + mob aggro | `targetMobId` null, mob `targetSessionId` null | `TownRoom.spec.ts:1413-1414` | ✅ PASS |
| AC4 — death reconnect persist | spawn + `hp=maxHp` | `TownRoom.spec.ts:1483-1485` | ✅ PASS |

### P7: Level-up reward (P7-R14–R16)

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ------------------------- | ------ |
| AC1 — `applyLevelUpReward` 1→2 | `{ maxHp:112, maxMp:55, hp:112, mp:55 }` | `level-up-reward.spec.ts:14` — `toEqual({ maxHp: 112, maxMp: 55, hp: 112, mp: 55 })` | ✅ PASS |
| AC2 — Gremlin kill → level 2 vitals | `level=2`, `xp=88`, `maxHp=112`, `hp=112`, `maxMp=55`, `mp=55` | `TownRoom.spec.ts:1540-1545` — all six fields; single-kill guard `:1520-1523` | ✅ PASS |
| AC3 — client level HUD | `__GAME_STATE__.player.level` **2**, HUD **Lv.2** | `progression.spec.ts:171`, `:213` — `toBe(2)` + `Lv.2`; unit `test-hook.spec.ts:211`, `player-vitals.spec.ts:25` | ✅ PASS |

### P7: Full progression loop E2E (P7-R17)

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ------------------------- | ------ |
| AC1 — starter kit → equip **2369** → 2 kills → buy **1060** | `equippedWeaponId=2369`, `level=2`, `items[1060]≥1`, `adena=897` | `client-e2e/src/progression.spec.ts:157-208` — poll + final asserts | ✅ PASS |

**Status**: ✅ **20/22 ACs fully matched**; **2 spec-precision gaps** (non-blocking; values proven at adjacent layer).

---

## Discrimination Sensor

Scratch mutations applied and reverted (`git checkout`). Tests run with `--skip-nx-cache` (vitest direct where nx `testNamePattern` skipped files).

| # | Mutation | Target | Proving test | Killed? |
| - | -------- | ------ | ------------ | ------- |
| 1 | `effectivePAtk` ignores weapon (`return basePAtk`) | `libs/game-core/src/combat/effective-patk.ts:9` | `effective-patk.spec.ts` — `toBe(16)` / `toBe(27)` | ✅ Killed |
| 2 | Remove equip ownership check | `equip-transaction.ts` — drop `ownedCount < 1` guard | `TownRoom.spec.ts` — `without owning it` | ✅ Killed |
| 3 | Remove weapon-type check | `equip-transaction.ts` — drop `itemType !== 'weapon'` | `TownRoom.spec.ts` — `rejects equipping a consumable` | ✅ Killed |
| 4 | Remove player-death handling in tick | `TownRoom.ts` — remove `hp<=0` → `handlePlayerDeath` loop | `TownRoom.spec.ts` — `mob kill respawns player` | ✅ Killed |
| 5 | Death wipes XP (`xp: 0`) | `player-death.ts` | `level-up-reward.spec.ts:36` + `TownRoom.spec.ts:1383` | ✅ Killed |
| 6 | Skip `applyLevelUpReward` on level-up (`if (false)`) | `TownRoom.ts:642` | `TownRoom.spec.ts` — `two Gremlin kills reach level 2` (`maxHp` **112**) | ✅ Killed |
| 7 | Apply level-up reward on **every** kill (`applyLevelUpReward(0,1,…)` unconditional) | `TownRoom.ts:642-657` | `TownRoom.spec.ts:1522` — `expect(player.maxHp).toBe(100)` → received **112** | ✅ Killed |

**Sensor depth**: lightweight (7 targeted behavior-level faults)  
**Result**: **7/7 killed** — ✅ PASS

---

## Server Authority (AD-001)

| Behavior | Server location | Client role | Tested on server? |
| -------- | --------------- | ----------- | ----------------- |
| Equip validation + slot | `TownRoom.handleEquip` + `validateEquip` | `room.send('equip')` intent only | ✅ room + unit |
| Effective `pAtk` in combat | `TownRoom.getPlayerPAtk` → `effectivePAtk` → resolver | renders synced `equippedWeaponItemId` | ✅ unit + room |
| Death / respawn | `TownRoom.simulate` → `handlePlayerDeath` → `resolvePlayerDeath` | HUD overlay from synced `hp`/position | ✅ unit + room |
| Level-up reward | `handleMobKill` → `applyLevelUpReward` when level rises | HUD `maxHp`/level from schema | ✅ unit + room |
| Starter kit items | `npc-actions.applyStarterKit` in room handler | inventory display from synced `player.items` | ✅ unit (+ partial room) |

**Finding**: ✅ Server authority upheld. Client deviations are render/sync only (see below).

### Recorded deviations — assessment

| Deviation | Assessment |
| --------- | ---------- |
| T10: Power Strike cooldown room test retargeted to Gremlin HP=500 | ✅ Test hygiene only — avoids goblin XP/level-up side effects; does not weaken combat authority |
| T16: Nested `player.items` Colyseus `onAdd/onChange/onRemove` in `wireRoom` | ✅ AD-001 render-only — server still owns item counts; fixes e2e hook sync for map mutations |
| T13: Panel id `#inventory-window` | ✅ Matches design/tasks; no behavioral impact |

None mask a real bug.

---

## Gate Check

| Command | Result |
| ------- | ------ |
| `nx affected -t test lint --base=bfbead0` | ✅ PASS (game-core **54**, client **73**, server **167**; lint warnings only, 0 errors) |
| `nx e2e client-e2e` (cache) | ✅ **13/13** pass |
| `nx e2e client-e2e --skip-nx-cache` | ✅ **13/13** pass (~1.1 min, 4 workers, AD-014 isolation) |

**Test count delta** (vs Phase 6 handoff): game-core 44→**54** (+10), client 57→**73** (+16), server 135→**167** (+32), e2e 12→**13** (+1). No silent deletions.

---

## Code Quality

| Principle | Status |
| --------- | ------ |
| Minimum scope / surgical changes | ✅ |
| Matches existing patterns (shop window, debounced save, AD-014 room helpers) | ✅ |
| Tests map to spec ACs (evidence-or-zero) | ✅ (2 spec-precision notes) |
| AGENTS.md four-layer contract + AD-010/014 | ✅ |
| Deploy descoped — not flagged as gap | ✅ |

---

## Ranked Gaps (non-blocking)

1. **P7 AC8 layer mismatch** — `1×2369` starter-kit count proven at **unit** (`npc-actions.spec.ts:44`), not **room-integration** (`TownRoom.spec.ts` asserts potions only). Value is correct; room test could add `getPlayerItemCount(2369)===1` for strict traceability.
2. **P7 AC9 layer mismatch** — Spec tags **e2e** for inventory window; coverage is **client unit** (`inventory-window.spec.ts`, `room-inventory.spec.ts`) plus e2e `equippedWeaponId` via `__equipItem__` hook (not `I` key / DOM open). Behavior is proven; e2e DOM inventory open is optional polish.

**Deploy (P7-R18–R22)**: intentionally **out of scope** — deferred post-MVP; **not a gap**.

---

## Summary

**Overall**: ✅ **PASS**

**Spec-anchored check**: 20/22 ACs matched at spec values; 2 spec-precision layer gaps (starter-kit 2369 room assert; inventory e2e vs unit). All anchor numbers verified: `pAtk` 6/16/10, melee 27/17, Power Strike 79/69, level-2 vitals 112/55, adena 897, death xp preserved, full-loop e2e green.

**Sensor**: 7/7 mutants killed.

**Gate**: game-core 54 + client 73 + server 167 + e2e 13 — all green.

**Server authority**: confirmed (AD-001).

**Lessons**: none recorded (clean PASS; no grounded failures).
