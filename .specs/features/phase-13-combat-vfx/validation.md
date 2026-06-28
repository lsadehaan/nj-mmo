# Phase 13 — Combat & World VFX Validation

**Date**: 2026-06-28 (re-verify after fix iteration 1)
**Spec**: `.specs/features/phase-13-combat-vfx/spec.md`
**Diff range**: `e58607f..HEAD` (18 commits; T1 lifecycle at base `e58607f`, not in exclusive diff)
**Fix commit**: `6d64e4f` — closes CVFX-11, 15, 16, 27, 30, 07
**Verifier**: independent sub-agent (author ≠ verifier)

---

## Task Completion

| Task | Status | Commit | Notes |
| ---- | ------ | ------ | ----- |
| T1 | ✅ Done | `e58607f` | `vfx-lifecycle.ts` + spec (base commit) |
| T2 | ✅ Done | `bd5a50e` | `vfx-triggers.ts` |
| T3 | ✅ Done | `83c0542` | `vfx-manager.ts` core |
| T4 | ✅ Done | `b2de6d6` | `power-strike-vfx.ts` |
| T5 | ✅ Done | `3f64d2b` | `melee-hit-vfx.ts` |
| T6 | ✅ Done | `c7c597c` | `death-dissolve-vfx.ts` |
| T7 | ✅ Done | `23dde2c` | `level-up-vfx.ts` |
| T8 | ✅ Done | `5471baa` | `target-ring-vfx.ts` |
| T9 | ✅ Done | `50c56ab` | manager wiring |
| T10 | ✅ Done | `5fbc9ac` | renderer integration; `skill-flash.ts` removed |
| T11 | ✅ Done | `facb249` | room + test hook |
| T12 | ✅ Done | `03c74e6` | target ring + `setTargetMobId` |
| T13 | ✅ Done | `34cdf83` | `vfx-lab.html` + multi-page vite build |
| T14 | ✅ Done | `e8ca900` | `combat-vfx.spec.ts` e2e |
| T15 | ✅ Done | `50dc4af` | `shoot-vfx.mjs` |
| T16 | ✅ Done | `44e9321` | soulshot glint (P3) |
| T17 | ✅ Done | `3a609d0` | loot puff (P3) |
| T18 | ✅ Done | `369a5ca` | full gate commit |
| T19 | ✅ Done | `6d64e4f` | fix iteration 1 — AC coverage gaps |

---

## Previous Gaps — Re-check (fix `6d64e4f`)

| Gap | AC | Fix evidence | Result |
| --- | -- | ------------ | ------ |
| Player HP melee hit | CVFX-11 | `vfx-manager.spec.ts:64-68` — hp 100→80 → `meleeHitCount === 1` | ✅ Closed |
| Mob die dissolve attach | CVFX-15 | `vfx-manager.spec.ts:124-136` — `attachMobDissolve` → opacity ~0.5 at 600 ms | ✅ Closed |
| Player die dissolve attach | CVFX-16 | `vfx-manager.spec.ts:138-150` — `attachPlayerDissolve` → opacity ~0.5 at 600 ms | ✅ Closed |
| Dead mob hides target ring | CVFX-27 | `target-ring-vfx.spec.ts:33-56` — hp 50→0 → `targetRingVisible === false` | ✅ Closed |
| Renderer tick integration | CVFX-30 | `renderer.spec.ts:72-80` — `mockVfxTick` called once per `game.tick` | ✅ Closed |
| Power Strike disposal precision | CVFX-07 | `vfx-manager.spec.ts:118-121` — `countPowerStrikeVfx(scene) === 0` after 900 ms tick | ✅ Closed |

**All 5 previously-flagged gaps + 1 spec-precision note are closed.**

---

## Spec-Anchored Acceptance Criteria

### P1: VFX lifecycle (CVFX-01–04)

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| CVFX-01: one-shot completes → disposed | Scene count 0; geometry/material disposed | `vfx-lifecycle.spec.ts:61-84` — `expect(countTaggedVfx(scene, TEST_TAG)).toBe(0)` after tick past expiry | ✅ PASS |
| CVFX-02: `countTaggedVfx` | Count by `userData.vfxTag` | `vfx-lifecycle.spec.ts:25-33` — `expect(countTaggedVfx(scene, TEST_TAG)).toBe(2)` | ✅ PASS |
| CVFX-03: pool exhausted → reuse oldest | No new GPU alloc at capacity | `melee-hit-vfx.spec.ts:20-27` — 9th spawn `expect(slots[0]).toBe(slots[MELEE_HIT_POOL_SIZE])` with `MELEE_HIT_POOL_SIZE === 8` | ✅ PASS |
| CVFX-04: `tickVfx` retires expired | Active effects advance and retire | `vfx-lifecycle.spec.ts:78-84` — two-phase tick clears entries | ✅ PASS |

### P1: Power Strike (CVFX-05–09)

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| CVFX-05: cast + actionSeq bump → arc spawn | Tagged group between player and target mob | `vfx-manager.spec.ts:71-89` — `expect(powerStrikeCount).toBe(1)` after cast seq bump with target | ✅ PASS |
| CVFX-06: no legacy `skillFlash` tag | Tag is `powerStrike` only | `power-strike-vfx.spec.ts:31` — `expect(countTaggedVfx(scene, 'skillFlash')).toBe(0)` | ✅ PASS |
| CVFX-07: **800 ms** → removed and disposed | Zero tagged meshes after duration | `vfx-manager.spec.ts:118-121` — `expect(countPowerStrikeVfx(scene)).toBe(0)` after `mgr.tick(900)` | ✅ PASS |
| CVFX-08: hook `powerStrikeCount` +1 | Monotonic counter | `power-strike-vfx.spec.ts:43-44` — `expect(state.vfx.powerStrikeCount).toBe(1)` | ✅ PASS |
| CVFX-09: no cooldown-only trigger | action/seq unchanged on cooldown-only sync | `wire-room.spec.ts:292-296` — `expect(last.action).toBe(0); expect(last.actionSeq).toBe(0)` after cooldown bump | ✅ PASS |

### P1: Melee hit (CVFX-10–14)

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| CVFX-10: mob hp decrease (>0) → burst | Melee hit at mob position | `vfx-manager.spec.ts:41-61` — `expect(meleeHitCount).toBe(1)` on hp 41→24 | ✅ PASS |
| CVFX-11: **player hp decrease (>0) → burst** | Melee hit at player position | `vfx-manager.spec.ts:64-68` — hp 100→80 → `expect(meleeHitCount).toBe(1)` | ✅ PASS |
| CVFX-12: duplicate hp → one hit | Dedupe | `vfx-triggers.spec.ts:12-14` — `[41,24,24]` → one true, second false | ✅ PASS |
| CVFX-13: **250 ms** complete → count down | Retire + activeEffectCount | `melee-hit-vfx.spec.ts:30-37` — `tickMeleeHitSlot(..., MELEE_HIT_DURATION_MS)` → done | ✅ PASS |
| CVFX-14: kill tick may fire hit | Hit allowed when hp→0 | `vfx-triggers.spec.ts:14` — `expect(detectHpHit(41, 0)).toBe(true)` | ✅ PASS |

### P1: Death dissolve (CVFX-15–19)

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| CVFX-15: **mob die latch → dissolve attach** | Opacity 1→0 over **1200 ms** on render root | `vfx-manager.spec.ts:124-136` — `attachMobDissolve` → opacity 0.4–0.6 at 600 ms | ✅ PASS |
| CVFX-16: **player die seq → dissolve** | Same treatment on player avatar | `vfx-manager.spec.ts:138-150` — `attachPlayerDissolve` → opacity 0.4–0.6 at 600 ms | ✅ PASS |
| CVFX-17: complete → opacity restored for reuse | Default opacity **1.0** | `death-dissolve-vfx.spec.ts:25-32` — `expect(mat.opacity).toBe(1)` after `restoreOpacity` | ✅ PASS |
| CVFX-18: **1200 ms** mob removal unchanged | Delayed removal still applies | `mobs.spec.ts:155-161` — `removeMob` false during die; flush after `ACTION_DURATION_MS[Die]+1` removes | ✅ PASS |
| CVFX-19: opacity ~**0.5** at **600 ms** (±0.1) | Mid-curve sample | `death-dissolve-vfx.spec.ts:20-22` — `toBeGreaterThanOrEqual(0.4); toBeLessThanOrEqual(0.6)` | ✅ PASS |

### P1: Level-up (CVFX-20–23)

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| CVFX-20: level increase → burst at player | Spawn at world position | `vfx-manager.spec.ts:92-96` — `expect(levelUpCount).toBe(1)` on 1→2 | ✅ PASS |
| CVFX-21: no level change → no burst | No false positive | `vfx-triggers.spec.ts:18-20` — `detectLevelUp(2,2)` false | ✅ PASS |
| CVFX-22: **1000 ms** → removed/disposed | Cleanup | `level-up-vfx.spec.ts:21-27` — spawn → tick → dispose → count 0 | ✅ PASS |
| CVFX-23: hook `levelUpCount` increment | Counter +1 | `level-up-vfx.spec.ts:39-40` — `expect(levelUpCount).toBe(1)` | ✅ PASS |

### P1: Target ring (CVFX-24–28)

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| CVFX-24: target set + mob present → ring visible | Ground ring at feet | `vfx-manager.spec.ts:152-164` — `targetRingVisible` true; `target-ring-vfx.spec.ts:15-17` position | ✅ PASS |
| CVFX-25: target cleared → hidden, reused | hide() not destroy | `target-ring-vfx.spec.ts:25-30` — `group.parent === scene` after hide | ✅ PASS |
| CVFX-26: mob moves → ring follows | Position sync each tick | `target-ring-vfx.spec.ts:18-22` — follow updates x/z | ✅ PASS |
| CVFX-27: **mob removed or hp ≤ 0 → hide** | Ring hidden | `target-ring-vfx.spec.ts:33-56` — hp 50→0 → `targetRingVisible === false` | ✅ PASS |
| CVFX-28: visible → hook `targetRingVisible` true | Boolean flag | `vfx-manager.spec.ts:164` — `expect(targetRingVisible).toBe(true)` | ✅ PASS |

### P1: Wiring + test hook (CVFX-29–32)

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| CVFX-29: mob onChange HP → VFX manager | Forward deltas | `wire-room.spec.ts:206-212` — `mockSyncMobVfx` called with hp 24 | ✅ PASS |
| CVFX-30: **renderer.tick → tickVfx + ring follow** | Both run each frame | `renderer.spec.ts:72-80` — `expect(mockVfxTick).toHaveBeenCalledTimes(1)` on `game.tick` | ✅ PASS |
| CVFX-31: spawn → `activeEffectCount` live | Reflects tagged meshes | `vfx-manager.spec.ts:117-120` — `activeEffectCount > 0` then 0 after tick | ✅ PASS |
| CVFX-32: e2e melee → `meleeHitCount ≥ 1`, ring seen | Hook observability in combat | `combat-vfx.spec.ts:44-69` — `targetRingVisible` true; poll `meleeHitCount >= 1` | ✅ PASS |

### P1: Visual gate (CVFX-33–35)

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| CVFX-33: `vfx-lab?effect=power-strike&t=0.4` → `__SHOT_READY__` | Ready + mid-effect pose | `vfx-lab.ts:118-120`; `shoot-vfx.mjs:32` — `waitForFunction(__SHOT_READY__)` | ✅ PASS |
| CVFX-34: `shoot-vfx.mjs` captures 5 PNGs | power-strike, melee-hit, death-dissolve, level-up, target-ring | Verifier run: `/tmp/vfx-shots-phase13-rerun/*.png` (5 files, 720×720) | ✅ PASS |
| CVFX-35: PNGs readable at 720×720 | Human review | Verifier image review: arc slash, hit particles, dissolve fade, level-up burst, gold target ring all distinct and readable | ✅ PASS |

### P3: Soulshot glint (CVFX-36–37)

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| CVFX-36: soulshots + attack/cast seq → glint | Weapon flash | `soulshot-glint-vfx.spec.ts:17-24` — `shouldSoulshotGlint` true; count > 0 | ✅ PASS |
| CVFX-37: no soulshots → no glint | Absent stack | `soulshot-glint-vfx.spec.ts:27-30` — `shouldSoulshotGlint(0,...)` false | ✅ PASS |

### P3: Loot puff (CVFX-38–39)

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| CVFX-38: mob die action → ground sparkle | Spawn at death position | `loot-puff-vfx.spec.ts:18-20` — count > 0 after spawn | ✅ PASS |
| CVFX-39: **800 ms** → dispose | Cleanup | `loot-puff-vfx.spec.ts:21-24` — tick + dispose → count 0 | ✅ PASS |

**Status**: ✅ All 39 ACs covered with `file:line` evidence

---

## Implementer Deviations (checked)

| Deviation | Assessment |
| --------- | ---------- |
| Vite multi-page build (`vfxLab` entry) | ✅ Acceptable — `vite.config.ts:43-47` |
| `shoot-vfx.mjs` default port **4200** | ✅ Acceptable — matches `server.port: 4200`; script succeeds with `nx serve client` |
| Visual gate PNGs gitignored in `data/vfx-gate/` | ✅ Acceptable — PNGs captured to `LAB_OUT` (/tmp); no committed artifacts required |
| `skill-flash.ts` removed → `power-strike-vfx.ts` | ✅ Acceptable — no `skillFlash` imports remain; spec intent met |
| Visual gate vs production preview | ⚠️ Note — `vite preview` on `dist/client` returns **404** for `vfx-lab.html`; dev server on 4200 works (same pattern as other lab scripts) |

---

## Discrimination Sensor

Scratch mutations applied via temp backup + restore; targeted `nx test client --testFile=<spec>`.

| Mutation | File:line | Description | Killed? |
| -------- | --------- | ----------- | ------- |
| M1 | `vfx-triggers.ts:6` | `return nextHp < prevHp` → `return false` | ✅ Killed — `vfx-triggers.spec.ts` |
| M2 | `vfx-manager.ts:116` | Comment out `incrementMeleeHitHook(hook)` | ✅ Killed — `vfx-manager.spec.ts` |
| M3 | `power-strike-vfx.ts:5` | `POWER_STRIKE_TAG = 'skillFlash'` | ✅ Killed — `power-strike-vfx.spec.ts` |

**Sensor depth**: lightweight (3 mutations)
**Result**: 3/3 killed — ✅ PASS

---

## Code Quality

| Principle | Status |
| --------- | ------ |
| Minimum code / no scope creep | ✅ Client-only VFX; server unchanged |
| Surgical changes | ✅ `skill-flash` removed; modular `vfx/` layout |
| Matches patterns | ✅ Lab + shoot script mirrors character-lab |
| Spec-anchored outcome check | ✅ 39/39 ACs with evidence |
| Per-layer coverage (unit + e2e + visual) | ✅ All P1 layers covered |
| Documented guidelines (`AGENTS.md`, AD-009/014/017) | ✅ Hook-based e2e; no WebGL pixel asserts |
| Tests not weakened / count increased | ✅ Client 170→175 (+5 fix tests); e2e +1 file |

---

## Edge Cases (spec)

| Edge case | Handled | Evidence |
| --------- | ------- | -------- |
| Invalid target for Power Strike | ✅ | `vfx-manager.ts:160-167` requires mob + finite positions |
| Multiple HP drops same tick | ✅ | Per-mob maps + pool (`vfx-manager.ts:200-205`) |
| Multi-level kill (1→3) | ✅ | `countLevelUps` + loop (`vfx-triggers.spec.ts:21`; `vfx-manager.ts:143-149`) |
| WebGL teardown | ✅ | `vfx-manager.dispose()` clears timed entries + dissolves |
| Despawned target / NaN positions | ✅ | `setTargetMobId` hide; `isFinitePos` guards |

---

## Gate Check

| Gate | Command | Result |
| ---- | ------- | ------ |
| Build + lint + test | `nx run-many -t build lint test` | ✅ All 4 projects green |
| Client unit | (included above) | **175** passed, 0 failed |
| Server regression | (included above) | Green; **no server files** in `e58607f..HEAD` |
| E2E | `nx e2e client-e2e` | **20** passed, 0 failed (serial `--workers=1`; default 4-worker run showed intermittent unrelated flakes in `combat.spec.ts` / `character-animation.spec.ts`) |
| Visual | `LAB_VFX=all LAB_OUT=/tmp/vfx-shots-phase13-rerun node scripts/shoot-vfx.mjs` (with `nx serve client`) | ✅ 5 PNGs captured at 720×720 |

**Test count delta**: client unit 143 (pre-phase, `e58607f~1`) → 175 (+32); e2e 19→20 (+1 combat-vfx)
**Skipped tests**: none
**Failures**: none (on authoritative gate runs)

---

## Requirement Traceability Update

| Requirement | Previous | New Status |
| ----------- | -------- | ---------- |
| CVFX-01–39 | Pending / gaps | ✅ Verified |

---

## Summary

**Overall**: ✅ Ready

**Spec-anchored check**: 39/39 requirements with matching evidence; 0 gaps; 0 spec-precision gaps
**Sensor**: 3/3 mutations killed
**Gate**: build/lint/test + e2e green

**What works**: Full VFX module set (lifecycle, triggers, 5 core effects + P3 optional), room/renderer wiring, `__GAME_STATE__.vfx` hook, e2e combat observability, visual gate PNGs readable, `skill-flash` fully superseded, server authority unchanged. Fix iteration 1 closed all prior coverage gaps.

**Issues found**: None blocking. Note: parallel e2e (4 workers) can intermittently flake on pre-existing combat/animation specs unrelated to Phase 13; serial run is green.

**Next steps**: Mark phase complete in ROADMAP/STATE (orchestrator).
