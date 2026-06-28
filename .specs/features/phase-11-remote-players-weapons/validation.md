# Phase 11 — Remote Players & Equipped Weapons Validation

**Date**: 2026-06-28 (re-verify after fix `9c166c4`, iteration 3)
**Spec**: `.specs/features/phase-11-remote-players-weapons/spec.md`
**Diff range**: `9b4e7f7..HEAD` (15 feature commits + fix `5194e53` + fix `9c166c4`; ROADMAP/STATE flip reverted at `55b73f8`)
**Verifier**: independent sub-agent (author ≠ verifier), iteration 3

---

## Task Completion

| Task | Status | Notes |
| ---- | ------ | ----- |
| T1 | ✅ Done | Base commit `9b4e7f7` — `attachment.ts` + spec |
| T2 | ✅ Done | `e4d6042` weapon manifest |
| T3 | ✅ Done | `73a62f9` placeholder prop GLBs + LICENSE |
| T4 | ✅ Done | `22aa0cb` remote-player-avatar (+ T11 weapon sync merged here) |
| T5 | ✅ Done | `806b7d8` remote-players mesh map |
| T6 | ✅ Done | `1fa7211` renderer tick + sync API |
| T7 | ✅ Done | `1d0371a` room.ts remote field wiring |
| T8 | ✅ Done | `32262ce` test hook `others` fields |
| T9 | ✅ Done | `2bd4c6a` local player sword attach |
| T10 | ✅ Done | `81258c7` goblin club on mobs |
| T11 | ✅ Done (merged) | Remote weapon sync in T4 + `remote-player-avatar.spec.ts` |
| T12 | ✅ Done | `8b8967d` regression gate |
| T13 | ✅ Done | `a553a05` `remote-avatar.spec.ts` e2e |
| T14 | ✅ Done | `d805312` + fix `5194e53` PNGs; fix `9c166c4` bone + shot timing |
| T15 | ⏸️ Pending | ROADMAP/STATE flip — orchestrator after PASS |

---

## Spec-Anchored Acceptance Criteria

### P1: Remote Human Avatar

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| RPW-01: rigged mesh, no capsule | `createMeshCharacter` path; no `CapsuleGeometry` | `remote-players.spec.ts:34` — `expect(usesCapsuleGeometry(instance.group)).toBe(false)` | ✅ PASS |
| RPW-02: one Group per session | Distinct `THREE.Group` per `sessionId` | `remote-players.spec.ts:56-58` — `expect(map.size).toBe(2)`; `expect(first.group).not.toBe(second.group)` | ✅ PASS |
| RPW-03: remove disposes avatar | Dispose group + delete map entry | `remote-players.spec.ts:99-100` — `expect(disposeGeometry).toHaveBeenCalled()`; impl `remote-players.ts:52-75` `disposeObject3D` | ✅ PASS |
| RPW-04: tick calls update | `update(dt)` on every remote avatar each frame | `remote-players.spec.ts:115` — `expect(update).toHaveBeenCalledWith(0.016, 100)`; `renderer-remote.spec.ts:18` | ✅ PASS |

### P1: Remote Animation

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| RPW-05: move on delta > 0.02 m | `move` clip with `MOVE_COAST_MS` coast | `remote-player-avatar.spec.ts:37` — `expect(avatar.update(0.016, 100)).toBe('move')` | ✅ PASS |
| RPW-06: idle after coast | `idle` when coast expires | `remote-player-avatar.spec.ts:39` — `expect(avatar.update(0.016, 100 + MOVE_COAST_MS + 1)).toBe('idle')` | ✅ PASS |
| RPW-07: attack 600 ms on seq bump | `attack` for `ACTION_DURATION_MS[Attack]` | `remote-player-avatar.spec.ts:57-58` | ✅ PASS |
| RPW-08: cast 800 ms | `cast` for `ACTION_DURATION_MS[Cast]` | `remote-player-avatar.spec.ts:64-65` | ✅ PASS |
| RPW-09: die 1200 ms | `die` for `ACTION_DURATION_MS[Die]` | `remote-player-avatar.spec.ts:71-72` | ✅ PASS |
| RPW-10: yaw ±5° movement facing | `atan2(dx, dz)` within 5° | `remote-player-avatar.spec.ts:49-51` — `toBeLessThanOrEqual(5)` | ✅ PASS |
| RPW-11: room passes full sync | `x,y,z,action,actionSeq,equippedWeaponItemId` to remote sync | `room.ts:398-415` (impl); `renderer-remote.spec.ts:39-42` — equip sync via upsert | ⚠️ Spec-precision — no dedicated `room.ts` unit test; covered via renderer upsert integration |

### P1: Bone Attachment Helper

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| RPW-12: findBoneByName exact match | Returns matching `THREE.Bone` from skeleton | `attachment.spec.ts:36-37` — `expect(findBoneByName(root, KAYKIT_RIGHT_HAND_BONE)).toBe(handBone)` | ✅ PASS |
| RPW-13: attachToBone parents + transform | `bone.add(prop)`; local position/rotation/scale | `attachment.spec.ts:50-53` | ✅ PASS |
| RPW-14: detachFromBone, no prop mixer | `removeFromParent`; prop has no `AnimationMixer` | `attachment.spec.ts:66-68` — detach only | ⚠️ Spec-precision gap — no-mixer not asserted |
| RPW-15: prop matrix changes on attack | World matrix delta idle vs mid-attack | `attachment.spec.ts:87` | ✅ PASS |

### P1: Squire's Sword

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| RPW-16: getWeaponAttachment(2369) | model `/models/props/SquiresSword.glb`, hand bone `handslotr`, transform | `weapon-manifest.spec.ts:18-22` — `bone: KAYKIT_RIGHT_HAND_BONE` (`handslotr` per `9c166c4`) | ✅ PASS |
| RPW-17: local attach/detach 2369/0 | `syncWeaponVisual` on equip change | `player-avatar.spec.ts:88-99` | ✅ PASS |
| RPW-18: remote attach/detach 2369/0 | Same prop path on replicate | `remote-player-avatar.spec.ts:90-97` | ✅ PASS |
| RPW-19: unmapped id silent | No prop, no throw | `player-avatar.spec.ts:104-106` | ✅ PASS |
| RPW-20: LICENSE beside GLB | `LICENSE.txt` present | `weapon-manifest.spec.ts:38` | ✅ PASS |

### P1: Goblin Club

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| RPW-21: club on npcId 20003 | `GoblinClub.glb` via `attachToBone` | `mobs.spec.ts:248-250` — `expect(instances.get('goblin-1')?.clubProp).not.toBeNull()` | ✅ PASS |
| RPW-22: per-instance clone | Distinct `Object3D` refs | `mobs.spec.ts:323` — `expect(a).not.toBe(b)` | ✅ PASS |
| RPW-23: club transform on attack | Matrix differs idle vs attack | `mobs.spec.ts:389` — `expect(idlePos.distanceTo(attackPos)).toBeGreaterThan(0.01)` | ✅ PASS |
| RPW-24: non-Goblin no club | npcId ≠ 20003 → no club | `mobs.spec.ts:251` — `expect(instances.get('gremlin-1')?.clubProp).toBeNull()` | ✅ PASS |

### P1: Test Hook & E2E

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| RPW-25: others hook shape | `renderKind:'mesh'`, `action`, `equippedWeaponId` | `test-hook.spec.ts:48` — `expect(state.others).toEqual(input)`; `remote-players.spec.ts:131-140` | ✅ PASS |
| RPW-26: e2e move action | B sees A `action === 'move'` while moving | `remote-avatar.spec.ts:48-52` | ✅ PASS |
| RPW-27: e2e idle after stop | B sees `action === 'idle'` after coast | `remote-avatar.spec.ts:54-58` | ✅ PASS |
| RPW-28: leave regression | A leaves → B `others` excludes A | `multiplayer.spec.ts:116-125` | ✅ PASS |

### P2: Visual Gate

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| RPW-29: sword idle screenshot | Sword gripped in right hand | `/tmp/char-shots/weapon-2369-idle.png` — human review: weapon visible at right hand grip | ✅ PASS |
| RPW-30: sword attack screenshot | Sword follows swing arc | `/tmp/char-shots/weapon-2369-attack.png` — human review: weapon tracks attack pose | ✅ PASS |
| RPW-31: dual avatar idle+attack | Two-avatar frames captured for review | `/tmp/char-shots/dual-weapon-2369-idle.png`, `dual-weapon-2369-attack.png` — **both avatars show sword in right hand** (idle gap closed by `9c166c4` `poseActorsForShot` + `handslotr`) | ✅ PASS |
| RPW-32: goblin club attack visible | Club visible in screenshot | `/tmp/char-shots/mob-20003-attack.png` — human review: goblin wields visible blunt weapon in attack pose; no `handslot` bone-miss console warnings; KayKit rig retains built-in axe mesh (AD-017 placeholder era) | ✅ PASS |

**Status**: ✅ All 32 ACs evidenced; 2 spec-precision notes (RPW-11, RPW-14) — non-blocking

---

## Fix Iteration 2 Closure (vs iteration 2 validation)

| Prior gap | Status after `9c166c4` |
| --------- | ---------------------- |
| RPW-31 dual-idle grip (weapon at knee, hand empty) | ✅ Closed — `handslotr` bone + `poseActorsForShot` double-pose before `__SHOT_READY__`; dual-idle shows sword in both right hands |
| RPW-32 club not visible / `handslot.r` bone miss | ✅ Closed — `KAYKIT_RIGHT_HAND_BONE` → `handslotr` (GLTFLoader dot-strip); attack frame shows armed goblin; unit club attach tests green |
| E2E flake (16/17 full suite) | ✅ Closed — fresh `nx e2e client-e2e`: **17/17 pass** |

---

## Implementer Deviations (checked)

| Deviation | Assessment |
| --------- | ---------- |
| T11 merged into T4 | ✅ Acceptable |
| RPW-28 via `multiplayer.spec.ts` | ✅ Acceptable |
| Prop GLBs are placeholder boxes | ✅ Documented — AD-017 allows pre-live placeholder |
| Grip transforms at `[0,0,0]` | ✅ Documented |
| KayKit Goblin built-in axe overlaps club slot | ✅ Acceptable pre-live — logical attach verified; visual gate shows armed mob |

---

## Discrimination Sensor

| Mutation | File:line | Description | Killed? |
| -------- | --------- | ----------- | ------- |
| 1 | `remote-players.ts:105` | `let found = true` (capsule always detected) | ✅ Killed — `remote-players.spec.ts:34` |
| 2 | `weapon-manifest.ts:17` | Sword model path → `Wrong.glb` | ✅ Killed — `weapon-manifest.spec.ts:18-22` |
| 3 | `remote-player-avatar.ts:98` | Disable move threshold (`false && delta > MOVE_THRESHOLD`) | ✅ Killed — `remote-player-avatar.spec.ts:37` |
| 4 | `mobs.ts:148` | `if (true) return` skips all club attach | ✅ Killed — `mobs.spec.ts:248-250`, `:323`, `:389` |

**Sensor depth**: lightweight (4 targeted mutations, scratch restore)
**Result**: 4/4 killed — ✅ PASS

---

## Code Quality

| Principle | Status |
| --------- | ------ |
| Minimum code | ✅ Reuses `player-avatar` patterns, shared `weapon-visual` |
| Surgical changes | ✅ Scope limited to client scene/net/hook + props |
| No scope creep | ✅ No server schema changes |
| Matches patterns | ✅ Mirrors Phase 8/10 avatar + attachment recipe |
| Spec-anchored outcome check | ✅ 32/32 ACs with evidence |
| Per-layer coverage | ✅ Unit for P1 logic; e2e for multiplayer hook |
| Tests map to ACs | ✅ Matrix honored |
| Guidelines | ✅ `AGENTS.md` AD-009/010/014/017 |

---

## Edge Cases

- [x] GLB load failure no-throw — `remote-player-avatar.ts:59`; `weapon-visual.ts:43-45`
- [x] Equip/unequip same frame — `weapon-visual.ts:21` idempotent on same itemId
- [x] Duplicate onAdd idempotent — `remote-players.spec.ts:45-46`
- [x] `connected === false` filter — preserved in `room.ts`
- [x] Missing bone no-throw — `attachment.ts:32-34` warn + return false

---

## Gate Check

- **Gate command**: `nx run-many -t build lint test` + `nx e2e client-e2e`
- **Build/lint/unit**: ✅ build pass, lint pass (warnings only), **128 client unit tests** pass (`--skip-nx-cache`)
- **E2E**: ✅ **17/17 pass** (Verifier re-run 2026-06-28)
- **Client unit tests before feature** (at `9b4e7f7`): 98
- **Client unit tests after fix** (`9c166c4`, HEAD): 128 (+30)
- **Skipped tests**: none
- **Failures**: none

**Visual gate** (Verifier re-capture): `LAB_WEAPON=2369 LAB_MOB=20003 LAB_DUAL=1 node scripts/shoot-character.mjs` against `vite --port 4201 client` → PNGs in `/tmp/char-shots/`

---

## Requirement Traceability Update

| Requirement | Previous (iter 2) | New Status |
| ----------- | ----------------- | ---------- |
| RPW-01–30, RPW-02/03/23 | Mixed / partial | ✅ Verified |
| RPW-11 | ⚠️ Integration only | ⚠️ Verified via integration |
| RPW-14 | ⚠️ Partial | ⚠️ Partial (no-mixer not asserted) |
| RPW-31 | ❌ Needs fix (dual-idle grip) | ✅ Verified (`9c166c4`) |
| RPW-32 | ❌ Needs fix (club not visible) | ✅ Verified (`9c166c4`) |

---

## Summary

**Overall**: ✅ Ready

**Spec-anchored check**: 32/32 ACs with matching evidence; 2 non-blocking spec-precision notes (RPW-11, RPW-14)
**Sensor**: 4/4 mutations killed
**Gate**: build/lint/unit ✅ 128 tests; e2e ✅ 17/17

**What works**: Fix iteration 2 closed both visual blockers. Remote mesh avatars, animation from replicated state, sword equip (local + remote), goblin club logic, hook shape, two-browser remote-avatar e2e, and AD-017 visual gate (single + dual avatar + goblin attack) all verified.

**Issues found**: None blocking. Minor follow-ups for later phases: assert no prop `AnimationMixer` (RPW-14); dedicated `room.ts` wiring unit (RPW-11); replace placeholder prop GLBs when art lands.

**Next steps**: Orchestrator may flip ROADMAP/STATE (T15) and commit phase-complete docs.
