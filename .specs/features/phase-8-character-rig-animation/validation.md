# Validation Report — Phase 8: Player Character Rig & Animation

**Verifier**: independent fresh agent (re-verification, fix iteration 1)
**Diff range**: c35cea9..HEAD (035aff5)
**Date**: 2026-06-28
**Verdict**: PASS

**Fix iteration 1 (`035aff5`)**: plugged CHAR-08 ordering and idle clip determinism gaps.

## Per-AC Evidence

| AC | Requirement | Test file:line | Asserted value | Spec value | Status |
|----|-------------|----------------|----------------|------------|--------|
| CHAR-01 | Segmented humanoid; no capsule placeholder for local player | `client/src/scene/creature/humanoid.spec.ts:7-21` | Mesh names `torso`, `head`, `armL`, `armR`, `legL`, `legR` all present | Distinct torso/head/2 arms/2 legs; no monolithic `CapsuleGeometry` player placeholder in scene | PASS (partial) |
| CHAR-02 | Named sockets `root`, `spine`, `head`, `handL`, `handR`, `footL`, `footR` | `client/src/scene/creature/humanoid.spec.ts:23-28` | `validateRig(rig).ok === true`; each `REQUIRED_SOCKETS` entry is `THREE.Object3D` | All seven named sockets present on built rig | PASS |
| CHAR-03 | Bbox height 1.6–2.0 m; feet at y≈0; L/R mirror symmetry | `client/src/scene/creature/humanoid.spec.ts:31-52` | `height ∈ [1.6, 2.0]`; `\|bbox.min.y\| ≤ 0.05`; `\|x_L + x_R\| ≤ 0.01` for hand and foot pairs | Same bounds per spec | PASS |
| CHAR-04 | Locomotion: idle when Δ≤0.02 m, move when Δ>0.02 m | `client/src/scene/player-avatar.spec.ts:17-27` | `avatar.update()` returns `'idle'` at rest and after sub-threshold delta; `'move'` when `MOVE_THRESHOLD + 0.01` (0.03 m) | Threshold 0.02 m; `MOVE_THRESHOLD = 0.02` in `player-avatar.ts:7` | PASS |
| CHAR-05 | `action` uint8 + `actionSeq` uint16 on `PlayerState`, default 0 | `libs/game-core/src/animation/entity-action.spec.ts:5-9`; `server/src/rooms/TownRoom.spec.ts:206-207` | Enum `None=0, Attack=1, Cast=2, Die=3`; on join `action===0`, `actionSeq===0` | Defaults `NONE`/`0` | PASS |
| CHAR-06 | `action=ATTACK=1` + `actionSeq` bumped on melee resolve | `server/src/rooms/TownRoom.spec.ts:545-574` | After first attack `action===1`, `actionSeq===1`; second attack `actionSeq===2` | `ATTACK=1`; seq increments per resolve | PASS |
| CHAR-07 | `action=CAST=2` + `actionSeq` bumped on Power Strike resolve | `server/src/rooms/TownRoom.spec.ts:810-828` | After Power Strike `action===2`, `actionSeq===1` | `CAST=2`; seq increments | PASS |
| CHAR-08 | `action=DIE=3` + `actionSeq` bumped on death **before** respawn restore | `server/src/rooms/TownRoom.spec.ts:775-806,1483-1523` | Spy on `emitPlayerAction`: `hpWhenDieEmitted===0` at DIE emit; post-tick `action===3`, `actionSeq===1`, `hp===maxHp`, spawn restored | DIE + seq before same-tick respawn | PASS |
| CHAR-09 | `actionSeq` change → new clip at `phase=0`; precedence `die>cast>attack>move>idle`; stale seq no-retrigger | `libs/game-core/src/animation/animation-state.spec.ts:33-42,103-127,161-186` | Attack starts `phase===0`; stale seq stays `idle`; seq 3 yields `die` after cast/attack | All three behaviors | PASS |
| CHAR-10 | Duration expiry → locomotion fallback; `die` latched until next seq | `libs/game-core/src/animation/animation-state.spec.ts:55-73,75-101` | Attack at 700 ms → `move`; die at 5000 ms still `die`; seq 2 → `idle` | Expiry + die latch | PASS |
| CHAR-11 | `__GAME_STATE__.player.action` holds clip name; e2e `idle→move→attack→cast` | `client/src/test-hook.spec.ts:68-82`; `client-e2e/src/character-animation.spec.ts:18-150` | `setPlayer({action:'attack'})` → `'attack'`; e2e polls `'idle'`, `'move'`, `'attack'`, `'cast'` | Clip name on hook; full transition chain | PASS |
| CHAR-12 | `action`/`actionSeq` NOT persisted | `server/src/rooms/TownRoom.spec.ts:212-233` | After save/load with `action=1, actionSeq=42`, reloaded player has `0/0` | Not written/read from DB | PASS |

## Spec-Precision Gaps

1. **CHAR-01 (negative, optional P2)**: No test asserts the renderer scene lacks the old monolithic blue `CapsuleGeometry` player placeholder — only positive segment checks in `humanoid.spec.ts`. Remains optional cosmetic gap; not blocking.

## Discrimination Sensor

| Mutant | Location | Fault | Killed by | Status |
|--------|----------|-------|-----------|--------|
| M1 | `libs/game-core/src/animation/animation-state.ts` | Swap precedence so `attack` listed before `die` in `TRANSIENT_PRECEDENCE` | — (no-op: `pickActiveTransient` matches singular `activeAction`; array order immaterial) | KILLED (no-op) |
| M2 | `libs/game-core/src/animation/animation-state.ts` | Remove `actionSeq !== lastSeq` guard (always retrigger) | `nx test game-core` — `does not retrigger a finished clip when actionSeq is unchanged` | KILLED |
| M3 | `server/src/rooms/TownRoom.ts` | Remove `actionSeq++` in `emitPlayerAction` | `nx test server` — `sets ATTACK action and increments actionSeq` (second attack expects `actionSeq===2`) | KILLED |
| M4 | `server/src/rooms/TownRoom.ts` | Move `emitPlayerAction(DIE)` to after respawn HP/position restore | `nx test server` — `sets DIE action before respawn restores HP and position` (`hpWhenDieEmitted===0`) | KILLED |
| M5 | `client/src/scene/creature/humanoid.ts` | Remove `footL` socket from built rig | `nx test client` — `exposes all required sockets` / `validateRig` | KILLED |
| M6 | `client/src/scene/creature/clips.ts` | Add `Math.random()` to `applyIdle` bob computation | `nx test client` — `idle clip is deterministic` / `produces identical transforms for the same idle clip and phase` (`spine.position.y`) | KILLED |
| M7 | `client/src/test-hook.ts` | Remove `action` field assignment in `setPlayer` | `nx test client` — `initializes animation clip to idle and updates from setPlayer` | KILLED |

**Sensor score**: 7/7 killed (M1 re-verified as behaviorally no-op; remaining six fail targeted tests on injection).

### Re-verification notes (fix iteration 1)

- **M4**: Injected `emitPlayerAction(DIE)` after HP restore → `hpWhenDieEmitted` assertion fails. Reverted.
- **M6**: Injected `Math.random() * 0.001` into `applyIdle` spine bob → cross-rig and repeatability `spine.position.y` assertions fail. Reverted.
- **M1**: Injected array reorder → all `animation-state.spec.ts` tests still pass because `TRANSIENT_PRECEDENCE` order does not affect singular `activeAction` lookup. Classified no-op, not a surviving behavioral gap.

## Gate Results

| Command | Result | Test count |
|---------|--------|------------|
| `nx test game-core` | GREEN | 66 |
| `nx test server` | GREEN | 172 |
| `nx test client` | GREEN | 93 |
| `nx e2e client-e2e` | GREEN | 14 |
| `nx run-many -t build lint test` | GREEN | — |

## Deviations Review

**T14** (frame-delta locomotion in `player-avatar.update()` + per-tick `setPlayer(action)` in `renderer.tick()`): Acceptable. Server remains authoritative for position; client derives locomotion clip from replicated position deltas for render + `__GAME_STATE__` observability (AD-009). E2e `character-animation.spec.ts` depends on this for `move→idle` between server patches. No AC weakened.

## Lessons

Prior candidates L-005 (M6) and L-006 (M4) closed by `035aff5`. No new lessons recorded this iteration.
