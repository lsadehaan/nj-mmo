# Phase 25 — Items, Economy & Crafting Validation

**Date**: 2026-06-30 (re-verify after fix `60bcd61`)
**Spec**: `.specs/features/phase-25-items-economy/spec.md`
**Diff range**: `ae1a27e..60bcd61` (`feat/phase-25-items-economy`)
**Verifier**: independent sub-agent (author ≠ verifier)
**Fix iteration**: 1/3 (post `60bcd61`)

---

## Task Completion

| Phase | Status | Notes |
| ----- | ------ | ----- |
| T1–T3 Seed & merchants | ✅ Done | Seed/schema/buylist tests pass |
| T4–T8 game-core + client sync | ✅ Done | wireRoom chest equip sync (`wire-room.spec.ts:281`) |
| T9–T14 TownRoom handlers | ⚠️ Partial | Equip/craft/enchant/drop room suite added; reject-path room ACs still unit-only |
| T15–T19 Client UI | ✅ Done | equipment/craft/enchant dialog unit tests |
| T20 Pinter GLB | ⚠️ Deviation | Pinter reuses `Jackson.glb` placeholder (non-AC) |
| T21 Drops | ✅ Done | ITEM25-51 room drop test added |
| T22 Gate | ✅ Done | `nx run-many -t build lint test` passes |

---

## Spec-Anchored Acceptance Criteria

| AC | Spec-defined outcome | `file:line` + assertion | Result |
| -- | -------------------- | ----------------------- | ------ |
| ITEM25-01 | schema columns incl. crystal_type, p_def, … | `server/src/db/schema.spec.ts:113` — extended item insert/read | ✅ PASS |
| ITEM25-02 | TI_ITEM_IDS ≥75 incl. 3,23,1786,955,956 | `server/src/seed/paths.spec.ts:5` — `toBeGreaterThanOrEqual(75)` + anchors | ✅ PASS |
| ITEM25-03 | one items row per TI_ITEM_IDS | `server/src/seed/seeders/items.seeder.spec.ts:61` — row count match | ✅ PASS |
| ITEM25-04 | item 3: pAtk 11, NG, rhand, not enchantable | `items.seeder.spec.ts:27` — `toMatchObject({…})` | ✅ PASS |
| ITEM25-05 | item 58: D, pDef 95, chest, enchantable | `items.seeder.spec.ts:42` — anchor object | ✅ PASS |
| ITEM25-06 | item 1786: type recipe, recipeId 2 | `items.seeder.spec.ts:54` | ✅ PASS |
| ITEM25-07 | recipes PK recipe_id + ingredients JSON | `schema.spec.ts:142` | ✅ PASS |
| ITEM25-08 | recipe 2 product 3 + anchor ingredients | `items.seeder.spec.ts:73` | ✅ PASS |
| ITEM25-09 | armor_sets 0 Wooden, 1 Mithril | `items.seeder.spec.ts:92`, `schema.spec.ts:177` | ✅ PASS |
| ITEM25-10 | idempotent seed | `items.seeder.spec.ts:103` | ✅ PASS |
| ITEM25-11 | Lector 27 rows, Broadsword 14375 | `merchant-items.seeder.spec.ts:25` — `length 27`, `buyPrice 14375` | ✅ PASS |
| ITEM25-12 | Jackson ≥30 armor rows | `merchant-items.seeder.spec.ts:39` — `toBeGreaterThanOrEqual(30)` | ✅ PASS |
| ITEM25-13 | Silvia ≥**15** accessory rows | `merchant-items.seeder.spec.ts:50` — `toBe(13)`; **SPEC_DEVIATION accepted** (L2J `buylist_30003.xml` = 13) | ✅ PASS (deviation) |
| ITEM25-14 | buy item **3** at Lector, adena −14375 | `TownRoom.spec.ts:4327` — adena + inventory asserts | ✅ PASS |
| ITEM25-15 | Pinter Merchant, scrolls 955/956 | `merchant-items.seeder.spec.ts:62`, `npc-manifest.spec.ts:73` | ✅ PASS |
| ITEM25-16 | room boots with npc 30298 | `TownRoom.spec.ts:2058`, `npcs.seeder.spec.ts:25` | ✅ PASS |
| ITEM25-17 | character_equipment PK (character_id, slot) | `schema.spec.ts:164`, `equipment-repository.spec.ts:27` | ✅ PASS |
| ITEM25-18 | EQUIP_SLOTS lists 11 keys | `equip-slots.spec.ts:10` — `toHaveLength(11)` | ✅ PASS |
| ITEM25-19 | equip Broadsword 3 → rhand, inventory −1 | `TownRoom.spec.ts:4349` — rhand + count | ✅ PASS |
| ITEM25-20 | equip chest 23 → PlayerState equip arrays | `TownRoom.spec.ts:4367` — chest slot + count 0 | ✅ PASS |
| ITEM25-21 | equip legs 2386 + head 43 populated | `TownRoom.spec.ts:4385` — legs/head slots | ✅ PASS |
| ITEM25-22 | ring 116, neck 118, earring 112 slots | `TownRoom.spec.ts:4409` — three jewelry slots | ✅ PASS |
| ITEM25-23 | reject consumable 1060 equip | `TownRoom.spec.ts:4436` — chest 0, potion count 1 | ✅ PASS |
| ITEM25-24 | unequip chest → inventory + clear slot | `TownRoom.spec.ts:4454` — slot 0, item returned | ✅ PASS |
| ITEM25-25 | legacy equippedWeaponItemId 2369 → rhand | `equipment-repository.spec.ts:34` — repo unit; spec layer **room** | ❌ GAP — wrong layer |
| ITEM25-26 | calcEffectivePAtk +11 with Broadsword | `equipment-stats.spec.ts:14` — `toBe(11)` delta | ✅ PASS |
| ITEM25-27 | calcPlayerPDef +47 Wooden BP | `equipment-stats.spec.ts:20` — `toBe(47)` delta | ✅ PASS |
| ITEM25-28 | +3 D 1H pAtk bonus +12 | `equipment-stats.spec.ts:26` — `toBe(12)` | ✅ PASS |
| ITEM25-29 | +3 armor pDef +3 | `equipment-stats.spec.ts:37` — `toBe(3)` | ✅ PASS |
| ITEM25-30 | Wooden set +41 maxHp, +2% pDef | `equipment-stats.spec.ts:41` — `maxHpBonus 41`, pDef floor | ✅ PASS |
| ITEM25-31 | armored player takes less mob damage | `TownRoom.spec.ts:4475` — `armoredDamage < nakedDamage` | ✅ PASS |
| ITEM25-32 | `__GAME_STATE__.equipment.chest` shows 23 | `wire-room.spec.ts:281` — `{ itemId: 23, enchantLevel: 0 }` | ✅ PASS |
| ITEM25-33 | useShot 1835 → armedShot soul, count −1 | `TownRoom.spec.ts:1877` — SKILL20 tag; behavior matches | ✅ PASS |
| ITEM25-34 | Power Strike + soulshot damage 142 | `TownRoom.spec.ts:1905` — `toBeCloseTo(142, 3)` | ✅ PASS |
| ITEM25-35 | spiritshot 2509 Wind Strike ×2 (80) | `TownRoom.spec.ts:1932` — doubled template damage | ✅ PASS |
| ITEM25-36 | shouldSoulshotGlint fires | `soulshot-glint-vfx.spec.ts:17` | ✅ PASS |
| ITEM25-37 | dwarf craft recipe 2 → Broadsword ×1 | `TownRoom.spec.ts:4513` — inventory gains item 3 | ✅ PASS |
| ITEM25-38 | ingredients + recipe 1786 consumed | `TownRoom.spec.ts:4530-4533` — counts 0 | ✅ PASS |
| ITEM25-39 | MP −30 on craft | `TownRoom.spec.ts:4534` — `player.mp` 20 from 50 | ✅ PASS |
| ITEM25-40 | Human Fighter craft rejected | `craft.spec.ts:25` — `toBe('not_dwarf')`; spec layer **room** | ❌ GAP — wrong layer |
| ITEM25-41 | insufficient materials reject, no partial consume | `craft.spec.ts:36` — `missing_ingredients`; spec layer **room** | ❌ GAP — wrong layer |
| ITEM25-42 | craft dialog Craft enabled with recipe 1786 | `craft-dialog.spec.ts:14` | ✅ PASS |
| ITEM25-43 | scroll 955 on D weapon +0 → +1, scroll −1 | `TownRoom.spec.ts:4542` — enchant 1, scroll 0 | ✅ PASS |
| ITEM25-44 | armor +2→+3 with 956, 100% seeded rng | `TownRoom.spec.ts:4566` — enchant level 3 | ✅ PASS |
| ITEM25-45 | +3 item rejects max_safe_enchant | `equipment-stats.spec.ts:70` — unit `canEnchant`; spec layer **room** | ❌ GAP — wrong layer |
| ITEM25-46 | grade mismatch 955 on NG rejected | `equipment-stats.spec.ts:64` — unit; spec layer **room** | ❌ GAP — wrong layer |
| ITEM25-47 | NG item 3 not enchantable | `equipment-stats.spec.ts:58` — unit; spec layer **room** | ❌ GAP — wrong layer |
| ITEM25-48 | +3 D 1H reflects +12 in calcEffectivePAtk | `equipment-stats.spec.ts:26` | ✅ PASS |
| ITEM25-49 | enchant UI at Pinter DOM stub | `enchant-dialog.spec.ts:12` | ✅ PASS |
| ITEM25-50 | Gremlin drop stem 1864 chance > 0 | `drops-phase25.spec.ts:20` | ✅ PASS |
| ITEM25-51 | mob kill drops armor to inventory | `TownRoom.spec.ts:4592` — Keltir shirt count 1 | ✅ PASS |
| ITEM25-52 | nx run-many build lint test all pass | gate run 2026-06-30 | ✅ PASS |

**Status**: ❌ **7 AC gaps** (1 spec-precision, 6 wrong-layer room tests)

**Spec-precision gaps**: ITEM25-13 (L2J has 13 Silvia rows, spec says ≥15); Pinter GLB fidelity (T20, not AC)

---

## Discrimination Sensor

| Mutation | File:line | Description | Killed? |
| -------- | --------- | ----------- | ------- |
| 1 | `libs/game-core/src/items/enchant.ts:1` | `MAX_SAFE_ENCHANT` 3 → 99 | ✅ Killed (`equipment-stats.spec.ts:70`) |
| 2 | `libs/game-core/src/items/equip-slots.ts:69` | Skip `EQUIPPABLE_TYPES` check | ✅ Killed (`equip-slots.spec.ts:23`); room ITEM25-23 survives via `bodyPart` null path |
| 3 | `libs/game-core/src/items/craft.ts:66` | `applyCraft` skips MP deduction | ✅ Killed (`craft.spec.ts:50` + `TownRoom.spec.ts:4534`) |

**Sensor depth**: lightweight (3 mutations)
**Result**: 3/3 killed — ✅ PASS

---

## Code Quality

| Principle | Status |
| --------- | ------ |
| Minimum code | ✅ Handlers reuse game-core pure modules |
| Surgical changes | ✅ Phase-scoped files |
| No scope creep | ✅ |
| Matches patterns | ✅ AD-001 server authority, AD-014 room harness |
| Spec-anchored outcome check | ❌ 7 ACs lack correct-layer evidence |
| Per-layer Coverage Expectation | ⚠️ Reject-path craft/enchant + legacy migration still unit-only |
| Tests map to ACs | ✅ Primary happy-path room ACs now tagged in `TownRoom.spec.ts` |
| AGENTS.md guidelines | ✅ No Playwright; deterministic RNG; no wall-clock sleeps |

---

## Edge Cases (spot-check)

- [x] Consumable equip rejected — room (`TownRoom.spec.ts:4436`)
- [x] Two-hand / slot swap — `validateEquip` logic in game-core; room untested
- [ ] Inventory full on unequip — no test found
- [x] Enchant on equipped item updates enchant_level — room (`TownRoom.spec.ts:4542`, `4566`)
- [x] Equipment persists on death — no drop phase (N/A)

---

## Gate Check

- **Gate command**: `nx run-many -t build lint test`
- **Result**: all targets passed (build + lint warnings only, 0 errors)
- **Test counts** (no-cache run): server **404**, client **286**, game-core **230**
- **Failures**: none
- **Skipped**: none

---

## Implementer Deviations (confirmed)

| Note | Verdict |
| ---- | ------- |
| Silvia 13 rows not 15 | **SPEC_DEVIATION accepted** — L2J Classic `buylist_30003.xml` has 13 accessory rows; test anchors exact count |
| Pinter placeholder GLB (`Jackson.glb`) | Confirmed — visual gate passes; fidelity deviation only |
| Legacy migration + enchant/craft reject paths | Unit-only evidence; room layer still open |

---

## Fix Plans (ranked — fix budget 1/3 used)

### Fix 1: Enchant/craft reject room tests (Major)

- **ACs**: ITEM25-40, ITEM25-41, ITEM25-45, ITEM25-46, ITEM25-47
- **Where**: `server/src/rooms/TownRoom.spec.ts` — extend `Phase 25 equipment/craft/enchant`
- **Verify**: `nx test server --testNamePattern="ITEM25"`

### Fix 2: Legacy weapon migration room test (Major)

- **AC**: ITEM25-25
- **Where**: `TownRoom.spec.ts` — join character with `equippedWeaponItemId=2369`, assert `equipItemIds[rhand]`

### Fix 3: Silvia buylist AC alignment (Minor)

- **AC**: ITEM25-13
- **Either**: update spec to **13** per L2J Classic fixture, **or** add 2 fixture rows to reach 15

---

## Summary

**Overall**: ❌ **Not Ready**

**Spec-anchored check**: 45/52 matched at correct layer (7 gaps)
**Sensor**: 3/3 mutations killed
**Gate**: PASS

**Progress since prior FAIL (`ff98184`)**: Fix `60bcd61` closed **14 room AC gaps** (ITEM25-14–24, 31, 37–39, 43–44, 51) and **wireRoom ITEM25-32**. Primary blocker reduced from missing happy-path room tests to reject-path + migration layer coverage.

**Blocking issues**: Six room-layer ACs still covered only by game-core unit tests; Silvia row count spec-precision gap remains.

**Next steps**: Implement Fix 1–3, re-run Verifier (iteration 2/3); do not mark ROADMAP complete until validation PASS.
