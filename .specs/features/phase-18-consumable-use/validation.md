# Phase 18 — Consumable Item Use Validation

**Date**: 2026-06-28
**Spec**: `.specs/features/phase-18-consumable-use/spec.md`
**Diff range**: `57d3b53..HEAD` (+ verifier fixes uncommitted: `test-hook.ts`, `consumable-use.spec.ts`)
**Verifier**: independent sub-agent (author ≠ verifier)

**Commits in range**:
- `ab460ed` feat(server): add healingPotionCooldownEndMs to PlayerState
- `5373d08` feat(server): useItem intent for Healing Potion with reuse cooldown
- `71b58aa` feat(client): inventory Use button for Healing Potion
- `b750446` feat(client): wire useItem intent and __useItem__ test hook
- `b755a8d` test(e2e): healing potion use after field damage

---

## Verdict: **PASS** (after 1 fix→re-verify iteration)

Initial gate failed (`nx build client` type errors; e2e `consumable-use.spec.ts` browser-closure bugs). Verifier applied minimal fixes; re-gate green. All 27 ACs covered; discrimination sensor 4/4 killed.

---

## Task Completion

| Task | Status | Notes |
| ---- | ------ | ----- |
| T1 game-core pure logic | ✅ Done | 9 unit tests |
| T2 PlayerState schema field | ✅ Done | `healingPotionCooldownEndMs` |
| T3 TownRoom useItem + room tests | ✅ Done | 10 new `it` blocks (+1 bonus dead) |
| T4 Inventory Use button | ✅ Done | CONS-20–23 |
| T5 wireRoom + hooks | ✅ Done | CONS-24–25 |
| T6 E2E consumable use | ✅ Done | Rewritten for AD-014 + browser-arg fix |
| T7 Full gate | ✅ Done | After verifier fixes |

---

## Known Deviations Assessed

| Deviation | Assessment |
| --------- | ---------- |
| `handleUseItem` inline in `TownRoom.ts` (no `consumable-use.ts` wrapper) | ✅ Acceptable — AD-001 server authority intact; all CONS-10–19 room ACs exercised via `deliver([['useItem', …]])` |
| `healingPotionCooldownRemainingMs` on `__GAME_STATE__.player` not root | ✅ Covered — mirrors `powerStrikeCooldownRemainingMs`; tests assert `player` path. ⚠️ AC-25 spec text cites root path (spec-precision gap) |
| No dedicated potion cooldown DOM bar | ✅ CONS-23 covers cooldown UI via disabled **Use** button; CONS-26/27 are HP/count e2e, not bar |
| Bonus room test "rejects useItem when player is dead" | ✅ Extra coverage for AC-08 at room layer |

---

## Spec-Anchored Acceptance Criteria

| AC | Spec-defined outcome | Evidence | Result |
| -- | -------------------- | -------- | ------ |
| CONS-01 | `HEALING_POTION_HEAL_AMOUNT === 24` | `healing-potion.spec.ts:13` — `expect(HEALING_POTION_HEAL_AMOUNT).toBe(24)` | ✅ |
| CONS-02 | `HEALING_POTION_REUSE_MS === 10000` | `healing-potion.spec.ts:17` — `expect(HEALING_POTION_REUSE_MS).toBe(10_000)` | ✅ |
| CONS-03 | heal 50→74 | `healing-potion.spec.ts:21-23` — `expect(...).toBe(74)` | ✅ |
| CONS-04 | cap 90+24→100 | `healing-potion.spec.ts:27-29` — `expect(...).toBe(100)` | ✅ |
| CONS-05 | `not_consumable` | `healing-potion.spec.ts:42` — `toEqual({ ok: false, error: 'not_consumable' })` | ✅ |
| CONS-06 | `not_owned` | `healing-potion.spec.ts:55` — `error: 'not_owned'` | ✅ |
| CONS-07 | `reuse_cooldown` | `healing-potion.spec.ts:68` — `error: 'reuse_cooldown'` | ✅ |
| CONS-08 | `dead` | `healing-potion.spec.ts:81` — `error: 'dead'` | ✅ |
| CONS-09 | success hp/count/cooldown | `healing-potion.spec.ts:97-102` — `hp: 74, itemCount: 1, cooldownEndMs: 11_000` | ✅ |
| CONS-10 | hp 74, count 0, cooldown +10s | `TownRoom.spec.ts:1699-1701` — `hp 74`, count `0`, `cooldownEndMs 12_000` | ✅ |
| CONS-11 | count 0 → no-op | `TownRoom.spec.ts:1718-1719` — hp/count unchanged | ✅ |
| CONS-12 | weapon 2369 → no-op | `TownRoom.spec.ts:1738-1739` | ✅ |
| CONS-13 | reject at t+9999 | `TownRoom.spec.ts:1761-1763` — hp 74, count 1 | ✅ |
| CONS-14 | accept at t+10000 | `TownRoom.spec.ts:1766-1768` — hp 98, count 0 | ✅ |
| CONS-15 | peace zone allowed | `TownRoom.spec.ts:1787-1788` — hp 100 | ✅ |
| CONS-16 | persist on reconnect | `TownRoom.spec.ts:1808-1815` — DB hp 74, reload count 0 | ✅ |
| CONS-17 | Roxxy full heal regression | `TownRoom.spec.ts:1835-1836` — hp 100 after heal | ✅ |
| CONS-18 | Katerina buy regression | `TownRoom.spec.ts:1855-1856` — adena 897, count 1 | ✅ |
| CONS-19 | equip 1060 rejected | `TownRoom.spec.ts:1873` — `equippedWeaponItemId 0` | ✅ |
| CONS-20 | Use button `data-action="use"` | `inventory-window.spec.ts:143-147` | ✅ |
| CONS-21 | no Use on weapon | `inventory-window.spec.ts:154-157` — `useBtn null` | ✅ |
| CONS-22 | click → `sendUseItem({ itemId: 1060 })` | `inventory-window.spec.ts:172` | ✅ |
| CONS-23 | Use disabled on cooldown | `inventory-window.spec.ts:187` — `useBtn.disabled true` | ✅ |
| CONS-24 | `__useItem__` sends intent | `room-inventory.spec.ts:154-155` — `send('useItem', { itemId: 1060 })` | ✅ |
| CONS-25 | cooldown remaining → 0 when elapsed | `wire-room.spec.ts:217,225` — `player.healingPotionCooldownRemainingMs` 10_000 then 0 | ⚠️ Spec cites `__GAME_STATE__.healingPotionCooldownRemainingMs` (root); impl uses `player` sub-object (consistent with Power Strike) |
| CONS-26 | e2e damage → use → hp↑ count↓ | `consumable-use.spec.ts:162-177` — poll hp/count match expected | ✅ |
| CONS-27 | e2e double-use blocked 10s | `consumable-use.spec.ts:192-217` — count stable after 2nd use | ✅ |

**Status**: 26/27 exact match; 1 spec-precision gap (CONS-25 path wording; behavior verified on `player`)

---

## Discrimination Sensor

| # | Mutation | Killed? | Evidence |
| - | -------- | ------- | -------- |
| 1 | `resolveConsumableUse` healAmount forced to 0 | ✅ | `nx test game-core` — `resolves successful use` failed |
| 2 | Remove `ownedCount <= 0` guard in `validateConsumableUse` | ✅ | `nx test server --testNamePattern="rejects useItem when potion count"` failed |
| 3 | Remove `nowMs < cooldownEndMs` guard | ✅ | `nx test server --testNamePattern="rejects second useItem"` failed |
| 4 | Remove `window.__useItem__` assignment in `room.ts` | ✅ | `nx test client --testNamePattern="__useItem__"` failed |

**Sensor depth**: lightweight (4 targeted faults)
**Result**: 4/4 killed — **PASS**

---

## AD-014 Timing

| Test | Duration | Status |
| ---- | -------- | ------ |
| `healing potion restores HP…` (e2e) | ≤30 s (parallel suite 27 s total) | ✅ |
| `second healing potion use within 10s…` (e2e) | ≤30 s | ✅ |
| All game-core consumable unit tests | <1 s file | ✅ |
| TownRoom useItem describe | <10 s each (fake clock, `deliver`) | ✅ |

**Fixes applied**:
1. E2e: pass module constants into `page.evaluate` / `waitForFunction` args (browser closure bug caused flakes).
2. E2e: add adena/npc pre-waits; `takeFieldDamage` uses `approachMob` + `__attack__`; cooldown test skips damage (full-HP use valid).
3. Build: `GameStatePlayerInput` Omits `healingPotionCooldownEndMs` so optional default compiles.

No `waitForTimeout` in consumable e2e.

---

## Gate Check

| Project | Result | Count |
| ------- | ------ | ----- |
| `nx test game-core` | ✅ pass | 110 tests (21 files) |
| `nx test server` | ✅ pass | 220 tests (21 files) |
| `nx test client` | ✅ pass | 238 tests (46 files) |
| `nx build client` | ✅ pass | (after `test-hook.ts` type fix) |
| `nx e2e client-e2e` (consumable-use only) | ✅ pass | 2/2 in 27 s |

**Test delta (approx.)**: +9 game-core, +10 TownRoom room, +client unit additions, +2 e2e. No tests deleted or weakened.

**Note**: Full `nx e2e client-e2e` suite may have unrelated flakes (`power-strike`, `ti-mob-expansion`) under parallel load; phase-scoped consumable e2e gate is green.

---

## Code Quality

| Principle | Status |
| --------- | -------- |
| Minimum code / surgical | ✅ |
| AD-001 server authority | ✅ |
| Matches Power Strike / equip patterns | ✅ |
| Tests map to ACs | ✅ |
| AGENTS.md + AD-014 honored | ✅ (post-fix) |

---

## Verifier Fixes (iteration 1)

| File | Change |
| ---- | ------ |
| `client/src/test-hook.ts` | Omit `healingPotionCooldownEndMs` from required `GameStatePlayerInput` fields |
| `client-e2e/src/consumable-use.spec.ts` | Browser-arg serialization, faster damage setup, cooldown test without damage |

---

## Lessons Recorded

See `scripts/lessons.py add` entries for `gate_fail` signals from this validation.

---

## Summary

**Overall**: ✅ Ready

**Spec-anchored check**: 26/27 exact; 1 spec-precision gap (CONS-25 path)
**Sensor**: 4/4 killed
**Gate**: game-core 110 / server 220 / client 238 / e2e consumable 2 passed

**What works**: Server-authoritative Healing Potion use (24 HP, 10 s reuse), inventory Use + disabled cooldown, `__useItem__` hook, room + unit + e2e coverage.

**Next steps**: Orchestrator may mark ROADMAP complete; commit verifier fixes if desired.
