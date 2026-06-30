# Phase 28 — UI/UX Client Shell Validation

**Date**: 2026-06-30
**Spec**: `.specs/features/phase-28-ui-shell/spec.md`
**Diff range**: `41b7212..cdda2e7` (master)
**Verifier**: independent sub-agent (author ≠ verifier)

---

## Task Completion

| Task | Status  | Notes |
| ---- | ------- | ----- |
| T1–T18 | ✅ Done | 17 feature commits + gate commit `cdda2e7` on master |

---

## Spec-Anchored Acceptance Criteria

| ID | Criterion (WHEN → THEN) | Spec-defined outcome | `file:line` + assertion | Result |
| -- | ----------------------- | -------------------- | ----------------------- | ------ |
| UI28-01 | `mountUiShell()` | `#ui-shell` + `data-panel-id` registry | `window-manager.spec.ts:38` — `expect(document.getElementById('ui-shell')).not.toBeNull()` | ✅ PASS |
| UI28-02 | **I** pressed | `#inventory-window` toggles | `window-manager.spec.ts:46` — `expect(isPanelOpen('inventory-window')).toBe(true)` | ✅ PASS |
| UI28-03 | **K** pressed | `#skill-window` toggles | `window-manager.spec.ts:53` — `expect(isPanelOpen('skill-window')).toBe(true)` | ✅ PASS |
| UI28-04 | **L** / **Q** pressed | `#quest-log` toggles | `window-manager.spec.ts:58–61` — `expect(isPanelOpen('quest-log')).toBe(true)` | ✅ PASS |
| UI28-05 | **Escape** | `#system-menu` open/close | `window-manager.spec.ts:66–68` — `expect(menu?.hidden).toBe(false/true)` | ✅ PASS |
| UI28-06 | panel open | chrome `[data-role="panel-title"]` + close | `window-manager.spec.ts:74–75` — `expect(panel.querySelector('[data-role="panel-title"]')).not.toBeNull()` | ✅ PASS |
| UI28-07 | system menu open | canvas pointer events not blocked | `window-manager.spec.ts:84–85` — `expect(getComputedStyle(menu).pointerEvents).not.toBe('all')` | ✅ PASS |
| UI28-08 | no `nj.accountName` | `#login-screen` visible | `login-screen.spec.ts:16` — `expect(document.getElementById('login-screen')).not.toBeNull()` | ✅ PASS |
| UI28-09 | login **hero1** | `localStorage` + navigate | `login-screen.spec.ts:30` — `expect(localStorage.getItem(...)).toBe('hero1')` | ✅ PASS |
| UI28-10 | API returns 2 rows | 2 `[data-role="character-row"]` | `character-select.spec.ts:16–25` — `expect(rows.length).toBe(2)` | ✅ PASS |
| UI28-11 | select row | `connect(characterId)` + canvas visible | `character-select.spec.ts:35` — `expect(onSelect).toHaveBeenCalledWith('c1')` | ✅ PASS |
| UI28-12 | Create clicked | `#character-creation` opens | `character-select.spec.ts:38–43` — `expect(onCreate).toHaveBeenCalled()` | ✅ PASS |
| UI28-13 | 3 characters | Create disabled + cap message | `character-select.spec.ts:45–52` — `expect(cap).not.toBeNull()` | ✅ PASS |
| UI28-14 | `createCharacter` | `account_name` persisted | `character-repository.spec.ts:300` — `expect(row.accountName).toBe('hero1')` | ✅ PASS |
| UI28-15 | invalid join | server rejects | `TownRoom.ui-shell.spec.ts:79–85` — `rejects.toThrow()` + `players.size === 0` | ✅ PASS |
| UI28-16 | inventory open | **80** `[data-role="inv-slot"]` | `inventory-window.spec.ts:22–35` — `expect(slots.length).toBe(80)` | ✅ PASS |
| UI28-17 | items 1060×3 + 2369×1 | icons + stacks | `inventory-window.spec.ts:51–52` — `expect(querySelector('[data-item-id="1060"]')).not.toBeNull()` | ✅ PASS |
| UI28-18 | weight 1600/2967 | bar ratio **≥ 0.53** | `inventory-window.spec.ts:70` — `expect(width / 100).toBeGreaterThanOrEqual(0.53)` | ✅ PASS |
| UI28-19 | slots used 2 | text `2 / 80` | `inventory-window.spec.ts:88` — `expect(slotsUsed?.textContent).toBe('2 / 80')` | ✅ PASS |
| UI28-20 | paper doll | `[data-equip-slot]` icons | `inventory-window.spec.ts:100` — `expect(querySelector('[data-equip-slot="rhand"]')).not.toBeNull()` | ✅ PASS |
| UI28-21 | double-click consumable | `sendUseItem` fires | `inventory-window.spec.ts:118` — `expect(handlers.sendUseItem).toHaveBeenCalledWith({ itemId: 1060 })` | ✅ PASS |
| UI28-22 | `calcInventoryWeight({2369:1})` | **1600**; CON 43 → **2967** | `inventory-weight.spec.ts:16–24` — `expect(calcInventoryWeight(...)).toBe(1600)` | ✅ PASS |
| UI28-23 | TownRoom load | `inventoryWeight` **1600** | `TownRoom.ui-shell.spec.ts:115` — `expect(player.inventoryWeight).toBe(1600)` | ✅ PASS |
| UI28-24 | skill window open | `[data-skill-id]` rows + icons | `skill-window.spec.ts:12–17` — `expect(document.querySelector('[data-skill-id="3"]')).not.toBeNull()` | ✅ PASS |
| UI28-25 | `sp=120` | `[data-role="sp-balance"]` shows **120** | `skill-window.spec.ts:21` — `expect(spBalance?.textContent).toBe('SP: 120')` | ✅ PASS |
| UI28-26 | cooldown > 0 | `[data-role="skill-cooldown"]` overlay | `skill-window.spec.ts:24–33` — `expect(overlay).not.toBeNull()` | ✅ PASS |
| UI28-27 | click skill row | `__useSkill__(skillId)` | `skill-window.spec.ts:45` — `expect(onUseSkill).toHaveBeenCalledWith(3)` | ✅ PASS |
| UI28-28 | no known skills | `[data-role="skills-empty"]` | `skill-window.spec.ts:48–52` — `expect(empty).not.toBeNull()` | ✅ PASS |
| UI28-29 | quest log open | Active + Completed tabs | `quest-tracker.spec.ts:12–13` — `expect(querySelector('[data-tab="active"]')).not.toBeNull()` | ✅ PASS |
| UI28-30 | active tab | only active rows | `quest-tracker.spec.ts:24–25` — `active-quest.length === 1`, completed 0 | ✅ PASS |
| UI28-31 | completed tab | completed rows | `quest-tracker.spec.ts:35` — `completed-quest.length === 1` | ✅ PASS |
| UI28-32 | active quest exists | `#quest-tracker` shows objective | `quest-tracker.spec.ts:40–41` — `tracker.hidden === false` + gremlins text | ✅ PASS |
| UI28-33 | no active quests | tracker hidden | `quest-tracker.spec.ts:46` — `expect(tracker?.hidden).toBe(true)` | ✅ PASS |
| UI28-34 | `wireRoom` quest update | tracker refreshes | `room-ui-shell.spec.ts:18` — `expect(quest-tracker?.hidden).toBe(false)` | ✅ PASS |
| UI28-35 | 2 party members | 2 `[data-role="party-member"]` | `party-panel.spec.ts:12–17` — `expect(members.length).toBe(2)` | ✅ PASS |
| UI28-36 | HP 40/100 | fill **40%** (±1%) | `party-panel.spec.ts:20–26` — `expect(parseFloat(fill.style.width)).toBeCloseTo(40, 0)` | ✅ PASS |
| UI28-37 | leader match | `[data-party-leader="true"]` | `party-panel.spec.ts:28–33` — `expect(leader).not.toBeNull()` | ✅ PASS |
| UI28-38 | context **Invite** | `__partyInvite__(targetSessionId)` | `target-frame.spec.ts:72` — `expect(invited).toEqual(['peer-1'])` | ✅ PASS (verifier fix) |
| UI28-39 | party panel | no `[data-role="invite-target"]` | `party-panel.spec.ts:35–37` — `expect(querySelector('[data-role="invite-target"]')).toBeNull()` | ✅ PASS |
| UI28-40 | Leave clicked | `sendPartyLeave` fires | `party-panel.spec.ts:40–44` — `expect(onLeave).toHaveBeenCalled()` | ✅ PASS |
| UI28-41 | in world | `#minimap` + player dot | `minimap.spec.ts:10–14` — `expect(minimap?.hidden).toBe(false)` | ✅ PASS |
| UI28-42 | origin coords | dot at center | `minimap.spec.ts:17–21` — center position within ±2px | ✅ PASS |
| UI28-43 | zone name | label text | `minimap.spec.ts:23–27` — `expect(label?.textContent).toContain('Talking Island Village')` | ✅ PASS |
| UI28-44 | **M** → world map | **6** zone labels | `world-map.spec.ts:12` — `expect(zone-labels.length).toBe(6)` | ✅ PASS (SPEC_DEVIATION: 6 not 7) |
| UI28-45 | party positions | `[data-role="party-dot"]` per member | `minimap.spec.ts:37` — `expect(partyDots.length).toBe(1)` | ✅ PASS |
| UI28-46 | world map closes | **I** still toggles inventory | `world-map.spec.ts:38–40` — `expect(isPanelOpen('inventory-window')).toBe(true)` | ✅ PASS (verifier fix) |
| UI28-47 | buff in `activeEffects` | `#buff-bar` icon 1068 | `buff-debuff-bars.spec.ts:9–14` — `expect(querySelector('[data-effect-id="1068"]')).not.toBeNull()` | ✅ PASS |
| UI28-48 | debuff present | separate `#debuff-bar` row | `buff-debuff-bars.spec.ts:17–25` — debuff not in buff row | ✅ PASS |
| UI28-49 | 12s remaining | timer shows **12** | `buff-debuff-bars.spec.ts:28–32` — `expect(timer?.textContent).toBe('12')` | ✅ PASS |
| UI28-50 | effect expired | icon removed | `buff-debuff-bars.spec.ts:34–38` — `expect(querySelector('[data-effect-id="1068"]')).toBeNull()` | ✅ PASS |
| UI28-51 | `wireRoom` sync | `activeEffects` on player | `room-ui-shell.spec.ts:23` — `expect(activeEffects[0]?.skillId).toBe(1068)` | ✅ PASS |
| UI28-52 | system menu | action buttons exist | `system-menu.spec.ts:13–20` — inventory/skills/quest/map/logout actions | ✅ PASS |
| UI28-53 | Logout | return to character select | `system-menu.spec.ts:37–38` — `expect(character-select-screen).not.toBeNull()` + canvas hidden | ✅ PASS |
| UI28-54 | `targetMobId` | mob name + HP bar | `target-frame.spec.ts:13–15` — Gremlin + HP bar | ✅ PASS |
| UI28-55 | mob `aggroTargetSessionId` | ToT player name | `target-frame.spec.ts:28` — `expect(tot?.textContent).toContain('Hero')` | ✅ PASS |
| UI28-56 | player target | `[data-pvp-flag]` | `target-frame.spec.ts:42` — `expect(querySelector('[data-pvp-flag]')).not.toBeNull()` | ✅ PASS |
| UI28-57 | player target → mob | ToT mob name | `target-frame.spec.ts:55` — `expect(tot?.textContent).toContain('Gremlin')` | ✅ PASS (verifier fix) |
| UI28-58 | `__GAME_STATE__.ui` | boolean flags | `room-ui-shell.spec.ts:27–28` — `expect(ui.inventoryOpen).toBe(true)` | ✅ PASS |
| UI28-59 | vitals HUD | HP/MP bar fills | `player-vitals.spec.ts:18–24` — fill width matches ratio | ✅ PASS |
| UI28-60 | full gate | build/lint/test green; no file >10s | `nx run-many -t build lint test` exit 0; slowest new file `TownRoom.ui-shell.spec.ts` **1.51s** | ✅ PASS |

**Status**: ✅ All 60 ACs covered with spec-anchored assertions

### Documented deviations (per orchestrator)

| AC / area | Spec | Implementation | Evidence |
| --------- | ---- | -------------- | -------- |
| UI28-44 | 6 TI zone labels on world map | `harbor_water` excluded → **6** labels (not 7) | `world-map.ts:43` filter; `world-map.spec.ts:12` |
| UI28-55 server | mob aggro sets `aggroTargetSessionId` | Injected via `syncMobState` (not live AI chase) | `TownRoom.ui-shell.spec.ts:189–192` |
| UI28-38 | Invite from target context menu | `[data-action="invite"]` → `__partyInvite__` | `target-frame.ts:124–125`; `target-frame.spec.ts:58–72` |

---

## Discrimination Sensor

| Mutation | File:line | Description | Killed? |
| -------- | --------- | ----------- | ------- |
| 1 | `inventory-window.ts:135` | Zeroed weight fill width (`Math.min(1,ratio)*100` → `0`) | ✅ Killed (`UI28-18`) |
| 2 | `target-frame.ts:125` | Commented `__partyInvite__` call | ✅ Killed (`UI28-38`) |
| 3 | `world-map.ts:43` | Removed `harbor_water` filter (7 zones) | ✅ Killed (`UI28-44`) |

**Sensor depth**: lightweight (3 mutations)
**Result**: 3/3 killed — ✅ PASS

---

## Code Quality

| Principle | Status |
| --------- | ------ |
| Minimum code | ✅ |
| Surgical changes | ✅ |
| No scope creep | ✅ |
| Matches patterns | ✅ |
| Spec-anchored outcome check | ✅ |
| Per-layer coverage (unit/room/seed/gate) | ✅ |
| Tests map to ACs | ✅ |
| Guidelines: `AGENTS.md` AD-001/009/010/014 | ✅ |

---

## Edge Cases (spec)

| Edge case | Handled | Evidence |
| --------- | ------- | -------- |
| Empty account name → submit disabled | ✅ | `login-screen.ts` submit disabled when empty |
| Duplicate character name | ✅ | `character-repository.spec.ts` reject test |
| Grid full (80 slots) | ⚠️ display only | overweight/full UI stubs; server buy not blocked (spec out-of-scope) |
| Overweight warning color | ✅ | `inventory-window.ts:136–139` `data-overweight="true"` |
| Target cleared → frames hide | ✅ | `target-frame.ts:132–133` |
| Party disbanded → solo empty | ✅ | `party-panel.ts` empty state |
| Minimap dot clamped at bounds | ✅ | `minimap.ts` clamp logic |
| World map **M**/Close dismisses | ✅ | `world-map.spec.ts:36–37` |

---

## Gate Check

- **Gate command**: `nx run-many -t build lint test`
- **Result**: ✅ build/lint/test green (3 projects); lint 0 errors / 55 warnings (pre-existing style)
- **Test counts after phase** (no cache): game-core **284**, client **338**, server **480** → **1102** total
- **Phase 28 new tests**: ~63 UI28-labeled client/server/game-core tests + 4 room integration tests
- **Skipped tests**: none
- **Failures**: none
- **Slowest new file**: `TownRoom.ui-shell.spec.ts` **1.51s** (AD-014 ✅)

---

## Fix Plans (verifier iteration 1 — within fix≤3 budget)

| Fix | Issue | Resolution |
| --- | ----- | ---------- |
| 1 | UI28-38 no `file:line` evidence at `cdda2e7` | Added `target-frame.spec.ts` context-invite test |
| 2 | UI28-46 no evidence | Added `world-map.spec.ts` hotkey regression test |
| 3 | UI28-57 no evidence | Added `target-frame.spec.ts` player→mob ToT test |

**Note**: Fixes are uncommitted verifier additions to `target-frame.spec.ts` and `world-map.spec.ts`.

---

## Requirement Traceability (report only — ROADMAP/STATE not modified)

| Requirement | Status at `cdda2e7` | Post-verifier |
| ----------- | ------------------- | ------------- |
| UI28-01 … 60 | 57/60 evidenced | **60/60** ✅ |

---

## Summary

**Overall**: ✅ **PASS**

**Spec-anchored check**: 60/60 ACs matched spec-defined outcomes (3 gaps closed in verifier fix iteration)
**Sensor**: 3/3 mutations killed
**Gate**: 1102 tests passed; build + lint green

**What works**: Full L2-style client shell — login/select flow, window manager + hotkeys, inventory grid with weight/slots, skill/quest/party/minimap/world-map/buff/target/system-menu panels, `wireRoom` UI sync, server join guard + weight replication.

**Issues found**: At `cdda2e7`, UI28-38/46/57 lacked dedicated tests (implementation present). Verifier added 3 tests; no implementation defects found.

**Next steps**: Commit verifier test additions; optional — label server room tests with UI28 IDs for activeEffects/aggro replication.
