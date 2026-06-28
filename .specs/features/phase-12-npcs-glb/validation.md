# Phase 12 — NPCs: Rigged Human GLBs Validation

**Date**: 2026-06-28 (re-verify iteration 2, after fix `ecf0327`)
**Spec**: `.specs/features/phase-12-npcs-glb/spec.md`
**Diff range**: `117e265..HEAD` (10 commits; fix iteration 1 `ecf0327`)
**Verifier**: independent sub-agent (author ≠ verifier)

---

## Task Completion

| Task | Status | Notes |
| ---- | ------ | ----- |
| T1 | ✅ Done | `117e265` — manifest + spec (T4 Katerina tune merged here per implementer) |
| T2 | ✅ Done | `211457a` — npc-avatar idle + greet |
| T3 | ✅ Done | `319c082` — npc-renderer mesh path |
| T4 | ✅ Done (merged) | Katerina `Mage.glb` row finalized in T1/`c8dd640` manifest updates |
| T5 | ✅ Done | `c8dd640` — Roxxy GLB (Quaternius via poly.pizza CC0) + manifest |
| T6 | ✅ Done | `01db0de` — renderer tick + `triggerNpcGreet` |
| T7 | ✅ Done | `6e4e1e4` — greet on interact + hook `renderKind`/`action` |
| T8 | ✅ Done | `ee70084` — character-lab `?npc=` + `LAB_NPC` shoot script |
| T9 | ✅ Done | `f51b3a1` — town e2e NPC mesh + greet assertions |
| T10 | ✅ Done | Verification-only — `nx test server` green, no schema diff |
| T11 | ✅ Done | `58afe95` — PNGs in `client-e2e/artifacts/npc-gate/` |
| T12 | ✅ Done | `75a2fe8` — integration gate commit |
| Fix-1 | ✅ Done | `ecf0327` — NPCG-08/09/20 unit test coverage gaps |

---

## Spec-Anchored Acceptance Criteria

### P1: NPC Manifest

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| NPCG-01: `getNpcEntry(30004)` | `NpcEntry` with `model`, `clipMap`, `scale`, `feetOffsetY`, `displayName` **Katerina** | `npc-manifest.spec.ts:10-17` — `expect(entry?.displayName).toBe('Katerina')`; model `/models/characters/Mage.glb` | ✅ PASS |
| NPCG-02: `getNpcEntry(30006)` | `displayName` **Roxxy** | `npc-manifest.spec.ts:20-27` — `expect(entry?.displayName).toBe('Roxxy')`; model `/models/npcs/Roxxy.glb` | ✅ PASS |
| NPCG-03: unknown `npcId` | `null` | `npc-manifest.spec.ts:30-31` — `expect(getNpcEntry(99999)).toBeNull()` | ✅ PASS |
| NPCG-04: `clipMap` keys → real tracks | `idle`, `move`, `attack`, `cast`, `die` map to asset track names; Katerina `cast: 'Interact'` | `npc-manifest.spec.ts:34-43` — literal track assertions; visual gate PNGs confirm rigs animate | ✅ PASS |

### P1: Rigged NPC Avatar

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| NPCG-05: mapped NPC → rigged GLB | Mesh-backed group, not `CapsuleGeometry` / box head | `npc-renderer.spec.ts:102-103` — `renderKind: 'mesh'`, `usesCapsule: false` | ⚠️ Spec-precision — asserts flags, not geometry type (cf. Phase 11 `usesCapsuleGeometry`) |
| NPCG-06: no locomotion → `idle` | Continuous `idle` clip | `npc-avatar.spec.ts:38-42` — `expect(avatar.update(...)).toBe('idle')` | ✅ PASS |
| NPCG-07: position snap | Group at `(x, y - feetOffsetY, z)` | `npc-avatar.spec.ts:45-50` — `expect(avatar.group.position.y).toBeCloseTo(3.76, 5)` with stub `feetOffsetY: 0.5` | ✅ PASS |
| NPCG-08: GLB load failure → capsule | Fall back without throw | `npc-renderer.spec.ts:150-189` — mock `ready` rejects; `usesCapsule: true`, `renderKind: 'capsule'`, `body` mesh present | ✅ PASS (closed in `ecf0327`) |
| NPCG-09: `mixer.update(dt)` each tick | `character.update(dt)` per live instance | `npc-renderer.spec.ts:191-211` — `expect(update).toHaveBeenCalledWith(0.016, 100)` | ✅ PASS (closed in `ecf0327`) |

### P1: Replace Capsule Renderer

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| NPCG-10: `syncNpcVisual` 30004/30006 → mesh | `userData.renderKind: 'mesh'` | `npc-renderer.spec.ts:85-104` (30004); `npc-renderer.spec.ts:127-147` (30006 remove path creates mesh) | ✅ PASS |
| NPCG-11: `removeNpc` cleanup | Scene group + instance map removed | `npc-renderer.spec.ts:144-147` | ✅ PASS |
| NPCG-12: `npcStateToVisual` mapping | Preserves `npcId`, role, coordinates | `npc-renderer.spec.ts:56-77` — Katerina `(-6, 4.26, -8)` Merchant | ✅ PASS |

### P1: Test Observability

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| NPCG-13: hook `renderKind: 'mesh'` | Both 30004 and 30006 | `town.spec.ts:60-61` — `expect(katerina?.renderKind).toBe('mesh')` | ✅ PASS |
| NPCG-14: idle `action` at join | `action === 'idle'` | `town.spec.ts:62-63` | ✅ PASS |
| NPCG-15: hook `action` from tick | Reflects current clip vocabulary | `test-hook.spec.ts:186-205` — `setNpcs` storage; e2e greet polls `town.spec.ts:92-101`, `154-163` | ⚠️ Spec-precision — hook storage unit test; renderer→hook wiring via e2e |

### P2: Greet / Talk Gesture

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| NPCG-16: Katerina shop open → `cast` ≤2 s | `action === 'cast'` | `town.spec.ts:92-101` — `expect.poll(..., { timeout: 2_000 }).toBe('cast')` | ✅ PASS |
| NPCG-17: Roxxy dialog → `cast` ≤2 s | `action === 'cast'` | `town.spec.ts:154-163` | ✅ PASS |
| NPCG-18: greet completes → `idle` | Return to idle after duration | `npc-avatar.spec.ts:53-59` — `ACTION_DURATION_MS[Cast]` then `'idle'` | ✅ PASS |
| NPCG-19: greet faces player | Yaw toward player `x,z` | `npc-avatar.spec.ts:62-68` — `atan2` within tolerance | ✅ PASS |
| NPCG-20: no greet stack on spam | At most one greet per UI open | `npc-avatar.spec.ts:71-101` — `playSpy` single `'cast'` play; yaw unchanged on same-epoch spam; no replay after cast ends | ✅ PASS (closed in `ecf0327`) |

### P2: Visual Gate

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| NPCG-21: shoot script PNGs idle + cast | Per NPC 30004/30006 | `client-e2e/artifacts/npc-gate/npc-30004-idle.png`, `npc-30004-cast.png`, `npc-30006-idle.png`, `npc-30006-cast.png` | ✅ PASS |
| NPCG-22: distinct silhouettes, not capsule | Human females, visually distinct | Verifier image review: Katerina = KayKit Mage (purple robes/staff); Roxxy = green-dress Quaternius woman; neither capsule/box-head | ✅ PASS |
| NPCG-23: feet on ground ≤0.15 m | No float/sink | Verifier image review: both idle frames show feet on lab plane with natural shadow contact | ✅ PASS |

**Status**: ✅ All ACs covered — 3 non-blocking spec-precision notes (NPCG-05, NPCG-15, manifest `feetOffsetY` tuning via stub in NPCG-07)

---

## Previous Gaps — Re-check (iteration 1 → iteration 2)

| Gap | Iteration 1 | Iteration 2 (`ecf0327`) |
| --- | ----------- | ------------------------ |
| NPCG-08 load-failure fallback | ❌ No test | ✅ `npc-renderer.spec.ts:150-189` |
| NPCG-09 tick `update(dt)` | ❌ No spy | ✅ `npc-renderer.spec.ts:191-211` |
| NPCG-20 greet debounce | ❌ Shallow clip-only assert | ✅ `npc-avatar.spec.ts:71-101` playSpy + yaw + epoch |

---

## Implementer Deviations (checked)

| Deviation | Assessment |
| --------- | ---------- |
| T4 merged into T1 | ✅ Acceptable — Katerina row in `117e265`, tune in `c8dd640` |
| Roxxy from poly.pizza mirror (CC0) | ✅ Acceptable — `LICENSE.txt` cites Quaternius Animated Woman |
| Visual gate dev server port 4201 | ✅ Acceptable — PNG artifacts committed |
| T10 verification-only (no commit) | ✅ Acceptable — server regression green |

---

## Discrimination Sensor

Scratch mutations applied to working tree, `nx test client --testFile=… --skip-nx-cache`, then restored.

| Mutation | File:line | Description | Killed? |
| -------- | --------- | ----------- | ------- |
| M1 | `npc-manifest.ts:34` | `displayName: 'Katerina'` → `'Wrong'` | ✅ Killed — `npc-manifest.spec.ts:13` |
| M2 | `npc-avatar.ts:99` | Remove `character.update(dt)` | ❌ Survived — renderer spy asserts `avatar.update` call, not inner `mesh.update` |
| M3 | `npc-avatar.ts:73` | Disable `uiEpoch === lastGreetUiEpoch` guard | ✅ Killed — `npc-avatar.spec.ts:80` playSpy length |
| M4 | `npc-renderer.ts:117-129` | Delete `avatar.ready.catch` fallback block | ✅ Killed — `npc-renderer.spec.ts:150-189` |
| M5 | `npc-manifest.ts:16` | `cast: 'Interact'` → `'FakeTrack'` | ✅ Killed — `npc-manifest.spec.ts:36` |
| M6 | `npc-manifest.ts:33` | `feetOffsetY: 0.75` → `0` | ❌ Survived — avatar spec uses hardcoded stub entry, not manifest |
| M7 | `npc-avatar.ts:87` | Force `action = EntityAction.None` (no greet) | ✅ Killed — `npc-avatar.spec.ts:57` |

**Sensor depth**: lightweight (7 targeted mutations, scratch restore)
**Result**: 5/7 killed — ✅ PASS (2 non-blocking survivors: M2 internal mixer call, M6 manifest-vs-stub tuning)

**Iteration 1 comparison**: was 3/7 killed (M2, M3, M4, M6 survived). Fix `ecf0327` killed M3 and M4; M2/M6 remain acceptable spec-precision.

---

## Code Quality

| Principle | Status |
| --------- | ------ |
| Minimum code | ✅ Reuses `createMeshCharacter`, `stepAnimation`, mob fallback pattern |
| Surgical changes | ✅ Client scene/net/hook + one new GLB |
| No scope creep | ✅ No server schema changes |
| Matches patterns | ✅ Mirrors Phase 8/10 avatar + Phase 6 NPC sync |
| Spec-anchored outcome check | ✅ 23/23 ACs with evidence; 3 non-blocking precision notes |
| Per-layer coverage | ✅ Unit + e2e + visual gate |
| Tests map to ACs | ✅ |
| Guidelines | ✅ `AGENTS.md` AD-009/010/014/017; server authority preserved |

---

## Edge Cases

- [x] Unmapped `npcId` → capsule — `npc-renderer.spec.ts:106-125`
- [x] Greet requires interact UI open — e2e shop/dialog flows; no proximity-only greet
- [x] Roxxy independent `clipMap` — `ROXXY_CLIP_MAP` in `npc-manifest.ts:20-26`
- [x] Position re-sync without recreate — `applyNpcVisual` updates existing instance
- [x] GLB load failure → capsule — `npc-renderer.spec.ts:150-189`

---

## Gate Check

- **Gate command**: `nx run-many -t build lint test --projects=client,server` + `nx e2e client-e2e`
- **Build/lint/unit**: ✅ build pass, lint pass (warnings only), **143 client unit tests** pass (`--skip-nx-cache`)
- **Server regression**: ✅ `nx test server` green (no schema diff)
- **E2E**: ✅ **19/19 pass** (includes 3 town NPC tests)
- **Client unit tests before feature** (at `117e265^`): 128 (Phase 11 baseline)
- **Client unit tests after fix** (HEAD): 143 (+15: manifest 4, avatar 5, renderer +6)
- **Skipped tests**: none
- **Failures**: none

**Visual gate**: `client-e2e/artifacts/npc-gate/npc-{30004,30006}-{idle,cast}.png` — Katerina Mage + Roxxy green dress, distinct, feet grounded.

---

## Requirement Traceability Update

| Requirement | Previous Status | New Status |
| ----------- | --------------- | ---------- |
| NPCG-01–07, 10–14, 16–19, 21–23 | Verified / gaps | ✅ Verified |
| NPCG-05 | ⚠️ renderKind only | ⚠️ Verified via flags (geometry not asserted) |
| NPCG-08 | ❌ Needs Fix | ✅ Verified (`ecf0327`) |
| NPCG-09 | ❌ Needs Fix | ✅ Verified (`ecf0327`) |
| NPCG-15 | ⚠️ e2e only | ⚠️ Verified via e2e + hook storage unit |
| NPCG-20 | ❌ Needs Fix | ✅ Verified (`ecf0327`) |

---

## Summary

**Overall**: ✅ Ready

**Spec-anchored check**: 23/23 ACs with matching evidence; 3 non-blocking spec-precision notes
**Sensor**: 5/7 mutations killed (up from 3/7); 2 non-blocking survivors (M2, M6)
**Gate**: build/lint/unit ✅ 143 tests; server ✅; e2e ✅ 19/19

**What works**: NPC manifest, rigged mesh rendering for Katerina/Roxxy, idle loop, feet offset positioning, GLB load-failure capsule fallback (tested), per-tick avatar update (tested), greet on shop/dialog with debounce (tested), e2e hook assertions, visual gate PNGs with distinct silhouettes, Phase 6 buy flow regression (1000 → 897 adena).

**Issues found**: None blocking. Optional future hardening: spy `mesh.update` inside `npc-avatar` (M2); manifest-driven feetOffsetY integration test (M6).

**Next steps**: Orchestrator may flip ROADMAP/STATE and mark phase complete.
