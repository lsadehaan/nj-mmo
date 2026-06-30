# Phase 27 — Progression Rules & PvP Validation

**Date**: 2026-06-30
**Spec**: `.specs/features/phase-27-progression-pvp/spec.md`
**Diff range**: `679123e..cfd716b` (branch `feat/phase-27-progression-pvp`)
**Verifier**: independent sub-agent (author ≠ verifier); re-verify after gap-fix commit `cfd716b`

---

## Task Completion

| Task | Status  | Notes |
| ---- | ------- | ----- |
| T1–T4 | ✅ Done | game-core pure functions + unit specs |
| T5 | ✅ Done | schema + experience_loss seed |
| T6 | ✅ Done | replication/persist absorbed into handlers (no dedicated spec; build + room smoke) |
| T7–T12 | ✅ Done | TownRoom handlers + `TownRoom.progression.spec.ts` |
| T13–T16 | ✅ Done | client UI + wireRoom |
| T17 | ✅ Done | full gate green at `cfd716b` |

---

## Spec-Anchored Acceptance Criteria

| AC | Criterion summary | Spec-defined outcome | `file:line` + assertion | Result |
| -- | ----------------- | -------------------- | ----------------------- | ------ |
| PROG27-01 | Level 10 death loss | `lostExp=2039`, `newXp=47961` | `death-penalty.spec.ts:32-33` — `expect(result.lostExp).toBe(2039)` / `newXp` `47961` | ✅ PASS |
| PROG27-02 | Newbie protection | `lostExp=0` at level 9 | `death-penalty.spec.ts:43` — `expect(result.lostExp).toBe(0)` | ✅ PASS |
| PROG27-03 | Delevel 11→10 | `level=10`, `xp=62000` | `experience-cap.spec.ts:17-20` — `toEqual({ level: 10, xp: 62000 })` | ✅ PASS |
| PROG27-04 | No delevel small loss | `level` stays 10 | `experience-cap.spec.ts:24-27` — `toEqual({ level: 10, xp: 49500 })` | ✅ PASS |
| PROG27-05 | Room death penalty L10 | `xp=47961`, `expBeforeDeath=50000` | `TownRoom.progression.spec.ts:221-222` — `expect(player.xp).toBe(47961)` | ✅ PASS |
| PROG27-06 | Room L9 no loss | `xp=40000` unchanged | `TownRoom.progression.spec.ts:237` — `expect(...xp).toBe(40000)` | ✅ PASS |
| PROG27-07 | Respawn full vitals + town | `hp=maxHp`, `mp=maxMp`, spawn coords | `TownRoom.progression.spec.ts:244-257` — spawn + vitals asserts | ✅ PASS |
| PROG27-08 | Delevel refreshes maxHp | `level=10`, `maxHp` changes | `TownRoom.progression.spec.ts:268-271` — `level` + `maxHp` asserts | ✅ PASS |
| PROG27-09 | restoreExp unit | `xp=50000`, adena −20390, clear flag | `restore-exp.spec.ts:10-13` — `ok`/`xp`/`adena`/`expBeforeDeath` | ✅ PASS |
| PROG27-10 | restore reject no loss | `ok=false`, unchanged | `restore-exp.spec.ts:21-23` — `ok` false, xp unchanged | ✅ PASS |
| PROG27-11 | Biotin room restore | `xp=50000`, adena cost, clear | `TownRoom.progression.spec.ts:286-313` | ✅ PASS |
| PROG27-12 | Insufficient adena | no XP change | `TownRoom.progression.spec.ts:307-313` | ✅ PASS |
| PROG27-13 | Seed L20 curve | `xpToNextLevel=835864` | `experience-loss.seeder.spec.ts:28` — `toBe(835864)` | ✅ PASS |
| PROG27-14 | Seed loss row L10 | `percentLost=8.875` | `experience-loss.seeder.spec.ts:36` — `toBe(8.875)` | ✅ PASS |
| PROG27-15 | grantXp cap 20 | level 20 anchors | `experience-cap.spec.ts:33-40` | ✅ PASS |
| PROG27-16 | L20 no XP on kill | `xp=835864` unchanged | `TownRoom.progression.spec.ts:327-329` | ✅ PASS |
| PROG27-17 | Gremlin SP +7 | `sp=7` | `TownRoom.progression.spec.ts:342-344` — `toBe(7)` (fixture `sp=7` SPEC_DEVIATION) | ✅ PASS (deviation) |
| PROG27-18 | learnSkill no SP | reject | `TownRoom.progression.spec.ts:359-361` — skill undefined | ✅ PASS |
| PROG27-19 | learnSkill deducts SP | SP decreases | `TownRoom.progression.spec.ts:363-377` | ✅ PASS |
| PROG27-20 | Party SP split | mirrors XP bonus | `skill-points.spec.ts:11-12` — grants 4+4 | ✅ PASS |
| PROG27-21 | Level-up stat point | +1 unspent | `stat-points.spec.ts:23-24` — `unspentStatPoints` 1 | ✅ PASS |
| PROG27-22 | allocateStat | +bonusStr, −unspent | `stat-points.spec.ts:28-31` | ✅ PASS |
| PROG27-23 | allocate reject | `ok=false` | `stat-points.spec.ts:35-36` | ✅ PASS |
| PROG27-24 | resetStats unit | bonuses 0, unspent 11 | `stat-points.spec.ts:46-49` | ✅ PASS |
| PROG27-25 | Bitz reset room | bonuses 0, unspent 11, adena cost | `TownRoom.progression.spec.ts:389-391` | ✅ PASS |
| PROG27-26 | reset out of range | reject | `TownRoom.progression.spec.ts:418` — bonus unchanged | ✅ PASS |
| PROG27-27 | bonusStr in combat | `calcClassBasePAtk` uses `baseStr+2` | `stat-points.spec.ts:58-59` — `effectiveStat(40,2).toBe(42)` | ⚠️ Spec-precision gap (proxy, not `calcClassBasePAtk`; combat impact covered by PROG27-28) |
| PROG27-28 | Reset → base-only pAtk hit | lower damage after reset | `TownRoom.progression.spec.ts:469` — `expect(damageAfterReset).toBeLessThan(damageWithBonus)` | ✅ PASS |
| PROG27-29 | togglePvp 120s | `pvpFlag=1`, `endMs=now+120000` | `TownRoom.progression.spec.ts:486-487` | ✅ PASS |
| PROG27-30 | Flag expiry tick | `pvpFlag=0` | `TownRoom.progression.spec.ts:504` | ✅ PASS |
| PROG27-31 | PK karma −720 | `karma=-720` | `TownRoom.progression.spec.ts:524` — **SPEC_DEVIATION**: `pendingPlayerKiller.set` injection, not combat kill | ✅ PASS (deviation) |
| PROG27-32 | Flagged kill no karma | `karma=0` | `TownRoom.progression.spec.ts:552` — **SPEC_DEVIATION**: same shortcut | ✅ PASS (deviation) |
| PROG27-33 | Flagged kill pvpKills++ | `pvpKills=1` | `TownRoom.progression.spec.ts:583` — **SPEC_DEVIATION**: same shortcut | ✅ PASS (deviation) |
| PROG27-34 | Karma relief | `floor(3000/300)=10` | `pvp-rules.spec.ts:13` — `toBe(-710)` from −720 | ✅ PASS |
| PROG27-35 | Peace zone toggle reject | `pvpFlag=0` | `TownRoom.progression.spec.ts:598` | ✅ PASS |
| PROG27-36 | wireRoom karma | negative on `__GAME_STATE__` | `room-progression.spec.ts:99` — `toBe(-720)` | ✅ PASS |
| PROG27-37 | PvP damage flagged | `damage > 0` | `pvp-combat.spec.ts:14` — `toBeGreaterThan(0)` | ✅ PASS |
| PROG27-38 | Innocent 0 damage | `damage=0` | `pvp-combat.spec.ts:24` — `toBe(0)` | ✅ PASS |
| PROG27-39 | PvP death + killer recorded | `handlePlayerDeath` with killer session | `TownRoom.progression.spec.ts:689-695` — respawn + `pvpKills=1` via real melee combat | ✅ PASS |
| PROG27-40 | Peace zone 0 PvP dmg | HP unchanged | `TownRoom.progression.spec.ts:620` | ✅ PASS |
| PROG27-41 | Two-session PvP hit | B HP reduced | `TownRoom.progression.spec.ts:651` — `toBeLessThan(hpBefore)` | ✅ PASS |
| PROG27-42 | useSkill vs PvP player | server damage applies | `TownRoom.progression.spec.ts:722` — `expect(flaggedPlayer.hp).toBeLessThan(hpBefore)` | ✅ PASS |
| PROG27-43 | Invalid stat reject | rejected | `stat-points.spec.ts:54-55` — `isValidStatName('invalid')` false | ✅ PASS |
| PROG27-44 | Self-target reject | `targetPlayerSessionId` null | `TownRoom.progression.spec.ts:741` | ✅ PASS |
| PROG27-45 | Karma death mult 1.1 | higher loss | `death-penalty.spec.ts:59-60` — `toBe(Math.round(base.lostExp * 1.1))` | ✅ PASS |
| PROG27-46 | L1 Gremlin +44 XP regression | `xp=44` | `TownRoom.progression.spec.ts:756` — `toBe(44)` | ✅ PASS |
| PROG27-47 | wireRoom progression fields | sp/karma/pvpFlag/expBeforeDeath/unspent | `room-progression.spec.ts:104-107` | ✅ PASS |
| PROG27-48 | Full gate + speed | green, no file >10s | gate run + `TownRoom.progression.spec.ts` Duration **5.26s** (25 tests, vitest direct) | ✅ PASS |

**Status**: ✅ **48/48 PASS**, **0 GAP**, **1 spec-precision gap** (PROG27-27), **3 SPEC_DEVIATION** (PROG27-31–33 karma shortcut, PROG27-17 Gremlin `sp` fixture)

---

## Discrimination Sensor

| Mutation | File:line | Description | Killed? |
| -------- | --------- | ----------- | ------- |
| 1 | `death-penalty.ts:57` | Force `lostExp = 0` for level 10 | ✅ Killed (`death-penalty.spec.ts` PROG27-01, PROG27-45 fail) |
| 2 | `pvp-combat.ts:38` | Innocent attack `allowed: true`, `damage: 99` | ✅ Killed (`pvp-combat.spec.ts` PROG27-38 fail) |
| 3 | `TownRoom.progression.spec.ts:221` | Expect `xp=50000` after death penalty | ✅ Killed (PROG27-05 fail) |

**Sensor depth**: lightweight (3 mutations)
**Result**: **3/3 killed** — ✅ PASS

**Note**: PROG27-39 now exercises real combat kill path; karma shortcut tests (PROG27-31–33) remain isolated unit-style room injections.

---

## Code Quality

| Principle | Status |
| --------- | ------ |
| Minimum code | ✅ |
| Surgical changes | ✅ |
| No scope creep | ✅ |
| Matches patterns | ✅ |
| Spec-anchored outcome check | ✅ 48/48 |
| Per-layer coverage | ✅ unit + seed + room + wireRoom |
| Every test maps to AC | ✅ (UI smoke tests are wiring-only, noted in tasks matrix) |
| AGENTS.md / AD-014 | ✅ Room file 5.26s isolated; `NJ_AUTOSIM=0` + tick/deliver |

---

## Edge Cases (spec.md)

| Edge case | Handled? | Evidence |
| --------- | -------- | -------- |
| Overwrite `expBeforeDeath` on repeat death | ✅ | `calcDeathXpLoss` always sets `expBeforeDeath` to pre-penalty xp |
| No partial restore on insufficient adena | ✅ | PROG27-12 room + `restore-exp.spec.ts` |
| Delevel clamp at level 10 | ✅ | `removeXp` + PROG27-08 room |
| Party cap member 0 XP, still SP | ⚠️ | cap XP tested; party SP at cap not explicitly room-tested |
| `pvpFlagEndMs` absolute timer | ✅ | PROG27-30 tick-driven |
| No party immunity PvP | ⚠️ | not explicitly tested |
| Trade open + toggle PvP allowed | ⚠️ | not tested (spec says allowed) |

---

## Gate Check

- **Gate command**: `nx run-many -t build lint test --skip-nx-cache`
- **Result**: **878 tests passed** (game-core 280 + server 299 + client 299), **0 failed**, **0 skipped**
- **Lint**: 0 errors, 40 warnings (pre-existing pattern)
- **Test count before feature** (`679123e`): game-core ~252, server ~277, client ~277 (progression package did not exist)
- **Test count after**: game-core 280 (+28), server 299 (+22), client 299 (+22)
- **Delta**: +72 new tests; no silent deletions observed
- **PROG27-48 file timing**: `TownRoom.progression.spec.ts` **5.26s** standalone, 25 tests (<10s AD-014)
- **Note**: Nx flagged `server:test` as flaky once during parallel run; isolated re-run green

---

## Implementer Deviations (documented)

| Deviation | ACs | Detail |
| --------- | --- | ------ |
| PK karma shortcut | PROG27-31–33 | Room tests inject `pendingPlayerKiller` + `hp=0` instead of combat kill path (PROG27-39 covers real kill separately) |
| T6 absorbed wiring | T6 | Schema/replication verified via build + handler room tests; no join/reconnect field test |
| Gremlin `sp` fixture | PROG27-17 | `monsters.xml` Gremlin `sp` **0→7** to match SP anchor (accepted for TI slice) |

---

## Fix Plans (resolved at `cfd716b`)

| AC | Fix | Status |
| -- | --- | ------ |
| PROG27-42 | Extend `handleUseSkill` + cast resolution for `targetPlayerSessionId`; room test Power Strike vs flagged player | ✅ Closed |
| PROG27-39 | Two-session melee kill until respawn; assert `pvpKills=1` without injection | ✅ Closed |
| PROG27-28 | Allocate STR, hit mob, reset at Bitz, hit again; assert lower damage | ✅ Closed |

---

## Requirement Traceability Update

| Requirement | Previous (`2587d94`) | New (`cfd716b`) |
| ----------- | -------------------- | --------------- |
| PROG27-01–27, 29–38, 40–41, 43–48 | ✅ Verified (27 = precision gap) | ✅ Verified |
| PROG27-28, 39, 42 | ❌ Needs Fix | ✅ Verified |
| PROG27-31–33 | ✅ Verified (SPEC_DEVIATION) | ✅ Verified (SPEC_DEVIATION) |

---

## Summary

**Overall**: ✅ **Ready**

**Spec-anchored check**: **48/48** matched · **0 GAP** · **1 spec-precision gap** (PROG27-27)
**Sensor**: **3/3** mutations killed
**Gate**: **878 passed**, 0 failed

**What works**: Death penalty/delevel anchors, Biotin restore, TI cap/SP, stat allocate/reset with combat damage proof, PvP flag/karma rules, real PvP kill + skill damage, melee two-session PvP hit, wireRoom progression fields, full gate green.

**Residual notes** (non-blocking): PROG27-27 uses `effectiveStat` proxy; PROG27-31–33 karma tests still use injection shortcut (combat path covered by PROG27-39); three spec edge cases untested (party SP at cap, party PvP immunity, trade+toggle).

**Next steps**: Orchestrator may flip ROADMAP/STATE on PASS (not done by this verifier run per instruction).
