# Phase 28 — UI/UX Client Shell Specification

## Problem Statement

Phases 7–27 delivered authoritative gameplay (inventory rows, hotbar, quest log panel,
party stub, vitals text HUD, character creation overlay) as **functional stubs** — not an
L2-style client shell. Inventory is a vertical list without slots or weight; there is no
login or multi-character select (single `localStorage` character id); skills lack a
dedicated window; the party panel exposes raw session ids; there is no minimap/world map,
buff/debuff bars, system menu, unified window chrome, or target-of-target frame. Phase 23
deferred minimap to this phase; Phase 25 deferred weight/slot UI.

Phase 28 replaces stub HUD panels with a **DOM window layer** — Classic-inspired layout,
hotkeys, and `__GAME_STATE__` / `wireRoom` observability — while keeping **server authority**
for all outcomes (AD-001). Tests are **Vitest + jsdom DOM assertions only**; no Playwright
(AD-009, AD-010).

## Goals

- [ ] Login (local account name) + character select (multi-character per account) before
      world join; create-new flows into existing character creation.
- [ ] Unified **UI shell**: window manager, L2-style panel chrome, hotkeys, ESC system menu.
- [ ] **Full inventory grid** with paper-doll equip strip, adena row, **weight** and **slot**
      counters (server-replicated scalars).
- [ ] **Skill window** listing known skills with icons, SP display, cooldown state.
- [ ] **Quest log** upgrade: Active/Completed tabs + **quest tracker** HUD chip.
- [ ] **Party UI**: member frames with HP/MP bars; invite from target context (no session-id
      text field).
- [ ] **Minimap** (live) + **world map** modal from Phase 23 zone registry.
- [ ] **Buff/debuff bars** under vitals with icons and remaining duration.
- [ ] **Target frame** + **target-of-target** subframe for mob/player targets.
- [ ] Client unit tests per panel; `wireRoom` integration spec; full Nx gate green (AD-014).

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Cash shop / Prime Shop | Not Classic TI (ROADMAP) |
| Full options / keybind remapping UI | MVP defaults; system menu stub only |
| Playwright / `client-e2e` | Post-MVP gate |
| Server enforcement of overweight pickup | Display + replicate weight this phase; reject-on-overweight deferred |
| Authentic L2 HTML window skins / textures | DOM/CSS shell; no proprietary assets (AD-004) |
| Clan/alliance UI | Post-TI |
| Macro / auto-play UI | Post-TI |
| Audio volume controls (functional) | Phase 29 hook; menu shows disabled stub |
| 3D paper-doll preview in inventory | Icon + slot grid only |
| Delete character | Defer; select + create only |
| Password auth / accounts at scale | Local `accountName` string only |

---

## Assumptions & Open Questions

Autonomous Planner decisions (no user gate).

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| AC prefix | **UI28-NN** | Matches `PROG27-NN`, `SOC26-NN` | y |
| Test gate | Client Vitest DOM + `wireRoom` unit; server unit/room only for new data paths | ROADMAP Phase 28 is client shell; AD-010 | y |
| Account model | `accountName` string in `localStorage` (`nj.accountName`); `characters.account_name` column | Local login without passwords | y |
| Character list API | `GET /api/characters?accountName=` on Colyseus express (`app.config.ts`) | Reuse `/health` pattern | y |
| Max characters / account | **3** | Enough for local multi-char without L2's 7 | y |
| Character create | Requires `accountName` + `name` (3–16 chars); reuses Phase 19 `classId`/`sex` | Existing creation overlay | y |
| Join flow | Login → Select (or Create) → `connect({ characterId })` → hide shell overlays | Replaces auto-join on stored id only | y |
| Window manager | `ui/window-manager.ts` registers panels by id; central hotkey router | Avoid scattered `keydown` in `room.ts` | y |
| Panel chrome | Title bar + close button + `data-panel-id` on root | Testable DOM contract | y |
| Inventory grid | **8 × 10 = 80** slots; stack fills first empty slot | Classic main inventory size | y |
| Item placement | Stable sort: ascending `itemId`, stacks split across slots visually | Deterministic DOM tests | y |
| Weight formula | `inventoryWeight = Σ item.weight × count` (equipped items excluded) | L2J weight units from seed | y |
| Max load formula | `maxLoad = floor(con × 69000 / 1000)` → Human CON **43** → **2967** (L2J `MAX_LOAD` base) | AD-003 translation; unit anchor | y |
| Weight seed | Add `items.weight` column; parse L2J `weight` from existing `items_ti.xml` fixture | AD-012 | y |
| Server replication | `PlayerState.inventoryWeight` + `PlayerState.maxLoad` updated on item/equip/stat change | Client display is render-only (AD-001) | y |
| Slot count | `inventorySlotsUsed` replicated (unique stack rows); max **80** | Matches grid | y |
| Skill window hotkey | **K** toggles `#skill-window` | Classic default | y |
| Quest log hotkey | **L** toggles quest log; **Q** remains alias (Phase 21 regression) | Classic + backward compat | y |
| Quest tracker | Top-center HUD shows first active quest objective (pin quest id **0** = first active) | L2 tracker analogue | y |
| Party invite UX | Target frame context menu → Invite; remove `[data-role="invite-target"]` input | Replace Phase 26 stub | y |
| Party vitals | Client reads `room.state.players` for each `party.memberSessionIds` HP/MP | Already replicated | y |
| Minimap bounds | `WORLD_MIN/MAX` (**±315**); player dot from `player.x/z` | Phase 23 constants | y |
| Zone overlay | Simplified axis-aligned bounds per `TI_ZONES` polygon (bounding box) | DOM/SVG, not WebGL (AD-009) | y |
| World map hotkey | **M** opens `#world-map` modal; minimap always visible in combat HUD | Classic pattern | y |
| Buff/debuff source | Replicate `activeEffects: [{ skillId, kind, expiresAtMs }]` on `PlayerState` (max **12**) | Replaces single `activeBuffSkillId` scalar | y |
| Effect icons | Reuse Phase 14 skill icons via `icon-manifest` | Existing pipeline | y |
| Target frame | Shows name, level, HP bar for `targetMobId` or `targetPlayerSessionId` | Combat UX |
| Target-of-target | Mob: replicate `MobState.aggroTargetSessionId`; Player: target's `targetMobId` or `targetPlayerSessionId` | Server render metadata only | y |
| Context menu | Right-click or action button on target: Invite party, Request trade (existing intents) | Phase 26 wiring | y |
| Logout | System menu → clear session, return to character select (keep `accountName`) | Local loop | y |
| Vitals HUD | Upgrade to bar gauges (HP/MP/CP stub CP omitted); keep `#player-vitals-hud` id | Shell polish | y |
| Implicit: auth / rate limits | N/A — local dev | — | N/A |
| Implicit: concurrency | Client tests isolated jsdom; server room tests unchanged | — | N/A |

**Open questions:** none — all resolved or logged above.

---

## L2J Anchors

### Item weight (fixture)

| itemId | Name | weight |
| ------ | ---- | ------ |
| **2369** | Squire's Sword | **1600** |
| **1060** | Healing Potion | **5** (approx from L2J potion) |
| **57** | Adena | **0** (stackable coin — weight 0 for MVP) |

### Inventory weight anchor — Human Fighter CON **43**

| Items in inventory | Expected `inventoryWeight` |
| ------------------ | -------------------------- |
| **2369 × 1** (not equipped) | **1600** |
| **1060 × 10** | **50** (5 each) |

`maxLoad` at CON **43**: **2967** (formula above).

### Max load display

| `inventoryWeight` | `maxLoad` | UI SHALL show |
| ----------------- | --------- | ------------- |
| **1600** | **2967** | `1600 / 2967` or `54%` bar fill |

---

## User Stories

### P1: UI shell foundation ⭐ MVP

**User Story**: As a player, I use consistent window chrome and hotkeys to open/close panels
without scattered overlays blocking the canvas.

**Acceptance Criteria**:

1. **UI28-01**: WHEN `mountUiShell()` runs THEN `#ui-shell` and `window-manager` registry SHALL exist with `data-panel-id` on each registered panel root.
   **Test layer: client unit**
2. **UI28-02**: WHEN user presses **I** THEN `#inventory-window` visibility SHALL toggle via window manager (not ad-hoc `hidden` on legacy path only).
   **Test layer: client unit**
3. **UI28-03**: WHEN user presses **K** THEN `#skill-window` SHALL toggle.
   **Test layer: client unit**
4. **UI28-04**: WHEN user presses **L** THEN `#quest-log` SHALL toggle; **Q** SHALL also toggle (alias).
   **Test layer: client unit**
5. **UI28-05**: WHEN user presses **Escape** THEN `#system-menu` SHALL open; second **Escape** or Close SHALL dismiss.
   **Test layer: client unit**
6. **UI28-06**: WHEN a panel is open THEN its chrome SHALL include `[data-role="panel-title"]` and `[data-role="panel-close"]`.
   **Test layer: client unit**
7. **UI28-07**: WHEN `#system-menu` opens THEN in-world canvas pointer events SHALL remain on canvas (menu is overlay, not fullscreen block unless modal).
   **Test layer: client unit**

---

### P2: Login + character select ⭐ MVP

**User Story**: As a returning local player, I enter an account name, pick one of my
characters (or create new), then enter the world.

**Acceptance Criteria**:

8. **UI28-08**: WHEN no `nj.accountName` in `localStorage` THEN `#login-screen` SHALL display before any Colyseus join.
   **Test layer: client unit**
9. **UI28-09**: WHEN login submits name **"hero1"** THEN `localStorage` SHALL store `nj.accountName=hero1` and navigate to `#character-select-screen`.
   **Test layer: client unit**
10. **UI28-10**: WHEN `GET /api/characters?accountName=hero1` returns 2 rows THEN select screen SHALL render 2 `[data-role="character-row"]` entries with names and levels.
    **Test layer: client unit** (mock fetch)
11. **UI28-11**: WHEN user selects a character row THEN `connect` SHALL be called with that `characterId` and game canvas SHALL become visible.
    **Test layer: client unit**
12. **UI28-12**: WHEN user clicks Create THEN Phase 19 `#character-creation` overlay SHALL open scoped to current `accountName`.
    **Test layer: client unit**
13. **UI28-13**: WHEN account already has **3** characters THEN Create SHALL be disabled with `[data-role="character-cap"]` message.
    **Test layer: client unit**
14. **UI28-14**: WHEN `createCharacter` persists THEN `characters.account_name` SHALL equal submitted account.
    **Test layer: server unit**
15. **UI28-15**: WHEN join with invalid `characterId` for account THEN server SHALL reject join.
    **Test layer: room**

---

### P3: Inventory grid + weight/slots ⭐ MVP

**User Story**: As a player, I manage items in a Classic-style grid with visible weight and
slot pressure.

**Acceptance Criteria**:

16. **UI28-16**: WHEN inventory opens THEN panel SHALL render **80** `[data-role="inv-slot"]` cells in an 8×10 grid.
    **Test layer: client unit**
17. **UI28-17**: WHEN `items` map has **1060 × 3** and **2369 × 1** THEN occupied slots SHALL show item icons with `[data-item-id]` and stack count.
    **Test layer: client unit**
18. **UI28-18**: WHEN `inventoryWeight=1600` and `maxLoad=2967` THEN `[data-role="weight-bar"]` SHALL reflect ratio **≥ 0.53** (±0.01).
    **Test layer: client unit**
19. **UI28-19**: WHEN `inventorySlotsUsed=2` THEN `[data-role="slots-used"]` text SHALL be `2 / 80`.
    **Test layer: client unit**
20. **UI28-20**: WHEN paper-doll strip renders THEN equip slots from `__GAME_STATE__.equipment` SHALL appear as `[data-equip-slot]` with icons.
    **Test layer: client unit**
21. **UI28-21**: WHEN double-click consumable slot THEN `sendUseItem` intent SHALL fire (existing handler).
    **Test layer: client unit**
22. **UI28-22**: WHEN `calcInventoryWeight({ 2369: 1 }, weightTable)` in game-core THEN result SHALL be **1600**.
    **Test layer: unit (game-core)**
23. **UI28-23**: WHEN TownRoom loads character items THEN `PlayerState.inventoryWeight` SHALL match game-core calculation.
    **Test layer: room**

---

### P4: Skill window ⭐ MVP

**User Story**: As a player, I inspect all learned skills, SP balance, and cooldowns outside
the hotbar.

**Acceptance Criteria**:

24. **UI28-24**: WHEN skill window opens THEN each `knownSkillIds` entry SHALL render as `[data-skill-id]` row with skill icon.
    **Test layer: client unit**
25. **UI28-25**: WHEN `player.sp=120` THEN `[data-role="sp-balance"]` SHALL display **120**.
    **Test layer: client unit**
26. **UI28-26**: WHEN skill cooldown remaining **> 0** THEN row SHALL show `[data-role="skill-cooldown"]` overlay.
    **Test layer: client unit**
27. **UI28-27**: WHEN user clicks skill row THEN `__useSkill__(skillId)` hook SHALL be invoked (same authority path as hotbar).
    **Test layer: client unit**
28. **UI28-28**: WHEN no known skills THEN empty state `[data-role="skills-empty"]` SHALL display.
    **Test layer: client unit**

---

### P5: Quest log + tracker ⭐ MVP

**User Story**: As a questing player, I review active/completed quests and see a compact
tracker for my current objective.

**Acceptance Criteria**:

29. **UI28-29**: WHEN quest log opens THEN tabs **Active** and **Completed** SHALL exist (`[data-tab="active"]`, `[data-tab="completed"]`).
    **Test layer: client unit**
30. **UI28-30**: WHEN active tab selected THEN only `quests.active` rows render under `[data-role="active-quest"]`.
    **Test layer: client unit**
31. **UI28-31**: WHEN completed tab selected THEN `quests.completed` rows render (Phase 21 titles preserved).
    **Test layer: client unit**
32. **UI28-32**: WHEN at least one active quest THEN `#quest-tracker` SHALL show first active title + objective text.
    **Test layer: client unit**
33. **UI28-33**: WHEN no active quests THEN `#quest-tracker` SHALL be hidden.
    **Test layer: client unit**
34. **UI28-34**: WHEN quest state updates via `wireRoom` THEN tracker SHALL refresh without page reload.
    **Test layer: client unit (`wireRoom` spec)**

---

### P6: Party UI ⭐ MVP

**User Story**: As a party leader or member, I see ally vitals and invite from my target —
not by typing session ids.

**Acceptance Criteria**:

35. **UI28-35**: WHEN `party.memberSessionIds` has 2 members THEN `#party-panel` SHALL render 2 `[data-role="party-member"]` frames.
    **Test layer: client unit**
36. **UI28-36**: WHEN member HP is **40/100** THEN member frame SHALL show `[data-role="party-hp-fill"]` at **40%** width (±1%).
    **Test layer: client unit**
37. **UI28-37**: WHEN `leaderSessionId` matches member THEN that frame SHALL have `[data-party-leader="true"]`.
    **Test layer: client unit**
38. **UI28-38**: WHEN target frame context **Invite** clicked THEN `__partyInvite__(targetSessionId)` SHALL fire.
    **Test layer: client unit**
39. **UI28-39**: WHEN party panel renders THEN `[data-role="invite-target"]` input SHALL NOT exist (stub removed).
    **Test layer: client unit**
40. **UI28-40**: WHEN Leave clicked THEN `sendPartyLeave` SHALL fire.
    **Test layer: client unit**

---

### P7: Minimap + world map ⭐ MVP

**User Story**: As an explorer, I orient myself on Talking Island with a live minimap and
an expandable world map.

**Acceptance Criteria**:

41. **UI28-41**: WHEN in world THEN `#minimap` SHALL be visible with `[data-role="player-dot"]`.
    **Test layer: client unit**
42. **UI28-42**: WHEN `player.x=0, player.z=0` THEN player dot SHALL be at minimap center (normalized world coords).
    **Test layer: client unit**
43. **UI28-43**: WHEN `zone.displayName` is **Talking Island Village** THEN `[data-role="minimap-zone-label"]` SHALL show that text.
    **Test layer: client unit**
44. **UI28-44**: WHEN **M** pressed THEN `#world-map` modal SHALL open with **6** named zone labels from `TI_ZONES`.
    **Test layer: client unit**
45. **UI28-45**: WHEN party member positions known THEN minimap SHALL render `[data-role="party-dot"]` per member.
    **Test layer: client unit**
46. **UI28-46**: WHEN world map closes THEN gameplay hotkeys SHALL still toggle inventory (no focus trap regression).
    **Test layer: client unit**

---

### P8: Buff / debuff bars ⭐ MVP

**User Story**: As a player, I see active buffs and debuffs with time remaining above the
action bar.

**Acceptance Criteria**:

47. **UI28-47**: WHEN `activeEffects` contains buff `{ skillId: 1068, kind: 'buff_self', expiresAtMs }` THEN `#buff-bar` SHALL show icon with `[data-effect-id="1068"]`.
    **Test layer: client unit**
48. **UI28-48**: WHEN debuff present THEN `#debuff-bar` SHALL render separate row (not mixed into buff row).
    **Test layer: client unit**
49. **UI28-49**: WHEN `expiresAtMs - nowMs = 12000` THEN `[data-role="effect-timer"]` SHALL show **12** seconds (floor).
    **Test layer: client unit**
50. **UI28-50**: WHEN effect expires THEN icon SHALL be removed on next render tick.
    **Test layer: client unit**
51. **UI28-51**: WHEN `wireRoom` syncs player THEN `__GAME_STATE__.player.activeEffects` SHALL mirror schema array.
    **Test layer: client unit**

---

### P9: System menu + target frames ⭐ MVP

**User Story**: As a player, I use ESC for game menu, inspect my target, and see
target-of-target during combat.

**Acceptance Criteria**:

52. **UI28-52**: WHEN system menu open THEN buttons SHALL exist for Inventory, Skills, Quest Log, World Map, and Logout (`[data-action]`).
    **Test layer: client unit**
53. **UI28-53**: WHEN Logout chosen THEN Colyseus room SHALL leave and `#character-select-screen` SHALL return.
    **Test layer: client unit**
54. **UI28-54**: WHEN `targetMobId` set THEN `#target-frame` SHALL show mob name + HP bar from `__GAME_STATE__.mobs`.
    **Test layer: client unit**
55. **UI28-55**: WHEN targeted mob has `aggroTargetSessionId` THEN `#target-of-target` SHALL show player name.
    **Test layer: client unit**
56. **UI28-56**: WHEN `targetPlayerSessionId` set THEN target frame SHALL show `pvpFlag`/`karma` indicator (`[data-pvp-flag]`).
    **Test layer: client unit**
57. **UI28-57**: WHEN player target's target is a mob THEN target-of-target SHALL show that mob's name.
    **Test layer: client unit**

---

### P10: Polish & gate

**Acceptance Criteria**:

58. **UI28-58**: `__GAME_STATE__.ui` SHALL expose `{ inventoryOpen, skillWindowOpen, questLogOpen, systemMenuOpen, worldMapOpen }` booleans.
    **Test layer: client unit**
59. **UI28-59**: Vitals HUD SHALL render HP/MP as progress bars (`[data-role="hp-fill"]`, `[data-role="mp-fill"]`).
    **Test layer: client unit**
60. **UI28-60**: Full gate `nx run-many -t build lint test` green; no new test file **>10 s** (AD-014).
    **Test layer: gate**

---

## Edge Cases

- WHEN account name empty on login THEN submit SHALL be disabled.
- WHEN character name duplicate on account THEN create SHALL reject server-side.
- WHEN inventory grid full (80 slots used) THEN UI SHALL show full state; server buy may still succeed (overweight display only this phase).
- WHEN overweight (`inventoryWeight > maxLoad`) THEN weight bar SHALL turn warning color (`data-overweight="true"`).
- WHEN target cleared THEN target and target-of-target frames SHALL hide.
- WHEN party disbanded THEN party panel SHALL show solo empty state.
- WHEN minimap player outside world bounds THEN dot SHALL clamp to minimap edge.
- WHEN modal world map open THEN **M** or Close SHALL dismiss without leaving room.

---

## Requirement Traceability

| Requirement ID | Story | Status |
| -------------- | ----- | ------ |
| UI28-01 … 07 | P1: UI shell | Pending |
| UI28-08 … 15 | P2: Login / select | Pending |
| UI28-16 … 23 | P3: Inventory grid | Pending |
| UI28-24 … 28 | P4: Skill window | Pending |
| UI28-29 … 34 | P5: Quest log | Pending |
| UI28-35 … 40 | P6: Party UI | Pending |
| UI28-41 … 46 | P7: Minimap / map | Pending |
| UI28-47 … 51 | P8: Buff/debuff | Pending |
| UI28-52 … 57 | P9: Menu / targets | Pending |
| UI28-58 … 60 | P10: Polish & gate | Pending |

**Coverage:** 60 total, 0 mapped to tasks (pending tasks.md), 0 unmapped.

---

## Success Criteria

- [ ] Login → select → world boot replaces single-character auto-join.
- [ ] All nine ROADMAP panels ship with DOM tests and hotkeys.
- [ ] Weight **1600/2967** anchor passes unit + room + client bar.
- [ ] Minimap shows player + zone; world map lists 6 TI zones.
- [ ] All **60** ACs traced in `validation.md` with client/server evidence.
