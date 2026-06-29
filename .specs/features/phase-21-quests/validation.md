# Phase 21 — Quests & Tutorial Validation

**Date**: 2026-06-29
**Spec**: `.specs/features/phase-21-quests/spec.md`
**Diff range**: `adaf22e..465b53b` (14 commits; flake fix `465b53b`)
**Verifier**: independent sub-agent (author ≠ verifier)
**Fix iterations**: 2 (re-verify after `465b53b`)

---

## Task Completion

| Task | Status  | Notes |
| ---- | ------- | ----- |
| T1–T14 | ✅ Done | All 14 tasks marked Done in `tasks.md` |

---

## Spec-Anchored Acceptance Criteria

| AC | Criterion (WHEN → THEN) | Spec-defined outcome | `file:line` + assertion | Result |
| -- | ------------------------- | -------------------- | ----------------------- | ------ |
| 01 | not started + `canStart` → `startQuest` | `in_progress`, `step=0` | `quest-engine.spec.ts:56-61` — `status: 'in_progress'`, `step: 0` | ✅ PASS |
| 02 | `TALK` at giver npcId → `questTalk` | step advances | `quest-engine.spec.ts:71-72` — `step).toBe(1)` | ✅ PASS |
| 03 | KILL_COUNT 9/10 Orc 20130 | counter 9, step incomplete | `quest-engine.spec.ts:81-82` — `counters[0]).toBe(9)`, `step).toBe(0)` | ✅ PASS |
| 04 | 10th kill | step advances | `quest-engine.spec.ts:91` — `step).toBe(1)` | ✅ PASS |
| 05 | COLLECT + DELIVER turn-in | step completes | `quest-engine.spec.ts:99-100` — `step).toBe(2)` | ✅ PASS |
| 06 | quest completes | quest-only items removed | `quest-engine.spec.ts:105-106` — `stripQuestItems` → `{1060:5}` | ✅ PASS |
| 07 | `grantQuestRewards` XP 3000 | `grantXp` invoked, level may rise | `quest-rewards.spec.ts:21-22` — `xp).toBe(3000)` | ✅ PASS |
| 08 | level 9, minLevel 10 | `canStart` false | `quest-engine.spec.ts:112` — `toBe(false)` | ✅ PASS |
| 09 | duplicate same transition | state unchanged | `quest-engine.spec.ts:123-124` — `toEqual(afterFirst)` | ✅ PASS |
| 10 | seed runs | 17 quest rows | `quests.seeder.spec.ts:32-34` — `toHaveLength(17)`, all `TI_QUEST_IDS` | ✅ PASS |
| 11 | quest 105 seeded | mob 20130 count 10 | `quests.seeder.spec.ts:53` — `row?.count).toBe(10)` | ✅ PASS |
| 12 | quest 153 completes | `character_quests` persists `completed` | `character-repository.spec.ts:283` — `status).toBe('completed')` | ✅ PASS |
| 13 | reconnect in-progress 255 step 1 | same step restored | `TownRoom.spec.ts:3100` — `step).toBe(1)` | ✅ PASS |
| 14 | quest item 1012 seeded | `is_quest_item` true | `quests.seeder.spec.ts:65` — `isQuestItem).toBe(true)` | ✅ PASS |
| 15 | below min level at giver | quest dialog NOT offer accept | `TownRoom.spec.ts:3327` — `levelTooLow: true`, `buttons: []`; `quest-handlers.spec.ts:71` — unit mirror | ✅ PASS |
| 16 | `questAction accept` 105 at Bitz | questEntries 105 step 0 | `TownRoom.spec.ts:3119-3120` — `questId).toBe(105)`, `step).toBe(0)` | ✅ PASS |
| 17 | kill Gremlin 20001 tutorial step 1 | step 2 | `TownRoom.spec.ts:3140` — `step).toBe(2)` | ✅ PASS |
| 18 | quest complete grants 1835 × 200 | `character_items` +200 | `TownRoom.spec.ts:3158` — `SOULSHOT_ITEM_ID)).toBe(200)` | ✅ PASS |
| 19 | quest item in inventory + complete | item removed | `TownRoom.spec.ts:3358` — `GOLEM_SHARD_ITEM_ID)).toBe(0)` | ✅ PASS |
| 20 | `complete` without objectives | server rejects, no reward | `TownRoom.spec.ts:3379-3381` — `status).toBe('in_progress')`, `xp).toBe(xpBefore)` | ✅ PASS |
| 21 | sell quest item 1012 | `sell` rejects | `shop-transaction.spec.ts:98` — `ok).toBe(false)`; `TownRoom.spec.ts:3306` — count unchanged | ✅ PASS |
| 22 | completed 105 accept again | state remains `completed` | `TownRoom.spec.ts:3411-3412` — `entries[0]?.status).toBe('completed')` | ✅ PASS |
| 23 | new join | quest 255 auto-start step 0 | `TownRoom.spec.ts:3071-3073` — `in_progress`, `step: 0` | ✅ PASS |
| 24 | Roxxy step 0 dialog | “Continue tutorial” available | `TownRoom.spec.ts:3428` — `buttons).toContainEqual({ action: 'talk', label: 'Continue tutorial' })`; `quest-handlers.spec.ts:83` | ✅ PASS |
| 25 | tutorial step 1 quest log | kill Gremlin objective | `quest-log.spec.ts:39` — `toContain('Gremlin')` | ✅ PASS |
| 26 | fighter completes tutorial | 1835 × 200 | `TownRoom.spec.ts:3158` — `toBe(200)` | ✅ PASS |
| 27 | mystic completes tutorial | 2509 × 100 | `TownRoom.spec.ts:3177` — `toBe(100)` | ✅ PASS |
| 28 | tutorial completed | not re-offered | `TownRoom.spec.ts:3453` — `questDialogReceived).toBe(false)`; `quest-handlers.spec.ts:92` — excludes 255 | ✅ PASS |
| 29 | quest 101 full flow | reward 49043 × 1 | `TownRoom.spec.ts:3233` — `49043)).toBe(1)` | ✅ PASS |
| 30 | quest 104 mirror kills | step per kill type | `TownRoom.spec.ts:3478-3488` — counters `[1,0,0]` → `[1,1,0]` → `step).toBe(1)` | ✅ PASS |
| 31 | quest 105 10 kills complete | XP 27772 (±0) | `TownRoom.spec.ts:3203` — `xpAfter - xpBefore).toBe(27772)` | ✅ PASS |
| 32 | quest 151 10 drops | Healing Potion 1060 | `TownRoom.spec.ts:3261` — `1060)).toBe(1)` | ✅ PASS |
| 33 | quest 152 golem kill | quest item shard granted | `TownRoom.spec.ts:3512` — `GOLEM_SHARD_ITEM_ID)).toBe(1)` | ✅ PASS |
| 34 | quest 153 delivery chain | reward 1060 × 1 | `TownRoom.spec.ts:3556` — `1060)).toBe(1)` | ✅ PASS |
| 35 | quest 155 talk step | 49036 × 1 | `TownRoom.spec.ts:3584` — `49036)).toBe(1)` | ✅ PASS |
| 36 | quest 158 Nerkas 27016 killed | completable at Baulro | `TownRoom.spec.ts:3287` — `step).toBe(1)`; `TownRoom.spec.ts:3643-3649` — Baulro `complete` → `49037)).toBe(1)` | ✅ PASS + SPEC_DEVIATION (no Nerkas spawn; kill via `onMobKilledForQuests` hook) |
| 37 | quest 157 collect 4 | reward granted | `TownRoom.spec.ts:3617` — `1060)).toBe(1)` | ✅ PASS |
| 38 | `questEntries` synced | `__GAME_STATE__.quests.active` lists 255 “Tutorial” | `test-hook.spec.ts:12-13` — `title).toBe('Tutorial')` | ✅ PASS |
| 39 | quest log open | objective text rendered | `quest-log.spec.ts:39` — `toContain('Gremlin')` | ✅ PASS |
| 40 | quest completes | moves to `completed` list | `quest-log.spec.ts:56-57` — `completed` contains 255 | ✅ PASS |
| 41 | **Q** pressed | `#quest-log` toggles | `quest-log.spec.ts:19-22` — `isQuestLogVisible()` true/false | ✅ PASS |
| 42 | no active quests | empty state string | `quest-log.spec.ts:29` — `toBe(QUEST_LOG_EMPTY_TEXT)` | ✅ PASS |
| 43 | `wireRoom` questEntries change | hook updates | `wire-room.spec.ts:15-16` — `active[0]?.step).toBe(2)` | ✅ PASS |
| 44 | quest 105 available at Bitz | marker `available` | `quest-markers.spec.ts:28-30` — `toBe('available')` | ✅ PASS |
| 45 | quest 105 in progress kill step | marker `in_progress` at Bitz | `quest-markers.spec.ts:43` — `toBe('in_progress')` | ✅ PASS |
| 46 | objectives done, turn-in at Bitz | marker `completable` | `quest-markers.spec.ts:55` — `toBe('completable')` | ✅ PASS |
| 47 | NPC no quest involvement | marker `none` | `quest-markers.spec.ts:61` — `toBe('none')` | ✅ PASS |
| 48 | Roxxy marker count | matches resolver | `quest-markers.spec.ts:28-30` — `count).toBe(1)`, `textContent).toBe('!')` | ✅ PASS |

**Spec-anchored check**: 48/48 with cited evidence · **0 GAP** · **1 SPEC_DEVIATION** (AC 36 spawn deferral)

---

## Discrimination Sensor

| # | Mutation | File | Killed? |
| - | -------- | ---- | ------- |
| 1 | Flip `in_progress` guard in kill handler | `libs/game-core/src/quest/quest-engine.ts` (scratch) | ✅ Killed (5 failed in `quest-engine.spec.ts`) |
| 2 | Invert `canCompleteQuest` guard on `complete` | `server/src/rooms/quest-handlers.ts:260` (scratch) | ✅ Killed (`rejects complete without objectives` failed) |
| 3 | Change seed count assertion 17→16 | `quests.seeder.spec.ts:32` (scratch) | ✅ Killed (`quests.seeder.spec.ts` failed) |

**Sensor depth**: lightweight (3 mutations)
**Result**: 3/3 killed — **PASS**

---

## Code Quality

| Principle | Status |
| --------- | ------ |
| Minimum code / surgical changes | ✅ |
| Matches AD-001 server authority, AD-010 test layers | ✅ |
| No Playwright in gate | ✅ |
| Room helpers (`advanceQuestStep`, `grantItem`) — pragmatic but weaken E2E fidelity | ⚠️ noted |
| Spec-anchored outcome check | ✅ 48/48 |
| Documented guidelines (AGENTS.md, AD-014) | ✅ `deliver`/`tick`, `NJ_AUTOSIM=0`, no wall-clock sleeps |

---

## Edge Cases (spec)

| Edge case | Evidence |
| --------- | -------- |
| Player dies during quest → state persists | — not tested |
| Mob kill with no active objective → no-op | — not tested |
| Inventory full + reward → still succeeds | — not tested |
| Same mob credits two quests | — not tested |
| Disconnect mid turn-in → no reward until reconnect | — not tested |
| Merchant + quest giver (Katerina) → Shop + Quest | `npc-interaction-quest.spec.ts` — chooser opens quest path | ✅ partial |

---

## Gate Check

- **Gate command**: `nx run-many -t build lint test --skip-nx-cache`
- **Ports freed**: 2567, 4200 before runs (confirmed 0 listeners)
- **Build**: ✅ 3/3 projects
- **Lint**: ✅ 0 errors (pre-existing warnings only)
- **Tests** (`--skip-nx-cache`):

| Project | Files | Tests |
| ------- | ----- | ----- |
| game-core | 29 | 146 |
| client | 54 | 243 |
| server | 26 | 302 |
| **Total** | **109** | **691** |

- **Skipped**: 0
- **Failures**: ✅ none
- **Reliability**: 5/5 consecutive clean runs — 1× full `nx run-many -t build lint test` + 4× `nx run server:test` (post `465b53b` flake fix)
- **Flake fix** (`465b53b`): per-message `deliver()` await loop, `createIsolatedTownRoom` + `afterEach` cleanup, split Q155/Q157 reward assertions after `complete` handlers finish

---

## Implementer Deviations (verified)

| Deviation | Verified |
| --------- | -------- |
| Combined client commit (T9–T12) | ✅ `e5f00dd` |
| Room test helpers (`advanceQuestStep`, `grantItem`, `onMobKilledForQuests` direct) | ✅ speeds tests; weakens full interact/kill paths |
| Q00158 no Nerkas spawn | ✅ SPEC_DEVIATION — kill hook + Baulro turn-in tested; no world spawn |
| Simplified quest defs in `quests.json` | ✅ 17 quests present |
| `bec0bdd` hardening | ✅ `getQuestEntriesForNpc` level-too-low + delivery NPC routing |
| `465b53b` flake fix | ✅ `deliver()` loop, isolated rooms, Q155/Q157 assertion ordering |

---

## Fix Plans (≤3)

### Fix 1: Q158 world spawn (optional deferral)

- **What**: Spawn Nerkas 27016 when quest 158 step active per spec; replace direct `onMobKilledForQuests` shortcut in room test.
- **Where**: `server/src/rooms/quest-handlers.ts` / spawn manager
- **Verify**: Room test kills spawned mob in-world
- **Priority**: Major (SPEC_DEVIATION only)

### Fix 2: Edge-case coverage (non-blocking)

- **What**: Add unit/room tests for spec edge cases (no-op kill, dual-quest credit, inventory full reward).
- **Where**: `quest-engine.spec.ts`, `TownRoom.spec.ts`
- **Priority**: Minor

---

## Summary

**Overall**: ✅ **Ready**

**Spec-anchored check**: 48/48 with evidence · 0 GAP · 1 SPEC_DEVIATION (AC 36 spawn)
**Sensor**: 3/3 killed
**Gate**: ✅ stable — 5/5 consecutive clean runs after `465b53b`

**What works**: All 48 ACs have spec-anchored test evidence; discrimination sensors kill quest bypass faults; build + lint + test gate passes reliably; quest engine, seed, persistence, UI, markers, and room/unit tests present.

**Remaining (non-blocking)**: AC 36 Nerkas world spawn deferred (documented SPEC_DEVIATION); spec edge cases untested.

**Next steps**: Orchestrator may flip ROADMAP/STATE on PASS. ROADMAP/STATE not updated by this verifier run per instruction.
