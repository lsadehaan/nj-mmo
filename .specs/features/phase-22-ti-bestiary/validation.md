# Phase 22 — Complete TI Bestiary Validation

**Date**: 2026-06-29 (re-verify after `9726d57`)
**Spec**: `.specs/features/phase-22-ti-bestiary/spec.md`
**Diff range**: `cba2387..9726d57` (28 commits)
**Verifier**: independent sub-agent (author ≠ verifier)

---

## Task Completion

| Task | Status | Notes |
| ---- | ------ | ----- |
| T1–T4 Seed & schema | ✅ Done | `608b0b2`..`126015c` |
| T5–T18 GLB assets | ✅ Done | 14 rigged GLBs vendored |
| T19–T20 Manifest | ✅ Done | 23 `CreatureEntry` rows |
| T21–T22 Ranged + social AI | ✅ Done | `1544198`..`8f69ab3` |
| T23 Room integration | ✅ Done | `ba2d6c2` |
| T24 Client tests | ✅ Done | `bdface7` |
| T25 Visual gate | ✅ Done | `74e9237` — 44/44 structural PASS |
| T26 Screenshots | ✅ Done | `bd8f201` — 42 PNGs (14×3) |
| T27 Full gate | ✅ Done | `32a9dd2` |
| T28 LICENSE fix | ✅ Done | `9726d57` — BEST22-41 |

---

## Spec-Anchored Acceptance Criteria

### P1: Seed extension (BEST22-01–22)

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| BEST22-01 | `TI_MOB_IDS` length 23, nine existing + fourteen new | `server/src/seed/paths.spec.ts:6-12` — `expect(TI_MOB_IDS).toHaveLength(23)` + exact id array | ✅ PASS |
| BEST22-02 | 23 monster rows, names/levels match roster | `server/src/seed/seeders/monsters.seeder.spec.ts:268` — `expect(...all()).toHaveLength(23)` only | ⚠️ Spec-precision gap — count only; names/levels covered per-mob in BEST22-03–16 |
| BEST22-03 | Orc Soldier 20131: lv7, exp308, hp113.94, passive, ORC | `monsters.seeder.spec.ts:275-282` — `toMatchObject({ level:7, exp:308, hp:113.94, isAggressive:false, clan:'ORC' })` | ✅ PASS |
| BEST22-04 | Orc Archer 20006: lv8, ARCHER, aggressive, aggro450 | `monsters.seeder.spec.ts:289-296` — `toMatchObject({ level:8, aiType:'ARCHER', isAggressive:true, aggroRange:450 })` | ✅ PASS |
| BEST22-05 | Goblin Scout 20326: lv8, hp131.031, passive | `monsters.seeder.spec.ts:171-176` | ✅ PASS |
| BEST22-06 | Werewolf 20132: lv9, WEREWOLF, clanHelp300, passive | `monsters.seeder.spec.ts:303-309` | ✅ PASS |
| BEST22-07 | Werewolf Hunter 20343: lv10, hp172.176, aggressive | `monsters.seeder.spec.ts:183-188` | ✅ PASS |
| BEST22-08 | Orc Warrior 20093: lv10, exp441, aggressive | `monsters.seeder.spec.ts:195-200` | ✅ PASS |
| BEST22-09 | Orc Lieutenant 20096: lv11, exp486 | `monsters.seeder.spec.ts:207` — `exp: 482` | ⚠️ Spec-precision gap — fixture XML `acquire exp="482"` pinned; planner table said 486 |
| BEST22-10 | Orc Captain 20098: lv12, exp530 | `monsters.seeder.spec.ts:214` | ✅ PASS |
| BEST22-11 | Werewolf Chieftain 20342: lv12, hp81.77492, pAtk≈25.30 | `monsters.seeder.spec.ts:221-222` | ✅ PASS |
| BEST22-12 | Stone Golem 20016: lv13, CONSTRUCT, hp243.996 | `monsters.seeder.spec.ts:229-234` — `hp: 87.93267` (fixture) | ⚠️ Spec-precision gap — fixture `hp="87.93267"` pinned; planner table said 243.996 |
| BEST22-13 | Crasher 20101: lv14, race BUG | `monsters.seeder.spec.ts:241` — `race: 'CONSTRUCT'` | ⚠️ Spec-precision gap — fixture race CONSTRUCT; planner table said BUG |
| BEST22-14 | Giant Spider 20103: lv15 | `monsters.seeder.spec.ts:248` | ✅ PASS |
| BEST22-15 | Giant Fang Spider 20106: lv16 | `monsters.seeder.spec.ts:255` | ✅ PASS |
| BEST22-16 | Giant Blade Spider 20108: lv17 | `monsters.seeder.spec.ts:262` | ✅ PASS |
| BEST22-17 | Each new mob has adena drop anchor | `drops.seeder.spec.ts:73-84` — `it.each(PHASE22_ADENA_ANCHORS)` | ✅ PASS |
| BEST22-18 | All 23 TI ids have spawn rows | `spawns.seeder.spec.ts:34` — `npcIds.has(id)` for each `TI_MOB_IDS` | ✅ PASS |
| BEST22-19 | ≥55 spawn rows | `spawns.seeder.spec.ts:23`, `spawn-placement.spec.ts:75` | ✅ PASS |
| BEST22-20 | All spawns outside peace zone | `spawn-placement.spec.ts:78-81` | ✅ PASS |
| BEST22-21 | All spawns walkable | `spawn-placement.spec.ts:84-90` | ✅ PASS |
| BEST22-22 | Idempotent seed (monsters/spawns/drops) | `monsters.seeder.spec.ts:312-321`, `drops.seeder.spec.ts:93-121`, `spawns.seeder.spec.ts:41-49` | ✅ PASS |

### P1: Creature manifest (BEST22-23–26)

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| BEST22-23 | Full `CreatureEntry` for each of 23 ids | `creature-manifest.spec.ts:25-37` — `it.each(SEEDED_NPC_IDS)` | ✅ PASS |
| BEST22-24 | Unknown id returns null | `creature-manifest.spec.ts:41` — `expect(getCreatureEntry(99999)).toBeNull()` | ✅ PASS |
| BEST22-25 | clipMap keys idle/move/attack/cast/die non-empty | `creature-manifest.spec.ts:35-37` — per-key `toBeTruthy()` | ✅ PASS |
| BEST22-26 | Unique model path per npcId | `creature-manifest.spec.ts:69-71` — `Set(models).size === length` | ✅ PASS |

### P1: GLB assets (BEST22-27–41)

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| BEST22-27–40 | Distinct rigged silhouettes per mob | `visual-gate.mjs` rigged PASS + `BEST22-26` unique paths + `.specs/features/phase-22-ti-bestiary/visual-review/mob-{id}-{idle,attack,die}.png` (42 files) | ✅ PASS (AD-017 two-layer) |
| BEST22-41 | LICENSE.txt documents source pack for new GLBs | `client/public/models/monsters/LICENSE.txt:15-29` — Phase 22 section lists all 14 GLBs → Quaternius/Ultimate Monsters paths (`9726d57`) | ✅ PASS |

### P1: Runtime (BEST22-42–44)

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| BEST22-42 | No CapsuleGeometry for new mobs | `client/src/scene/mobs.spec.ts:158-159` — `it.each([20006,20132,20016,20103])` + `mobUsesCapsule false` | ✅ PASS |
| BEST22-43 | Stone Golem hit → action=Attack, actionSeq++ | `TownRoom.spec.ts:876-877` — `expect(mobState.action).toBe(EntityAction.Attack); expect(actionSeq).toBe(1)` | ✅ PASS |
| BEST22-44 | Orc Warrior kill → Die before delete | `TownRoom.spec.ts:898-908` — `dieObservedBeforeDelete` spy on `mobs.delete` | ✅ PASS |

### P1: Ranged AI (BEST22-45–47)

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| BEST22-45 | Beyond 8 m → chase | `ranged-mob-ai.spec.ts:9-10` — `shouldRangedMobAdvance(10,4,8).toBe(true)` | ✅ PASS |
| BEST22-46 | 4–8 m band → hold, allow attack | `ranged-mob-ai.spec.ts:14-17`, `mob-ai.spec.ts:204` — hold position delta <0.1 | ✅ PASS |
| BEST22-47 | Room: damage at 6 m without closing <4 m | `TownRoom.spec.ts:934-937` — `hp < hpBefore`, `endDist > 4 && < 8.5` | ✅ PASS |

### P1: Social aggro (BEST22-48–50)

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| BEST22-48 | Passive Werewolf retaliates on damage | `TownRoom.spec.ts:956` — `targetSessionId === client.sessionId` after attack | ✅ PASS |
| BEST22-49 | Clan mate within 30 m acquires same target | `TownRoom.spec.ts:963+` room test; `mob-ai.spec.ts:249` unit | ✅ PASS |
| BEST22-50 | Beyond 30 m → no assist | `mob-ai.spec.ts:224` — `findClanAssistTargets(...).toHaveLength(0)` at 40 m | ✅ PASS |

### P1: Observability (BEST22-51–52)

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| BEST22-51 | `__GAME_STATE__.mobs` exposes npcId for {20006,20132,20016,20103} | `test-hook.spec.ts:56-60` — all four npcIds in Set | ✅ PASS |
| BEST22-52 | Orc Warrior attack action visible | `test-hook.spec.ts:77-78` — `action === 'attack'` | ✅ PASS |

### P2: Progression / visual (BEST22-53–55)

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| BEST22-53 | Ring 6–10 mean level monotonic | `spawn-placement.spec.ts:93-105` — hand-mapped `RING_TIER` (partial ring derivation per implementer deviation) | ✅ PASS |
| BEST22-54 | visual-gate.mjs PASS for 14 new GLBs | Verifier run: 44/44 PASS including all Phase 22 monster GLBs | ✅ PASS |
| BEST22-55 | shoot-character PNGs idle/attack/die per mob | `.specs/features/phase-22-ti-bestiary/visual-review/` — 42 PNGs present (`bd8f201`) | ✅ PASS |

**Status**: ✅ All 55 ACs verified — 4 documented spec-precision gaps (BEST22-02 partial, 09, 12, 13 fixture vs planner table; non-blocking per spec AD-012 fixture pin)

---

## Implementer Deviations (documented)

| Deviation | Evidence | Impact |
| --------- | -------- | ------ |
| Spawn coords `WORLD_MAX=95` | `design.md` / spawn JSON | Within walkable grid; peace-zone tests pass |
| Ring test partial (hand-mapped `RING_TIER`) | `spawn-placement.spec.ts:36-60` | BEST22-53 passes via documented tier map, not auto-derived from coords |
| L2J fixture anchor pins | `monsters.xml` exp/hp/race for 20096, 20016, 20101 | Tests match fixture, not planner table (BEST22-09/12/13 gaps) |
| ARCHER band in `resolveMobAttack` | `combat-resolver.ts:437-438` | `dist < attackRangeWorld \|\| dist > preferredAttackRangeWorld` → return; room BEST22-47 proves behavior |
| Werewolf tick pattern | `mob-ai.ts:71-72` — assist on first `targetSessionId` gain per tick | BEST22-49 room test passes |

---

## Discrimination Sensor

| Mutation | File:line | Description | Killed? |
| -------- | --------- | ----------- | ------- |
| M1 | `libs/game-core/src/combat/ranged-mob-ai.ts:7` | `shouldRangedMobAdvance` always returns `false` | ✅ Killed — `ranged-mob-ai.spec.ts` BEST22-45 failed |
| M2 | `server/src/rooms/mob-ai.ts:36` | Clan assist range threshold broken (`< clanHelpRangeWorld - 100`) | ✅ Killed — `mob-ai.spec.ts` BEST22-49/50 failed |
| M3 | `server/src/seed/paths.ts` | Extra npcId 99999 appended | ✅ Killed — `paths.spec.ts` BEST22-01 failed |

**Sensor depth**: lightweight (3 targeted behavior-level mutations)
**Result**: 3/3 killed — ✅ PASS

---

## Code Quality

| Principle | Status |
| --------- | ------ |
| Minimum code | ✅ Reuses Phase 10/16 pipeline |
| Surgical changes | ✅ Scoped to seed, manifest, mob-ai, assets |
| No scope creep | ✅ No Playwright e2e, no new renderer |
| Matches patterns | ✅ `NJ_AUTOSIM=0` room harness, fixture seed |
| Spec-anchored outcome check | ⚠️ Fixture pins diverge from planner table on 3 mobs |
| Per-layer coverage | ✅ Unit + seed + room per matrix |
| Tests map to ACs | ✅ BEST22 tags on primary assertions |
| Guidelines followed | ✅ `AGENTS.md`, AD-001/010/014/017 |

---

## Edge Cases

- [x] Shared clip-map families: track names verified per GLB before mapping (BEST22-25)
- [x] Orc Archer peace-zone drop target: existing rule in `mob-ai.spec.ts:172-183`
- [x] Social assist one-hop idle-only: `findClanAssistTargets` filters `!p.targetSessionId`
- [x] Byte-identical GLB dedup: visual-gate DEDUP check PASS
- [x] Spawn in peace zone: BEST22-20 would fail (all pass)

---

## Gate Check

- **Gate command**: `nx run-many -t build lint test` + `node scripts/visual-gate.mjs`
- **Build/lint/test**: ✅ 0 failed (re-verify `--skip-nx-cache`: game-core 149, client 149, server 267 tests)
- **Visual gate**: ✅ 44/44 PASS
- **Test count before** (`cba2387`): game-core 146, server 243 (~389+ client baseline)
- **Test count after** (`9726d57`): game-core 149, client 149, server 267 (**+24 server**, **+client delta**)
- **Skipped tests**: none
- **Failures**: none

---

## Fix Loop (re-verify `9726d57`)

| Fix | AC | Status | Evidence |
| --- | -- | ------ | -------- |
| Fix 1: Phase 22 LICENSE entries | BEST22-41 | ✅ Applied | `9726d57` — 14 GLB lines + Flying clip-map note in `LICENSE.txt` |
| Fix 2: Planner vs fixture anchor drift | BEST22-09/12/13 | Deferred | Non-blocking; tests pin fixture per AD-012 |
| Fix 3: BEST22-02 roster assertion | BEST22-02 | Deferred | Names/levels covered per-mob in BEST22-03–16 |

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
| ----------- | --------------- | ---------- |
| BEST22-01–55 | 54 verified, 41 gap | ✅ Verified |

*(spec.md / ROADMAP / STATE not flipped per Verifier mandate — orchestrator updates on PASS)*

---

## Summary

**Overall**: ✅ Ready

**Spec-anchored check**: 55/55 ACs verified; 4 spec-precision gaps documented (non-blocking)
**Sensor**: 3/3 mutations killed (M1 `ranged-mob-ai.spec.ts` BEST22-45, M2 `mob-ai.spec.ts` BEST22-49, M3 `paths.spec.ts` BEST22-01)
**Gate**: 565 tests passed (all projects), build/lint green, visual gate 44/44

**What works**: Full 23-mob seed pipeline, ranged Orc Archer AI, werewolf social aggro, creature manifest, room integration pins, structural + screenshot visual gate, Phase 22 LICENSE attributions, monorepo gate green.

**Residual (optional)**: Planner vs fixture anchor drift on Orc Lieutenant exp, Stone Golem hp, Crasher race; BEST22-02 could add full roster assertion.
