# Phase 23 — Full Talking Island World & Zones Validation

**Date**: 2026-06-29
**Spec**: `.specs/features/phase-23-ti-world/spec.md`
**Diff range**: `093a660..5ffc550` (24 commits on `feat/phase-23-ti-world`)
**Verifier**: independent sub-agent (author ≠ verifier)
**Branch**: `feat/phase-23-ti-world` @ `5ffc550`

---

## Task Completion

| Task | Status | Notes |
| ---- | ------ | ----- |
| T1–T6 | ✅ Done | game-core coords, zones, terrain, walkability |
| T7–T10 | ✅ Done | territory spawns, NPC re-home, blockers, nav grid |
| T11–T15 | ✅ Done | schema, TownRoom zone tick, combat/AI/room guards |
| T16–T21 | ✅ Done | client terrain, landmarks, wireRoom, spawn tests |
| T22–T24 | ✅ Done | visual gate, map-overview shot, full regression |

---

## Implementer Deviations (documented, acceptable)

| Deviation | Impact on spec | Verifier assessment |
| --------- | -------------- | ------------------- |
| **Terrain region bias** | Design § region height bias; not a behavioral AC change | ✅ Matches design Approach A |
| **Nav grid static blockers only** | Grid bakes buildings + landmarks + water/slope; scatter props excluded from A* grid (runtime `isWalkable` still checks scatter) | ✅ Acceptable — path tests pass; AD-018 preserved at step level |
| **Landmark AABB shrink** | Smaller `halfW`/`halfD` (“prop cores only”) vs full GLB footprint | ✅ TIW23-43 still passes (anchor centre in AABB) |
| **OUT_OF_PEACE → obelisk** | Room/combat test coords moved to `(-150, 55)` (Obelisk combat zone) | ✅ Correct for expanded peace polygon; supersedes old rectangle edge |
| **Spawn scatter uses named zones** | `territory-spawns.ts` scatters inside zone polygons via `listTiZones()` | ✅ TIW23-27–31 pass |
| **613 mob spawn rows** | Spec minimum ≥55; full L2J territory `count` expansion | ✅ Superset of TIW23-24; all `TI_MOB_IDS` covered |

---

## Spec-Anchored Acceptance Criteria

| AC | Spec-defined outcome | `file:line` + assertion | Result |
| -- | -------------------- | ----------------------- | ------ |
| TIW23-01 | `l2ToLocal(-84300,243400)` → `(0,0)` ±0.001 | `l2-coords.spec.ts:7-8` — `toBeCloseTo(0, 3)` | ✅ PASS |
| TIW23-02 | Obelisk localX −155.43 ±0.1, localZ 58.17 ±0.1 | `l2-coords.spec.ts:13-14` — `toBeCloseTo(-155.43,1)` / `58.17` | ✅ PASS |
| TIW23-03 | `WORLD_MIN/MAX` = ±315 | `world-constants.spec.ts:16-17` — `toBe(-315)` / `toBe(315)` | ✅ PASS |
| TIW23-04 | `TERRAIN_CONFIG.size` = 640, segments 128 | `terrain.spec.ts:23-27` — `toEqual({ size: 640, segments: 128, … })` | ✅ PASS |
| TIW23-05 | `sampleHeight(0,0)` finite; `SPAWN_Y` = `snapEntityY(0,0)` | `terrain.spec.ts:7-9`, `world-constants.spec.ts:25` | ✅ PASS |
| TIW23-06 | `validateMoveIntent(320,0)` false; `(300,0)` true | `validate-move-intent.spec.ts:33-34` — `isValidMoveIntent` | ✅ PASS |
| TIW23-07 | `getZoneAt(0,0)` → `ti_village` / `peace` | `ti-zones.spec.ts:7-8` | ✅ PASS |
| TIW23-08 | Obelisk anchor → `obelisk` / `combat` | `ti-zones.spec.ts:12-14` | ✅ PASS |
| TIW23-09 | Elven Ruins anchor → `elven_ruins` | `ti-zones.spec.ts:18` | ✅ PASS |
| TIW23-10 | Harbor anchor → `harbor` | `ti-zones.spec.ts:22` | ✅ PASS |
| TIW23-11 | Cave anchor → `cave_of_souls` | `ti-zones.spec.ts:26` | ✅ PASS |
| TIW23-12 | Eastern fields anchor → `eastern_fields` / `combat` | `ti-zones.spec.ts:30-32` | ✅ PASS |
| TIW23-13 | All zone interiors → non-empty id, valid type enum | `ti-zones.spec.ts:43-44` | ✅ PASS |
| TIW23-14 | Outside polygons → `wilderness` / `combat` | `ti-zones.spec.ts:50-51` | ✅ PASS |
| TIW23-15 | `isPeaceZone` ≡ `getZoneAt().type === 'peace'` | `peace-zone.spec.ts:20` | ✅ PASS |
| TIW23-16 | Harbour water sample → `isWaterZone` true | `ti-zones.spec.ts:61` | ✅ PASS |
| TIW23-17 | Peace attack → mob HP unchanged | `TownRoom.spec.ts:2314` — `toBeCloseTo(hpBefore)` | ✅ PASS |
| TIW23-18 | Obelisk attack → mob HP decreases | `TownRoom.spec.ts:2395` — `toBeLessThan(hpBefore)` | ✅ PASS |
| TIW23-19 | Peace Wind Strike (skill 3) → no MP/HP change | `TownRoom.spec.ts:2337-2338` | ✅ PASS |
| TIW23-20 | Mob attack on player in village → 0 damage | `TownRoom.spec.ts:2369` — `player.hp` unchanged | ✅ PASS |
| TIW23-21 | Mob AI ignores player in peace | `mob-ai.spec.ts:169` — `targetSessionId` null | ✅ PASS |
| TIW23-22 | Move into water → x/z unchanged | `TownRoom.spec.ts:2423-2424` | ✅ PASS |
| TIW23-23 | `isWalkable` into water → false | `walkability.spec.ts:14` | ✅ PASS |
| TIW23-24 | ≥55 mob rows; every `TI_MOB_IDS` present | `spawn-placement.spec.ts:41-44` (613 rows) | ✅ PASS |
| TIW23-25 | All mob spawns outside peace | `spawn-placement.spec.ts:49` | ✅ PASS |
| TIW23-26 | All mob spawns walkable at centre | `spawn-placement.spec.ts:56` | ✅ PASS |
| TIW23-27 | ≥4 named zones with spawns | `spawn-placement.spec.ts:64` | ✅ PASS |
| TIW23-28 | Bearded Keltir centroid <130 m from origin | `spawn-placement.spec.ts:70` | ✅ PASS |
| TIW23-29 | Giant Spider centroid in ruins or cave | `spawn-placement.spec.ts:77` | ✅ PASS |
| TIW23-30 | Territory names map to zoneIds | `spawn-placement.spec.ts:97-105` | ✅ PASS |
| TIW23-31 | `elven_ruins` mean level > `eastern_fields` | `spawn-placement.spec.ts:91` | ✅ PASS |
| TIW23-32 | One NPC row per `TI_NPC_IDS` | `spawn-placement.spec.ts:115-117` | ✅ PASS |
| TIW23-33 | All NPC spawns in peace (`ti_village`) | `spawn-placement.spec.ts:123` | ✅ PASS |
| TIW23-34 | All NPC spawns not blocked | `npc-placement.spec.ts:25` — `isNpcSpawnBlocked` false (labeled TINPC-13) | ✅ PASS |
| TIW23-35 | Katerina within 8 m of L2 grocery anchor | `spawn-placement.spec.ts:131` | ✅ PASS |
| TIW23-36 | Six canonical landmark names | `landmark-placement.spec.ts:16-23` | ✅ PASS |
| TIW23-37 | Each landmark within 15 m of design anchor | `landmark-placement.spec.ts:30` | ✅ PASS |
| TIW23-38 | `__GAME_STATE__.environment.landmarks` count 6, renderKind mesh | `environment-renderer.spec.ts:227` — asserts `buildEnvironmentScene` output; `renderer.ts:169` wires via `setEnvironment` | ⚠️ Spec-precision gap — no direct `getGameState().environment.landmarks` assertion |
| TIW23-39 | All 6 landmark GLBs PASS visual gate | `node scripts/visual-gate.mjs` — 50/50 PASS incl. 6 landmarks | ✅ PASS |
| TIW23-40 | `map-overview` PNG produced | Commit `77bed1d`; artifact `/tmp/environment-shots/map-overview.png` (66 KB, 2026-06-29) | ✅ PASS |
| TIW23-41 | `bakeGrid()` 630×630, no throw | `walkability-grid.spec.ts:13-14` | ✅ PASS |
| TIW23-42 | Village → Obelisk path non-empty | `pathfinding.spec.ts:36` | ✅ PASS |
| TIW23-43 | Landmark AABBs contain anchor centres | `pathfinding.spec.ts:58` | ✅ PASS |
| TIW23-44 | Scatter prop blockers 220 ±5 | `world-blockers.spec.ts:25-26` | ✅ PASS |
| TIW23-45 | Client exposes `zone.id` / `zone.type` on sync | `wire-room.spec.ts:82-83` | ✅ PASS |
| TIW23-46 | Zone updates village → obelisk | `wire-room.spec.ts:91-92` | ✅ PASS |
| TIW23-47 | Pre-join zone `''` / `unknown` | `wire-room.spec.ts:66-69` | ✅ PASS |
| TIW23-48 | Spawn `zoneId` = `getZoneAt(spawn)` | `TownRoom.spec.ts:2437` | ✅ PASS |
| TIW23-49 | Zone boundary crossing updates `zoneId` | `TownRoom.spec.ts:2451-2454` | ✅ PASS |
| TIW23-50 | Full `build lint test` gate green | This report § Gate Check | ✅ PASS |

**Status**: ✅ 49/50 matched spec outcome directly; ⚠️ 1 spec-precision gap (TIW23-38 indirect coverage only)

**Unit-layer peace guards (supplemental)**: `combat-resolver.spec.ts:605-689` — attack/skill/mob damage 0 at `(0,0)`.

---

## Discrimination Sensor

Scratch mutations applied via temp file edits; restored after each run.

| Mutation | File | Description | Killed? |
| -------- | ---- | ----------- | ------- |
| 1 | `peace-zone.ts` | `isInPeaceZone` always `false` | ✅ Killed (`peace-zone.spec.ts`) |
| 2 | `ti-zones.ts` | `ti_village` id → `wilderness` | ✅ Killed (`ti-zones.spec.ts`) |
| 3 | `walkability.ts` | Remove water rejection at destination | ✅ Killed (`walkability.spec.ts`) |

**Sensor depth**: lightweight (3 behavior-level faults)
**Result**: 3/3 killed — ✅ PASS

---

## Code Quality

| Principle | Status |
| --------- | ------ |
| Minimum code / surgical changes | ✅ |
| No scope creep beyond Phase 23 | ✅ |
| Matches existing patterns (game-core pure rules, room tests AD-014) | ✅ |
| Spec-anchored outcome check | ✅ (1 indirect gap flagged) |
| Per-layer coverage (unit + seed + room + visual) | ✅ |
| AGENTS.md testing contract | ✅ |
| Documented guidelines | `AGENTS.md`, AD-001/009/010/014/018 |

---

## Edge Cases (from spec)

- [x] Overlapping zones → smallest-area wins (`ti-zones.spec.ts:54-57`)
- [x] Spawn in water → relocate along −Z (`territory-spawns.ts` + walkable gate TIW23-26)
- [x] Territory spans zones → centroid `territoryZoneMap` (`spawn-placement.spec.ts:96-105`)
- [x] `NJ_AUTOSIM=0` room moves → zone sync on tick (`TownRoom.spec.ts` helpers + TIW23-49)

---

## Gate Check

| Gate | Command | Result |
| ---- | ------- | ------ |
| Build + lint + test | `nx run-many -t build lint test` | ✅ 0 errors (26 lint warnings pre-existing) |
| Visual | `node scripts/visual-gate.mjs` | ✅ 50/50 PASS (6 landmark GLBs) |
| Fresh test (no cache) | `nx run-many -t test --skip-nx-cache` | ✅ All green |

**Test counts (fresh run, 2026-06-29)**:

| Project | Files | Tests |
| ------- | ----- | ----- |
| game-core | 32 | 169 |
| server | 26 | 349 |
| client | 55 | 272 |
| **Total** | **113** | **790** |

- **Failures**: none
- **Skipped**: none unjustified
- **Slow files**: TownRoom suite ~18 s total — within AD-014 budget (no per-file >10 s observed)

---

## Interactive UAT

Not performed (automated gate + map-overview PNG artifact sufficient for P2 landmarks).

---

## Fix Plans

None required for PASS. Optional follow-up (non-blocking):

1. **TIW23-38 precision** — Add client unit test asserting `getGameState().environment.landmarks` after `setEnvironment` / renderer init.

---

## Requirement Traceability

Verifier did **not** mutate `spec.md` or ROADMAP (orchestrator instruction). All 50 ACs verified above; orchestrator may mark `TIW23-01…50` Verified on PASS acceptance.

---

## Summary

**Overall**: ✅ **PASS**

**Spec-anchored check**: 49/50 direct + 1 spec-precision gap (TIW23-38)
**Sensor**: 3/3 mutations killed
**Gate**: 790 tests passed; build + lint + visual gate green

**What works**: 640 m TI world with six named zones, L2J territory/NPC spawn re-home (613 mob rows), peace/water/combat guards server-authoritative, client zone indicator + landmark props, nav grid and pathfinding refreshed.

**Issues found**: None blocking. TIW23-38 could add a direct `__GAME_STATE__` assertion for stricter traceability.

**Next steps**: Orchestrator may flip ROADMAP/STATE and merge `feat/phase-23-ti-world`.
